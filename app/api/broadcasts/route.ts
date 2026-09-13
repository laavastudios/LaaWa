import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { verifySession } from "../auth/login/route";
import { isDatabaseConfigured, query, withTransaction } from "../../../lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function isAuthed() {
  const store = await cookies();
  return verifySession(store.get("laawa_session")?.value);
}

async function getWorkspaceId() {
  const result = await query<{ id: string }>(
    "SELECT id FROM workspaces ORDER BY created_at LIMIT 1"
  );
  return result.rows[0]?.id ?? null;
}

function fillTemplate(
  body: string,
  contact: { name: string | null; phone: string | null; email: string | null }
) {
  return body
    .replace(/{{\s*name\s*}}/gi, contact.name || "there")
    .replace(/{{\s*phone\s*}}/gi, contact.phone || "")
    .replace(/{{\s*email\s*}}/gi, contact.email || "");
}

export async function GET() {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json({
      broadcasts: [],
      accounts: [],
      tags: [],
      configured: false,
    });
  }

  try {
    const workspaceId = await getWorkspaceId();
    if (!workspaceId) {
      return NextResponse.json({
        broadcasts: [],
        accounts: [],
        tags: [],
        configured: true,
      });
    }

    const [broadcasts, accounts, tags] = await Promise.all([
      query(
        "SELECT b.*, wa.name account_name, t.name template_name FROM broadcasts b LEFT JOIN whatsapp_accounts wa ON wa.id = b.whatsapp_account_id LEFT JOIN templates t ON t.id = b.template_id WHERE b.workspace_id = $1 ORDER BY b.created_at DESC LIMIT 100",
        [workspaceId]
      ),
      query(
        "SELECT id, name, session_key FROM whatsapp_accounts WHERE workspace_id = $1 ORDER BY name",
        [workspaceId]
      ),
      query(
        "SELECT id, name FROM tags WHERE workspace_id = $1 ORDER BY name",
        [workspaceId]
      ),
    ]);

    return NextResponse.json({
      broadcasts: broadcasts.rows,
      accounts: accounts.rows,
      tags: tags.rows,
      configured: true,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to load campaigns.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "DATABASE_URL is required for campaigns." },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const name = String(body?.name || "").trim();
    const message = String(body?.body || "").trim();
    const accountId = String(body?.whatsappAccountId || "").trim();
    const tagIds = Array.isArray(body?.tagIds)
      ? body.tagIds.map(String).filter(Boolean)
      : [];
    const scheduledFor = body?.scheduledFor
      ? new Date(body.scheduledFor)
      : null;
    const ratePerMinute = Math.min(
      60,
      Math.max(1, Number(body?.ratePerMinute || 20))
    );

    if (!name || !message || !accountId) {
      return NextResponse.json(
        { error: "Name, message and WhatsApp account are required." },
        { status: 400 }
      );
    }

    if (
      scheduledFor &&
      (!Number.isFinite(scheduledFor.getTime()) ||
        scheduledFor.getTime() <= Date.now())
    ) {
      return NextResponse.json(
        { error: "Scheduled time must be in the future." },
        { status: 400 }
      );
    }

    const workspaceId = await getWorkspaceId();
    if (!workspaceId) {
      return NextResponse.json(
        { error: "Workspace is not initialized." },
        { status: 503 }
      );
    }

    const result = await withTransaction(async (client) => {
      const account = await client.query(
        "SELECT id FROM whatsapp_accounts WHERE id = $1 AND workspace_id = $2",
        [accountId, workspaceId]
      );
      if (!account.rows[0]) {
        throw new Error("WhatsApp account not found.");
      }

      if (tagIds.length) {
        const tags = await client.query(
          "SELECT id FROM tags WHERE workspace_id = $1 AND id = ANY($2::uuid[])",
          [workspaceId, tagIds]
        );
        if (tags.rows.length !== tagIds.length) {
          throw new Error("One or more audience tags are invalid.");
        }
      }

      const params: unknown[] = tagIds.length
        ? [workspaceId, accountId, tagIds, tagIds.length]
        : [workspaceId, accountId];

      const recipients = await client.query(`
        SELECT c.id, c.name, c.phone, c.email, c.wa_id
        FROM contacts c
        WHERE c.workspace_id = $1
          AND c.whatsapp_account_id = $2
          AND COALESCE(c.metadata->>'opted_out', 'false') <> 'true'
          ${
            tagIds.length
              ? "AND c.id IN (SELECT ct.contact_id FROM contact_tags ct WHERE ct.tag_id = ANY($3::uuid[]) GROUP BY ct.contact_id HAVING COUNT(DISTINCT ct.tag_id) = $4)"
              : ""
          }
        ORDER BY c.created_at
      `, params);

      if (!recipients.rows.length) {
        throw new Error("No eligible recipients matched this audience.");
      }

      const startTime = scheduledFor || new Date();
      const delayMs = Math.max(1000, Math.ceil(60000 / ratePerMinute));

      const broadcast = (
        await client.query(
          "INSERT INTO broadcasts (workspace_id, whatsapp_account_id, name, body, status, scheduled_for, total_count, metadata) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id",
          [
            workspaceId,
            accountId,
            name,
            message,
            scheduledFor ? "queued" : "running",
            startTime,
            recipients.rows.length,
            JSON.stringify({ ratePerMinute, tagIds }),
          ]
        )
      ).rows[0];

      for (let index = 0; index < recipients.rows.length; index += 1) {
        const contact = recipients.rows[index];
        const renderedBody = fillTemplate(message, contact);
        const recipient = (
          await client.query(
            "INSERT INTO broadcast_recipients (broadcast_id, contact_id, chat_id, rendered_body, status) VALUES ($1, $2, COALESCE($3, $4), $5, 'queued') RETURNING id, chat_id",
            [
              broadcast.id,
              contact.id,
              contact.wa_id,
              contact.phone,
              renderedBody,
            ]
          )
        ).rows[0];

        if (!recipient.chat_id) continue;

        await client.query(
          "INSERT INTO jobs (workspace_id, whatsapp_account_id, type, status, payload, idempotency_key, run_at, max_attempts) VALUES ($1, $2, 'broadcast_send', 'queued', $3, $4, $5, 5) ON CONFLICT (workspace_id, idempotency_key) DO NOTHING",
          [
            workspaceId,
            accountId,
            JSON.stringify({
              broadcastId: broadcast.id,
              recipientId: recipient.id,
              accountId,
              chatId: recipient.chat_id,
              body: renderedBody,
            }),
            `broadcast:${broadcast.id}:${recipient.id}`,
            new Date(startTime.getTime() + index * delayMs),
          ]
        );
      }

      return { id: broadcast.id, count: recipients.rows.length };
    });

    return NextResponse.json({ broadcast: result }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to create campaign.",
      },
      { status: 400 }
    );
  }
}

