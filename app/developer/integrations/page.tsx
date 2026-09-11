"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, Link2, PlugZap, ShieldCheck, Sparkles, Trash2, Zap } from "lucide-react";
import "./integrations.css";

type Provider = { label: string; description: string };
type Connection = { id: string; provider: keyof typeof PROVIDERS; name: string; enabled: boolean; lastTestedAt?: string | null; lastError?: string | null };
const PROVIDERS = { chatwoot: "Chatwoot", wordpress: "WordPress", webhook: "Webhooks" } as const;

export default function IntegrationsPage() {
  const [providers, setProviders] = useState<Record<string, Provider>>({});
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selected, setSelected] = useState<keyof typeof PROVIDERS>("chatwoot");
  const [name, setName] = useState("");
  const [config, setConfig] = useState<Record<string,string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function load() { const r = await fetch("/api/v1/integrations", { cache: "no-store" }); const b = await r.json(); if (r.ok) { setProviders(b.data.providers || {}); setConnections(b.data.connections || []); } }
  useEffect(() => { void load(); }, []);
  useEffect(() => { setConfig({}); setMessage(""); }, [selected]);

  const fields = selected === "chatwoot" ? [["baseUrl","Chatwoot HTTPS URL"],["accountId","Account ID"],["apiToken","API token"]] : selected === "wordpress" ? [["baseUrl","WordPress HTTPS URL"],["username","Username"],["appPassword","Application password"]] : [["url","Webhook HTTPS URL"],["secret","Signing secret"]];
  async function create() { if (!name.trim()) return; setBusy(true); setMessage(""); const r = await fetch("/api/v1/integrations", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({ provider:selected, name:name.trim(), config }) }); const b = await r.json(); setBusy(false); if (!r.ok) { setMessage(b?.error?.message || "Unable to save integration."); return; } setName(""); setConfig({}); setMessage("Integration secured. Test it from the connection card."); await load(); }
  async function test(id:string) { setBusy(true); setMessage(""); const r=await fetch(`/api/v1/integrations/${id}`,{method:"POST"}); const b=await r.json(); setBusy(false); setMessage(r.ok ? "Connection verified successfully." : b?.error?.message || "Connection test failed."); await load(); }
  async function remove(id:string) { if(!confirm("Delete this integration?")) return; setBusy(true); await fetch(`/api/v1/integrations/${id}`,{method:"DELETE"}); setBusy(false); await load(); }

  return <main className="integration-shell"><div className="integration-grid-glow"/><div className="integration-orb orb-a"/><div className="integration-orb orb-b"/>
    <header className="integration-header"><div><div className="integration-kicker"><Sparkles size={13}/> LAAVA DEVELOPER PLATFORM</div><h1>Integrations</h1><p>Connect your support desk, WordPress sites, and any HTTPS system without changing the core messaging layer.</p></div><div className="integration-secure"><ShieldCheck size={16}/> Encrypted credentials</div></header>
    <nav className="integration-nav"><Link href="/developer">API Keys</Link><Link href="/developer/docs">Docs</Link><Link href="/developer/sdk">SDKs</Link><Link href="/developer/n8n">n8n</Link><Link className="active" href="/developer/integrations"><PlugZap size={14}/> Integrations</Link></nav>
    {message && <div className="integration-message"><Check size={15}/>{message}</div>}
    <section className="integration-layout"><article className="integration-card builder"><div className="card-heading"><span className="integration-icon"><Zap size={18}/></span><div><h2>New connection</h2><p>Secrets stay server-side and encrypted at rest.</p></div></div>
      <div className="provider-tabs">{(Object.keys(PROVIDERS) as (keyof typeof PROVIDERS)[]).map(p=><button key={p} className={selected===p?"selected":""} onClick={()=>setSelected(p)}>{PROVIDERS[p]}</button>)}</div>
      <label>Connection name<input value={name} onChange={e=>setName(e.target.value)} placeholder={`${PROVIDERS[selected]} production`} maxLength={80}/></label>
      {fields.map(([key,label])=><label key={key}>{label}<input type={key.toLowerCase().includes("token")||key.toLowerCase().includes("password")||key==="secret"?"password":"text"} value={config[key]||""} onChange={e=>setConfig({...config,[key]:e.target.value})} placeholder={label}/></label>)}
      <button className="integration-primary" disabled={busy||!name.trim()} onClick={create}><Link2 size={16}/>{busy?"Securing…":"Secure connection"}</button></article>
      <article className="integration-card connections"><div className="card-heading"><span className="integration-icon"><PlugZap size={18}/></span><div><h2>Connected systems</h2><p>{connections.length} configured connection{connections.length===1?"":"s"}</p></div></div>
      {connections.length===0?<div className="integration-empty"><PlugZap size={28}/><strong>No integrations yet</strong><span>Choose a provider and create your first connection.</span></div>:connections.map(c=><div className="connection" key={c.id}><div className="connection-main"><div className="provider-mark">{c.provider==="chatwoot"?"C":c.provider==="wordpress"?"W":"↗"}</div><div><strong>{c.name}</strong><span>{PROVIDERS[c.provider]}</span></div><i className={c.enabled?"online":"offline"}>{c.enabled?"Ready":"Disabled"}</i></div><div className="connection-actions"><span>{c.lastError?"Needs attention":c.lastTestedAt?`Verified ${new Date(c.lastTestedAt).toLocaleDateString()}`:"Not tested"}</span><button disabled={busy} onClick={()=>test(c.id)}>{busy?"…":"Test"}</button><button className="delete" disabled={busy} onClick={()=>remove(c.id)}><Trash2 size={14}/></button></div></div>)}</article></section>
  </main>;
}
