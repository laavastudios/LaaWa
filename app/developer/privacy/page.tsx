"use client";

import Link from "next/link";
import { AlertTriangle, Archive, ArrowDownToLine, Database, FileDown, Fingerprint, History, LockKeyhole, RefreshCw, RotateCcw, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import "../../developer.css";
import "./privacy.css";

type Policy = { workspaceId: string; messageRetentionDays: number; notificationRetentionDays: number; auditLogRetentionDays: number; updatedAt: string };
type Summary = { workspaceId: string; workspaceName: string; counts: Record<string, number>; oldest: { message: string | null; notification: string | null; auditLog: string | null } };
type Payload = { policy: Policy; summary: Summary };

const EMPTY: Payload = { policy: { workspaceId: "", messageRetentionDays: 0, notificationRetentionDays: 90, auditLogRetentionDays: 365, updatedAt: "" }, summary: { workspaceId: "", workspaceName: "Workspace", counts: { contacts: 0, conversations: 0, messages: 0, mediaAssets: 0, broadcasts: 0, automations: 0, integrations: 0, notifications: 0, auditLogs: 0 }, oldest: { message: null, notification: null, auditLog: null } } };

function fmt(value: number) { return new Intl.NumberFormat("en-IN", { notation: value > 9999 ? "compact" : "standard", maximumFractionDigits: 1 }).format(value); }
function age(value: string | null) { if (!value) return "No records"; return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(value)); }

