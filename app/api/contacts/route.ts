import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "../auth/login/route";
import { isDatabaseConfigured, query } from "../../../lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function auth() { const c = await cookies(); return verifySession(c.get("laawa_session")?.value); }
async function workspaceId() { const r = await query<{id:string}>("SELECT id FROM workspaces ORDER BY created_at ASC LIMIT 1"); return r.rows[0]?.id; }
function clean(value: unknown, max = 500) { return typeof value === "string" ? value.trim().slice(0,max) : ""; }

export async function GET(req: Request) {
  if (!(await auth())) return NextResponse.json({error:"Unauthorized"},{status:401});
  if (!isDatabaseConfigured()) return NextResponse.json({configured:false,contacts:[],tags:[]});
  const wid = await workspaceId(); if (!wid) return NextResponse.json({configured:true,contacts:[],tags:[]});
  const url = new URL(req.url), search = clean(url.searchParams.get("search") || url.searchParams.get("q"),100), tagId=clean(url.searchParams.get("tagId"),80);
  const limit=Math.min(100,Math.max(1,Number(url.searchParams.get("limit")||50)||50)); const params:unknown[]=[wid]; const clauses=["c.workspace_id=$1"];
  if(search){params.push(`%${search}%`);clauses.push(`(COALESCE(c.name,'') ILIKE $${params.length} OR COALESCE(c.push_name,'') ILIKE $${params.length} OR COALESCE(c.phone,'') ILIKE $${params.length} OR COALESCE(c.email,'') ILIKE $${params.length})`)}
  if(tagId){params.push(tagId);clauses.push(`EXISTS (SELECT 1 FROM contact_tags xt WHERE xt.contact_id=c.id AND xt.tag_id=$${params.length})`)}
  params.push(limit);
  const contacts=await query(`SELECT c.id,c.name,c.push_name,c.phone,c.email,c.notes,c.metadata,c.created_at,c.updated_at,wa.name account_name,COALESCE(json_agg(json_build_object('id',t.id,'name',t.name) ORDER BY t.name) FILTER(WHERE t.id IS NOT NULL),'[]') tags,COALESCE(c.metadata->>'stage','new') stage,CASE WHEN c.metadata->>'value'~'^[0-9]+(\\.[0-9]+)?$' THEN (c.metadata->>'value')::numeric ELSE 0 END::float8 value,(SELECT MAX(m.created_at) FROM messages m JOIN conversations v ON v.id=m.conversation_id WHERE v.contact_id=c.id) last_message_at FROM contacts c LEFT JOIN whatsapp_accounts wa ON wa.id=c.whatsapp_account_id LEFT JOIN contact_tags ct ON ct.contact_id=c.id LEFT JOIN tags t ON t.id=ct.tag_id WHERE ${clauses.join(' AND ')} GROUP BY c.id,wa.name ORDER BY c.updated_at DESC LIMIT $${params.length}`,params);
  const tags=await query(`SELECT t.id,t.name,COUNT(ct.contact_id)::int count FROM tags t LEFT JOIN contact_tags ct ON ct.tag_id=t.id WHERE t.workspace_id=$1 GROUP BY t.id ORDER BY t.name`,[wid]);
  return NextResponse.json({configured:true,contacts:contacts.rows,tags:tags.rows});
}

export async function POST(req:Request){
  if(!(await auth()))return NextResponse.json({error:"Unauthorized"},{status:401}); if(!isDatabaseConfigured())return NextResponse.json({error:"Database is not configured."},{status:503}); const wid=await workspaceId(); if(!wid)return NextResponse.json({error:"Workspace is not configured."},{status:409});
  const body=(await req.json().catch(()=>null)) as Record<string,unknown>|null,name=clean(body?.name,160),phone=clean(body?.phone,80),email=clean(body?.email,254),notes=clean(body?.notes,4000); if(!name&&!phone&&!email)return NextResponse.json({error:"Name, phone, or email is required."},{status:400});
  const r=await query<{id:string}>(`INSERT INTO contacts(workspace_id,name,phone,email,notes,metadata) VALUES($1,$2,$3,$4,$5,'{}'::jsonb) RETURNING id`,[wid,name||null,phone||null,email||null,notes||null]); return NextResponse.json({ok:true,id:r.rows[0].id},{status:201});
}

export async function PATCH(req:Request){
  if(!(await auth()))return NextResponse.json({error:"Unauthorized"},{status:401}); if(!isDatabaseConfigured())return NextResponse.json({error:"Database is not configured."},{status:503}); const wid=await workspaceId(); if(!wid)return NextResponse.json({error:"Workspace is not configured."},{status:409});
  const body=(await req.json().catch(()=>null)) as Record<string,unknown>|null,id=clean(body?.id,80),action=clean(body?.action,40); if(!id)return NextResponse.json({error:"Contact id is required."},{status:400}); const exists=await query("SELECT id FROM contacts WHERE id=$1 AND workspace_id=$2",[id,wid]); if(!exists.rowCount)return NextResponse.json({error:"Contact not found."},{status:404});
  if(action==="tags"){const ids=Array.isArray(body?.tagIds)?body!.tagIds.filter((v):v is string=>typeof v==="string").slice(0,30):[];const valid=await query<{id:string}>("SELECT id FROM tags WHERE workspace_id=$1 AND id=ANY($2::uuid[])",[wid,ids]);await query("DELETE FROM contact_tags WHERE contact_id=$1",[id]);if(valid.rows.length)await query("INSERT INTO contact_tags(contact_id,tag_id) SELECT $1,id FROM unnest($2::uuid[]) AS id ON CONFLICT DO NOTHING",[id,valid.rows.map(r=>r.id)]);await query("UPDATE contacts SET updated_at=NOW() WHERE id=$1 AND workspace_id=$2",[id,wid]);return NextResponse.json({ok:true});}
  const name=clean(body?.name,160),phone=clean(body?.phone,80),email=clean(body?.email,254),notes=clean(body?.notes,4000);const r=await query("UPDATE contacts SET name=$1,phone=$2,email=$3,notes=$4,updated_at=NOW() WHERE id=$5 AND workspace_id=$6 RETURNING id",[name||null,phone||null,email||null,notes||null,id,wid]);return NextResponse.json({ok:Boolean(r.rowCount)});
}
