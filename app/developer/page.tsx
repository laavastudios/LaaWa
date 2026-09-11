"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, Copy, KeyRound, Layers3, Plus, Shield, Sparkles, Trash2, Workflow, X } from "lucide-react";
import "../developer.css";

type KeyRecord = {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  whatsappAccountIds: string[];
  expiresAt: string | null;
  revokedAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
};

type CreatedKey = KeyRecord & { secret: string };

export default function DeveloperPage() {
  const [keys, setKeys] = useState<KeyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<CreatedKey | null>(null);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({ name: "", scopes: ["read"], expiresAt: "", accountIds: "" });

  async function loadKeys() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/v1/keys", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.message || "Unable to load API keys.");
      setKeys(body.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load API keys.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadKeys(); }, []);

  function toggleScope(scope: string) {
    setForm((current) => {
      const has = current.scopes.includes(scope);
      const scopes = has ? current.scopes.filter((item) => item !== scope) : [...current.scopes, scope];
      if (scope === "admin" && !has && !scopes.includes("read")) scopes.push("read");
      if (scope === "write" && !has && !scopes.includes("read")) scopes.push("read");
      return { ...current, scopes };
    });
  }

  async function createKey() {
    if (!form.name.trim() || !form.scopes.length) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/v1/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name.trim(), scopes: form.scopes, expiresAt: form.expiresAt || null, whatsappAccountIds: form.accountIds.split(",").map((value) => value.trim()).filter(Boolean) }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.message || "Unable to create API key.");
      setCreated(body.data);
      setForm({ name: "", scopes: ["read"], expiresAt: "", accountIds: "" });
      await loadKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create API key.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    if (!window.confirm("Revoke this API key? Existing requests using it will stop working.")) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/v1/keys/${id}`, { method: "DELETE" });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.message || "Unable to revoke API key.");
      await loadKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to revoke API key.");
    } finally {
      setBusy(false);
    }
  }

  async function copySecret() {
    if (!created) return;
    await navigator.clipboard.writeText(created.secret);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <main className="developer-shell">
      <div className="developer-orb developer-orb-one" />
      <div className="developer-orb developer-orb-two" />
      <section className="developer-header">
        <div>
          <div className="developer-kicker"><Sparkles size={13} /> LaaWa Developer</div>
          <h1>API Keys</h1>
          <p>Create secure credentials for your own LaaWa instance and control exactly what each integration can access.</p>
        </div>
        <div className="developer-badge"><Shield size={15} /> Self-hosted security</div>
      </section>

      <div className="developer-quicknav"><Link href="/developer/docs">API Docs</Link><Link className="active" href="/developer/engines"><Layers3 size={14} /> Engine Control Center</Link><Link href="/developer/sdk">SDKs</Link><Link href="/developer/n8n"><Workflow size={14} /> n8n</Link></div>
      {error && <div className="developer-error">{error}</div>}

      <section className="developer-grid">
        <article className="developer-card developer-card-create">
          <div className="developer-card-title"><span className="developer-icon"><KeyRound size={19} /></span><div><h2>Create credential</h2><p>The secret is shown only once.</p></div></div>
          <label>Name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Production integration" maxLength={80} /></label>
          <div className="scope-title">Permissions</div>
          <div className="scope-grid">{["read", "write", "admin"].map((scope) => <button key={scope} type="button" className={form.scopes.includes(scope) ? "scope active" : "scope"} onClick={() => toggleScope(scope)}><span>{form.scopes.includes(scope) ? <Check size={14} /> : null}</span>{scope}</button>)}</div>
          <label>Expiration <span className="optional">optional</span><input type="datetime-local" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} /></label>
          <label>WhatsApp account restrictions <span className="optional">optional</span><input value={form.accountIds} onChange={(e) => setForm({ ...form, accountIds: e.target.value })} placeholder="Account UUIDs, comma-separated" /></label>
          <button className="developer-primary" disabled={busy || !form.name.trim() || !form.scopes.length} onClick={createKey}><Plus size={17} /> {busy ? "Creating…" : "Create API key"}</button>
        </article>

        <article className="developer-card developer-card-list">
          <div className="developer-card-title"><span className="developer-icon"><Shield size={19} /></span><div><h2>Active credentials</h2><p>Revocation takes effect immediately.</p></div></div>
          {loading ? <div className="developer-empty shimmer">Loading secure credentials…</div> : keys.length === 0 ? <div className="developer-empty"><KeyRound size={25} /><strong>No API keys yet</strong><span>Create one to connect an external application.</span></div> : <div className="key-list">{keys.map((item) => <div className={`key-item ${item.revokedAt ? "revoked" : ""}`} key={item.id}><div className="key-main"><div><strong>{item.name}</strong><code>{item.keyPrefix}••••••••</code></div><span className={item.revokedAt ? "key-status revoked-status" : "key-status"}>{item.revokedAt ? "Revoked" : "Active"}</span></div><div className="key-meta"><span>{item.scopes.join(" · ")}</span><span>{item.expiresAt ? `Expires ${new Date(item.expiresAt).toLocaleDateString()}` : "No expiration"}</span>{!item.revokedAt && <button className="revoke" disabled={busy} onClick={() => revoke(item.id)}><Trash2 size={14} /> Revoke</button>}</div></div>)}</div>}
        </article>
      </section>

      {created && <div className="secret-backdrop"><div className="secret-modal"><button className="secret-close" onClick={() => setCreated(null)} aria-label="Close"><X size={18} /></button><div className="secret-mark"><KeyRound size={23} /></div><div className="developer-kicker">Credential created</div><h2>Copy this secret now</h2><p>LaaWa never stores the plaintext secret. Once this window is closed, only its fingerprint remains visible.</p><div className="secret-box"><code>{created.secret}</code><button onClick={copySecret}>{copied ? <Check size={17} /> : <Copy size={17} />} {copied ? "Copied" : "Copy"}</button></div><button className="developer-primary" onClick={() => setCreated(null)}>I saved it securely</button></div></div>}
    </main>
  );
}