export default function PrivacyPage() {
  const [data, setData] = useState<Payload>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [eraseOpen, setEraseOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/v1/privacy", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.message || "Unable to load privacy controls.");
      setData(body.data);
    } catch (err) { setError(err instanceof Error ? err.message : "Privacy controls are unavailable."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const totalRecords = useMemo(() => Object.values(data.summary.counts).reduce((sum, value) => sum + value, 0), [data.summary.counts]);
  const posture = data.policy.messageRetentionDays || data.policy.notificationRetentionDays || data.policy.auditLogRetentionDays ? "Protected" : "Manual";

  async function savePolicy() {
    setSaving(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/v1/privacy", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data.policy) });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.message || "Unable to save retention policy.");
      setData(current => ({ ...current, policy: body.data })); setNotice("Privacy policy saved.");
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to save privacy policy."); }
    finally { setSaving(false); }
  }

  async function runCleanup() {
    setRunning(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/v1/privacy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "retention" }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.message || "Retention cleanup failed.");
      const result = body.data.result;
      setNotice(`Cleanup complete — ${fmt(result.messages)} messages, ${fmt(result.notifications)} notifications and ${fmt(result.auditLogs)} audit records removed.`);
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Retention cleanup failed."); }
    finally { setRunning(false); }
  }

  async function downloadExport() {
    setExporting(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/v1/privacy/export", { cache: "no-store" });
      if (!response.ok) { const body = await response.json().catch(() => null); throw new Error(body?.error?.message || "Export failed."); }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = `laawa-privacy-export-${new Date().toISOString().slice(0, 10)}.json`; document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
      setNotice("Encrypted credentials and integration secrets are excluded from the export. Your data package is ready.");
    } catch (err) { setError(err instanceof Error ? err.message : "Export failed."); }
    finally { setExporting(false); }
  }

  async function eraseData() {
    setRunning(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/v1/privacy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "erase", confirmation }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.message || "Data erasure failed.");
      setEraseOpen(false); setConfirmation(""); setNotice("Workspace data has been erased in one transaction. The workspace shell remains available for a clean restart.");
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Data erasure failed."); }
    finally { setRunning(false); }
  }

  function setRetention(key: "messageRetentionDays" | "notificationRetentionDays" | "auditLogRetentionDays", value: string) {
    setData(current => ({ ...current, policy: { ...current.policy, [key]: Number(value) } }));
  }

  return <main className="developer-shell privacy-shell">
    <div className="developer-orb developer-orb-one"/><div className="developer-orb developer-orb-two"/>
    <div className="privacy-grid-glow"/>
    <section className="developer-header privacy-hero">
      <div><div className="developer-kicker"><Fingerprint size={13}/> LaaWa Privacy Center</div><h1>Privacy &amp; Data Controls</h1><p>Own the lifecycle of your workspace data — export it, retain only what you need, and erase it with a deliberate, transactional safeguard.</p></div>
      <div className="privacy-posture"><span className="privacy-posture-ring"><ShieldCheck size={22}/></span><div><strong>{posture}</strong><small>{loading ? "Synchronizing…" : `${fmt(totalRecords)} indexed records`}</small></div></div>
    </section>

    <nav className="developer-quicknav privacy-nav">
      <Link href="/developer/docs">API Docs</Link><Link href="/developer/engines">Engines</Link><Link href="/developer/sdk">SDKs</Link><Link href="/developer/n8n">n8n</Link><Link href="/developer/integrations">Integrations</Link><Link href="/developer/notifications">Notifications</Link><Link href="/developer/observability">Observability</Link><Link className="active" href="/developer/privacy"><LockKeyhole size={14}/> Privacy</Link>
    </nav>

    {error && <div className="developer-error privacy-alert"><AlertTriangle size={16}/>{error}</div>}
    {notice && <div className="privacy-notice"><ShieldCheck size={16}/>{notice}</div>}

    <section className="privacy-stat-grid">
      <Stat icon={<Database size={17}/>} label="Contacts" value={data.summary.counts.contacts}/><Stat icon={<Archive size={17}/>} label="Conversations" value={data.summary.counts.conversations}/><Stat icon={<Sparkles size={17}/>} label="Messages" value={data.summary.counts.messages}/><Stat icon={<History size={17}/>} label="Audit events" value={data.summary.counts.auditLogs}/>
    </section>

    <section className="privacy-main-grid">
      <article className="privacy-card privacy-policy-card">
        <div className="privacy-card-head"><div><span className="privacy-icon"><RotateCcw size={18}/></span><div><h2>Retention policy</h2><p>Automatic cleanup is opt-in per data class. Set <b>0</b> to keep it indefinitely.</p></div></div><span className="privacy-chip">Workspace · {data.summary.workspaceName}</span></div>
        <div className="privacy-fields">
          <Retention label="Messages" hint="Chat content and message metadata" value={data.policy.messageRetentionDays} onChange={value => setRetention("messageRetentionDays", value)} />
          <Retention label="Notifications" hint="Operational alert history" value={data.policy.notificationRetentionDays} onChange={value => setRetention("notificationRetentionDays", value)} />
          <Retention label="Audit events" hint="Security and administrative history" value={data.policy.auditLogRetentionDays} onChange={value => setRetention("auditLogRetentionDays", value)} />
        </div>
        <div className="privacy-card-actions"><button className="developer-primary" onClick={()=>void savePolicy()} disabled={saving || loading}>{saving ? <><RefreshCw className="privacy-spin" size={16}/> Saving…</> : <><ShieldCheck size={16}/> Save policy</>}</button><button className="privacy-secondary" onClick={()=>void runCleanup()} disabled={running || loading}>{running ? <><RefreshCw className="privacy-spin" size={15}/> Working…</> : <><RefreshCw size={15}/> Run cleanup now</>}</button></div>
        <div className="privacy-footnote">Retention changes never delete immediately. The cleanup action uses a database transaction so partial deletion cannot leave the workspace half-processed.</div>
      </article>

      <article className="privacy-card privacy-export-card">
        <div className="privacy-card-head"><div><span className="privacy-icon export"><FileDown size={18}/></span><div><h2>Personal data export</h2><p>A portable JSON snapshot of workspace-owned data.</p></div></div></div>
        <div className="export-orbit"><div className="export-core"><FileDown size={25}/><strong>EXPORT</strong><small>v1 package</small></div><i/><i/><i/></div>
        <div className="export-list"><span><ShieldCheck size={14}/> Secrets and plaintext API keys excluded</span><span><ShieldCheck size={14}/> Integration ciphertext excluded</span><span><ShieldCheck size={14}/> Messages, contacts, automations and audit history included</span></div>
        <button className="developer-primary export-button" onClick={()=>void downloadExport()} disabled={exporting || loading}>{exporting ? <><RefreshCw className="privacy-spin" size={16}/> Preparing export…</> : <><ArrowDownToLine size={16}/> Download data package</>}</button>
        <small className="export-age">Oldest message: {age(data.summary.oldest.message)} · Oldest audit event: {age(data.summary.oldest.auditLog)}</small>
      </article>
    </section>

    <section className="privacy-danger">
      <div><div className="developer-kicker"><Trash2 size={13}/> Destructive control</div><h2>Erase workspace data</h2><p>Permanently remove contacts, messages, media metadata, automations, broadcasts, integrations, notifications, credentials, settings and audit history. The workspace shell stays available so you can start clean.</p></div>
      <button className="privacy-danger-button" onClick={()=>setEraseOpen(true)} disabled={loading}><Trash2 size={16}/> Erase all data</button>
    </section>

    {eraseOpen && <div className="privacy-modal-backdrop"><div className="privacy-modal"><div className="privacy-modal-mark"><AlertTriangle size={23}/></div><div className="developer-kicker">Irreversible action</div><h2>Erase workspace data?</h2><p>This is a permanent deletion across the workspace. The operation runs inside one PostgreSQL transaction and rolls back completely if any deletion fails.</p><div className="privacy-confirm"><small>Type exactly</small><code>ERASE {data.summary.workspaceName}</code><input autoFocus value={confirmation} onChange={event=>setConfirmation(event.target.value)} placeholder={`ERASE ${data.summary.workspaceName}`}/></div><div className="privacy-modal-actions"><button className="privacy-secondary" onClick={()=>{setEraseOpen(false);setConfirmation("")}}>Cancel</button><button className="privacy-danger-button" disabled={running || confirmation !== `ERASE ${data.summary.workspaceName}`} onClick={()=>void eraseData()}>{running ? "Erasing…" : "Confirm permanent erase"}</button></div></div></div>}
  </main>;
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) { return <article className="privacy-stat"><span className="privacy-stat-icon">{icon}</span><div><small>{label}</small><strong>{fmt(value)}</strong></div><span className="privacy-stat-sheen"/></article>; }
function Retention({ label, hint, value, onChange }: { label: string; hint: string; value: number; onChange: (value: string) => void }) { return <label className="retention-field"><span><b>{label}</b><small>{hint}</small></span><div><input type="number" min="0" max="3650" step="1" value={value} onChange={event=>onChange(event.target.value)}/><em>days</em></div></label>; }
