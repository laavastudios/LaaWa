"use client";

import { useEffect, useState } from "react";
import { Activity, Bot, Check, ChevronRight, CirclePause, Clock3, Layers3, Play, Plus, Trash2, Zap } from "lucide-react";

type Rule = { id: string; name: string; enabled: boolean; conditions: Array<{ type: string; value: string }>; actions: Array<{ type: string; body: string }>; };
type Run = { id: string; name: string; status: string; result: { sent?: number }; error?: string | null; created_at: string };

const matchLabels: Record<string, string> = { contains: "Contains", exact: "Exact match", starts_with: "Starts with" };

export default function AutomationStudio() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [name, setName] = useState("");
  const [keyword, setKeyword] = useState("");
  const [reply, setReply] = useState("");
  const [match, setMatch] = useState("contains");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const response = await fetch("/api/features/automations", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load automations.");
    setRules(Array.isArray(data.rules) ? data.rules : []);
    setRuns(Array.isArray(data.runs) ? data.runs : []);
  }

  useEffect(() => { load().catch((e) => setError(e instanceof Error ? e.message : "Could not load automations.")); }, []);

  async function createRule() {
    if (!name.trim() || !keyword.trim() || !reply.trim() || busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/features/automations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, keyword, reply, match }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not create automation.");
      setRules((old) => [data.rule, ...old]);
      setName(""); setKeyword(""); setReply("");
      setNotice("Automation is live. New matching inbound messages will trigger it automatically.");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not create automation."); }
    finally { setBusy(false); }
  }

  async function toggle(rule: Rule) {
    const response = await fetch("/api/features/automations", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: rule.id, enabled: !rule.enabled }) });
    const data = await response.json();
    if (!response.ok) { setError(data.error || "Could not update automation."); return; }
    setRules((old) => old.map((item) => item.id === rule.id ? data.rule : item));
  }

  async function remove(rule: Rule) {
    const response = await fetch(`/api/features/automations?id=${encodeURIComponent(rule.id)}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok || !data.deleted) { setError(data.error || "Could not delete automation."); return; }
    setRules((old) => old.filter((item) => item.id !== rule.id));
  }

  return <section className="automation-studio">
    <div className="automation-hero glass">
      <div className="automation-orbit"><div /><div /><Zap size={26} /></div>
      <div><div className="eyebrow">PHASE 3 / AUTOMATION ENGINE</div><h2>Build replies that run themselves.</h2><p>Real inbound events → rule matching → WhatsApp reply. No browser timers, no local-only rules.</p></div>
      <div className="automation-live"><span /> ENGINE READY</div>
    </div>

    {notice && <div className="automation-notice"><Check size={15} />{notice}</div>}
    {error && <div className="automation-error">{error}</div>}

    <div className="automation-grid">
      <section className="automation-builder glass">
        <div className="automation-section-head"><div><span className="automation-kicker"><Layers3 size={14} /> RULE BUILDER</span><h3>Inbound message automation</h3><p>One clean trigger and one reply action to start. The engine is persisted server-side.</p></div><div className="automation-step"><b>01</b><span>TRIGGER</span><ChevronRight size={14} /><b>02</b><span>ACTION</span></div></div>
        <div className="automation-flow">
          <div className="automation-node trigger"><div className="node-icon"><Zap size={17} /></div><div><small>WHEN A MESSAGE ARRIVES</small><strong>Customer message</strong><span>Match incoming text against your condition.</span></div></div>
          <div className="flow-line"><i /></div>
          <div className="automation-node action"><div className="node-icon"><Bot size={17} /></div><div><small>THEN SEND</small><strong>Automatic reply</strong><span>Delivered through the connected WhatsApp worker.</span></div></div>
        </div>
        <div className="automation-form">
          <label>Rule name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Pricing enquiries" /></label>
          <label>Message condition<div className="automation-inline"><select value={match} onChange={(e) => setMatch(e.target.value)}>{Object.entries(matchLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select><input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="pricing" /></div></label>
          <label className="wide">Automatic reply<textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Thanks for reaching out. Here are our current plans…" /></label>
        </div>
        <button className="automation-primary" onClick={createRule} disabled={busy || !name.trim() || !keyword.trim() || !reply.trim()}><Plus size={16} /> {busy ? "Activating…" : "Activate automation"}</button>
      </section>

      <aside className="automation-side">
        <div className="automation-stat glass"><span><Activity size={15} /> ACTIVE RULES</span><strong>{rules.filter((r) => r.enabled).length}</strong><small>Running server-side</small></div>
        <div className="automation-stat glass"><span><Clock3 size={15} /> RECENT RUNS</span><strong>{runs.length}</strong><small>Latest 50 executions</small></div>
      </aside>
    </div>

    <section className="automation-rules glass"><div className="automation-section-head"><div><span className="automation-kicker"><Layers3 size={14} /> LIVE RULES</span><h3>Automation control room</h3></div><span className="automation-count">{rules.length} RULES</span></div>
      {!rules.length ? <div className="automation-empty"><Zap size={22} /><strong>No automation rules yet</strong><span>Create your first rule above. It will remain active after the dashboard is closed.</span></div> : <div className="automation-rule-list">{rules.map((rule) => { const condition = rule.conditions?.[0]; const action = rule.actions?.[0]; return <article className={`automation-rule ${rule.enabled ? "enabled" : "paused"}`} key={rule.id}><div className="rule-icon"><Zap size={16} /></div><div className="rule-main"><strong>{rule.name}</strong><span>When <b>{matchLabels[condition?.type] || "Contains"}</b> <em>“{condition?.value || ""}”</em></span><p>Reply: {action?.body || "No reply action"}</p></div><div className="rule-status">{rule.enabled ? "LIVE" : "PAUSED"}</div><button className="rule-toggle" onClick={() => toggle(rule)} title={rule.enabled ? "Pause" : "Activate"}>{rule.enabled ? <CirclePause size={16} /> : <Play size={16} />}</button><button className="rule-delete" onClick={() => remove(rule)} title="Delete"><Trash2 size={15} /></button></article>; })}</div>}
    </section>

    <section className="automation-runs glass"><div className="automation-section-head"><div><span className="automation-kicker"><Activity size={14} /> EXECUTION LOG</span><h3>Recent automation activity</h3></div></div>{!runs.length ? <div className="automation-empty compact"><Activity size={20} /><span>Waiting for the first matching inbound message.</span></div> : <div className="run-list">{runs.slice(0, 12).map((run) => <div className="run-row" key={run.id}><span className={`run-dot ${run.status}`} /><b>{run.name}</b><span>{run.status}</span><small>{run.result?.sent ? `${run.result.sent} reply sent` : run.error || "Completed"}</small><time>{new Date(run.created_at).toLocaleString()}</time></div>)}</div>}</section>
  </section>;
}