export async function PATCH(request: Request) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "DATABASE_URL is required." },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const id = String(body?.id || "");
    const action = String(body?.action || "");
    const workspaceId = await getWorkspaceId();

    if (
      !workspaceId ||
      !id ||
      !["pause", "resume", "cancel"].includes(action)
    ) {
      return NextResponse.json(
        { error: "Invalid campaign action." },
        { status: 400 }
      );
    }

    const result = await withTransaction(async (client) => {
      const broadcast = await client.query(
        "SELECT id FROM broadcasts WHERE id = $1 AND workspace_id = $2 FOR UPDATE",
        [id, workspaceId]
      );
      if (!broadcast.rows[0]) throw new Error("Campaign not found.");

      if (action === "pause") {
        await client.query(
          "UPDATE broadcasts SET status = 'paused', updated_at = NOW() WHERE id = $1",
          [id]
        );
        await client.query(
          "UPDATE jobs SET status = 'cancelled', updated_at = NOW() WHERE payload->>'broadcastId' = $1 AND status IN ('queued', 'scheduled')",
          [id]
        );
        await client.query(
          "UPDATE broadcast_recipients SET status = 'pending', updated_at = NOW() WHERE broadcast_id = $1 AND status = 'queued'",
          [id]
        );
      } else if (action === "cancel") {
        await client.query(
          "UPDATE broadcasts SET status = 'cancelled', updated_at = NOW() WHERE id = $1",
          [id]
        );
        await client.query(
          "UPDATE jobs SET status = 'cancelled', updated_at = NOW() WHERE payload->>'broadcastId' = $1 AND status IN ('queued', 'scheduled')",
          [id]
        );
        await client.query(
          "UPDATE broadcast_recipients SET status = 'skipped', updated_at = NOW() WHERE broadcast_id = $1 AND status IN ('pending', 'queued')",
          [id]
        );
      } else {
        await client.query(
          "UPDATE broadcasts SET status = 'running', updated_at = NOW() WHERE id = $1",
          [id]
        );

        const pending = (
          await client.query(
            "SELECT br.id, br.chat_id, br.rendered_body, b.whatsapp_account_id FROM broadcast_recipients br JOIN broadcasts b ON b.id = br.broadcast_id WHERE br.broadcast_id = $1 AND br.status = 'pending' ORDER BY br.created_at",
            [id]
          )
        ).rows;

        for (const recipient of pending) {
          await client.query(
            "UPDATE broadcast_recipients SET status = 'queued', updated_at = NOW() WHERE id = $1",
            [recipient.id]
          );
          await client
            .query(
              "INSERT INTO jobs (workspace_id, whatsapp_account_id, type, status, payload, idempotency_key, run_at, max_attempts) VALUES ($1, $2, 'broadcast_send', 'queued', $3, $4, NOW(), 5)",
              [
                workspaceId,
                recipient.whatsapp_account_id,
                JSON.stringify({
                  broadcastId: id,
                  recipientId: recipient.id,
                  accountId: String(recipient.whatsapp_account_id),
                  chatId: recipient.chat_id,
                  body: recipient.rendered_body,
                }),
                `broadcast:${id}:${recipient.id}:resume`,
              ]
            )
            .catch(() => {});
        }
      }

      return { updated: true, id, action };
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to update campaign.",
      },
      { status: 400 }
    );
  }
}
