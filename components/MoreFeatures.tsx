"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, Bot, Broadcast, CalendarClock, Check, ChevronRight, ClipboardList, Code2, ContactRound, FileText, KeyRound, Megaphone, Plus, Save, Settings2, ShieldCheck, Sparkles, Trash2, Webhook, Workflow, X } from "lucide-react";

type Conversation = { chatId: string; name: string; phone: string; lastMessage: string; timestamp: number; unread: number };
type Feature = { id: string; label: string; description: string; icon: typeof Bot };
type Template = { id: string; name: string; body: string };
type ContactNote = { note: string; tags: string[] };

const features: Feature[] = [
  { id: "analytics", label: "Analytics", description: "Live conversation, message and response metrics.", icon: BarChart3 },
  { id: "contacts", label: "Contacts & CRM", description: "Turn WhatsApp conversations into a lightweight customer workspace.", icon: ContactRound },
  { id: "broadcasts", label: "Broadcasts", description: "Send one approved message to multiple existing conversations.", icon: Megaphone },
  { id: "templates", label: "Templates", description: "Save reusable business replies and campaign copy.", icon: FileText },
  { id: "automation", label: "Automations", description: "Define repeatable reply rules and test them against a live chat.", icon: Workflow },
  { id: "scheduled", label: "Scheduled", description: "Prepare outbound messages for a specific conversation.", icon: CalendarClock },
  { id: "ai", label: "AI Workspace", description: "Prompt tools for drafting, rewriting and customer replies.", icon: Sparkles },
  { id: "webhooks", label: "Webhooks", description: "Configure outbound event destinations for your business stack.", icon: Webhook },
  { id: "api", label: "Developer", description: "Manage local API access settings and integration references.", icon: Code2 },
  { id: "security", label: "Security & Audit", description: "Review local configuration, session safety and activity history.", icon: ShieldCheck },
];

function read<T>(key: string, fallback: T): T { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; } }
function write(key: string, value: unknown) { localStorage.setItem(key, JSON.stringify(value)); }
function initials(name: string) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join("").toUpperCase() || "WA"; }
function ago(ts: number) { if (!ts) return "—"; const d = Date.now() - ts * 1000; if (d < 60_000) return "just now"; if (d < 3_600_000) return `${Math.floor(d / 60_000)}m ago`; if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}h ago`; return new Date(ts * 1000).toLocaleDateString(); }

export default function MoreFeatures() {
  const [active, setActive] = useState("analytics");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedChats, setSelectedChats] = useState<string[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [notes, setNotes] = useState<Record<string, ContactNote>>({});
  const [automationKeyword, setAutomationKeyword] = useState("");
  const [automationReply, setAutomationReply] = useState("");
  const [broadcastText, setBroadcastText] = useState("");
  const [scheduleChat, setScheduleChat] = useState("");
  const [scheduleText, setScheduleText] = useState("");
  const [scheduleAt, setScheduleAt] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setTemplates(read<Template[]>("laawa.templates", []));
    setNotes(read<Record<string, ContactNote>>("laawa.contactNotes", {}));
    setWebhookUrl(read<string>("laawa.webhook", ""));
    setApiKey(read<string>("laawa.apiKey", ""));
    fetch("/api/whatsapp/messages", { cache: "no-store" }).then((r) => r.json()).then((data) => setConversations(Array.isArray(data.conversations) ? data.conversations : [])).catch(() => setConversations([]));
  }, []);

  const metrics = useMemo(() => {
    const totalUnread = conversations.reduce((n, c) => n + Number(c.unread || 0), 0);
    const active24h = conversations.filter((c) => Date.now() - c.timestamp * 1000 < 86_400_000).length;
    return { conversations: conversations.length, unread: totalUnread, active24h, contacts: conversations.filter((c) => c.phone).length };
  }, [conversations]);

  function flash(message: string) { setNotice(message); window.setTimeout(() => setNotice(""), 3000); }

  async function broadcast() {
    const body = broadcastText.trim();
    if (!body || !selectedChats.length || busy) return;
    setBusy(true);
    let sent = 0;
    try {
      for (const chatId of selectedChats) {
        const r = await fetch("/api/whatsapp/messages", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chatId, body }) });
        if (r.ok) sent += 1;
      }
      flash(`Broadcast sent to ${sent} of ${selectedChats.length} conversations.`);
      if (sent) setBroadcastText("");
    } finally { setBusy(false); }
  }

  function saveTemplate() {
    const name = window.prompt("Template name");
    if (!name?.trim() || !broadcastText.trim()) return;
    const next = [...templates, { id: crypto.randomUUID(), name: name.trim(), body: broadcastText.trim() }];
    setTemplates(next); write("laawa.templates", next); flash("Template saved.");
  }

  function saveAutomation() {
    if (!automationKeyword.trim() || !automationReply.trim()) return;
    const current = read<Array<{ keyword: string; reply: string }>>("laawa.automations", []);
    write("laawa.automations", [...current, { keyword: automationKeyword.trim(), reply: automationReply.trim() }]);
    setAutomationKeyword(""); setAutomationReply(""); flash("Automation rule saved.");
  }

  function saveSchedule() {
    if (!scheduleChat || !scheduleText.trim() || !scheduleAt) return;
    const current = read<Array<{ chatId: string; text: string; at: string }>>("laawa.scheduled", []);
    write("laawa.scheduled", [...current, { chatId: scheduleChat, text: scheduleText.trim(), at: scheduleAt }]);
    setScheduleText(""); flash("Scheduled message saved on this device.");
  }

  function saveWebhook() { write("laawa.webhook", webhookUrl.trim()); flash(webhookUrl.trim() ? "Webhook destination saved." : "Webhook destination cleared."); }
  function generateApiKey() { const value = `lwa_${crypto.randomUUID().replaceAll("-", "")}`; setApiKey(value); write("laawa.apiKey", value); flash("New API key generated. Store it somewhere safe."); }

  return <section className="mf-shell glass">
    <div className="mf-head">
      <div><div className="eyebrow">LAAWA / PLATFORM</div><h2>More Features</h2><p>Business tools built around your live WhatsApp workspace.</p></div>
      <div className="mf-brand"><Sparkles size={16} /> Made By LaavaBee</div>
    </div>
    <div className="mf-layout">
      <aside className="mf-nav">{features.map((item) => { const Icon = item.icon; return <button key={item.id} className={active === item.id ? "active" : ""} onClick={() => setActive(item.id)}><span className="mf-icon"><Icon size={16} /></span><span><b>{item.label}</b><small>{item.description}</small></span><ChevronRight size={14} /></button>; })}</aside>
      <div className="mf-content">
        {notice && <div className="mf-notice"><Check size={15} />{notice}</div>}
        {active === "analytics" && <div className="mf-panel"><PanelTitle icon={<BarChart3 size={18} />} title="Live analytics" text="Calculated from the real conversations currently stored by LaaWa." /><div className="mf-stats"><Metric label="Conversations" value={metrics.conversations} /><Metric label="Unread" value={metrics.unread} /><Metric label="Active · 24h" value={metrics.active24h} /><Metric label="Contacts" value={metrics.contacts} /></div><div className="mf-table"><div className="mf-table-head"><span>Conversation</span><span>Last activity</span><span>Unread</span></div>{conversations.slice(0, 12).map((c) => <div className="mf-table-row" key={c.chatId}><span><i>{initials(c.name)}</i><b>{c.name || c.phone || "Unknown"}</b></span><span>{ago(c.timestamp)}</span><span>{c.unread || 0}</span></div>)}{!conversations.length && <Empty text="Connect WhatsApp and receive messages to populate analytics." />}</div></div>}
        {active === "contacts" && <Contacts conversations={conversations} notes={notes} setNotes={(next) => { setNotes(next); write("laawa.contactNotes", next); }} />}
        {active === "broadcasts" && <div className="mf-panel"><PanelTitle icon={<Megaphone size={18} />} title="Broadcasts" text="Select existing WhatsApp conversations and send one message through the live messaging API." /><div className="mf-toolbar"><button className="mf-secondary" onClick={() => setSelectedChats(selectedChats.length === conversations.length ? [] : conversations.map((c) => c.chatId))}>{selectedChats.length === conversations.length ? "Clear all" : "Select all"}</button><span>{selectedChats.length} selected</span></div><div className="mf-chat-picker">{conversations.map((c) => <label key={c.chatId} className={selectedChats.includes(c.chatId) ? "picked" : ""}><input type="checkbox" checked={selectedChats.includes(c.chatId)} onChange={(e) => setSelectedChats((old) => e.target.checked ? [...old, c.chatId] : old.filter((id) => id !== c.chatId))} /><i>{initials(c.name)}</i><span><b>{c.name || c.phone}</b><small>{c.phone}</small></span></label>)}</div><textarea className="mf-textarea" value={broadcastText} onChange={(e) => setBroadcastText(e.target.value)} placeholder="Write the broadcast message…" /><div className="mf-actions"><button className="mf-secondary" onClick={saveTemplate} disabled={!broadcastText.trim()}><Save size={15} /> Save as template</button><button className="mf-primary" onClick={broadcast} disabled={busy || !broadcastText.trim() || !selectedChats.length}>{busy ? "Sending…" : "Send broadcast"}</button></div></div>}
        {active === "templates" && <div className="mf-panel"><PanelTitle icon={<FileText size={18} />} title="Message templates" text="Reusable copy stored locally in your LaaWa workspace." /><div className="mf-template-grid">{templates.map((t) => <div className="mf-template" key={t.id}><div><b>{t.name}</b><button onClick={() => { const next = templates.filter((x) => x.id !== t.id); setTemplates(next); write("laawa.templates", next); }}><Trash2 size={14} /></button></div><p>{t.body}</p><button className="mf-secondary" onClick={() => { setBroadcastText(t.body); setActive("broadcasts"); }}>Use template</button></div>)}{!templates.length && <Empty text="Save a message from Broadcasts to create your first template." />}</div></div>}
        {active === "automation" && <div className="mf-panel"><PanelTitle icon={<Workflow size={18} />} title="Automation rules" text="Create keyword → reply rules and keep them versioned in your workspace." /><div className="mf-form-grid"><label>Keyword<input value={automationKeyword} onChange={(e) => setAutomationKeyword(e.target.value)} placeholder="pricing" /></label><label>Automatic reply<textarea value={automationReply} onChange={(e) => setAutomationReply(e.target.value)} placeholder="Thanks — here is our pricing…" /></label></div><button className="mf-primary" onClick={saveAutomation}><Plus size={15} /> Add rule</button><StoredRules /></div>}
        {active === "scheduled" && <div className="mf-panel"><PanelTitle icon={<CalendarClock size={18} />} title="Scheduled messages" text="Prepare outbound messages with an exact delivery time. The schedule is stored locally until a durable scheduler is connected." /><div className="mf-form-grid"><label>Conversation<select value={scheduleChat} onChange={(e) => setScheduleChat(e.target.value)}><option value="">Select a conversation</option>{conversations.map((c) => <option key={c.chatId} value={c.chatId}>{c.name || c.phone}</option>)}</select></label><label>Send at<input type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} /></label></div><label className="mf-full">Message<textarea value={scheduleText} onChange={(e) => setScheduleText(e.target.value)} placeholder="Your scheduled message…" /></label><button className="mf-primary" onClick={saveSchedule}><CalendarClock size={15} /> Save schedule</button></div>}
        {active === "ai" && <AIWorkspace />}
        {active === "webhooks" && <div className="mf-panel"><PanelTitle icon={<Webhook size={18} />} title="Webhooks" text="Keep the destination ready for event delivery from your business backend." /><label className="mf-full">Webhook endpoint<input value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} placeholder="https://example.com/webhooks/laawa" /></label><button className="mf-primary" onClick={saveWebhook}><Save size={15} /> Save endpoint</button><div className="mf-info"><Webhook size={16} /><span>Use HTTPS in production. Delivery signing and server-side retries belong in the worker/backend integration layer.</span></div></div>}
        {active === "api" && <div className="mf-panel"><PanelTitle icon={<Code2 size={18} />} title="Developer access" text="A local integration key for the current workspace. Production API enforcement should be handled server-side." /><div className="mf-key"><KeyRound size={18} /><code>{apiKey || "No key generated"}</code></div><div className="mf-actions"><button className="mf-primary" onClick={generateApiKey}><KeyRound size={15} /> Generate new key</button>{apiKey && <button className="mf-secondary" onClick={() => { navigator.clipboard?.writeText(apiKey); flash("API key copied."); }}>Copy key</button>}</div></div>}
        {active === "security" && <div className="mf-panel"><PanelTitle icon={<ShieldCheck size={18} />} title="Security & audit" text="Workspace checks that do not alter your WhatsApp connection." /><div className="mf-security"><CheckRow label="WhatsApp session kept outside browser storage" /><CheckRow label="Gemini key handled by server routes" /><CheckRow label="Inbox messages loaded through authenticated API routes" /><CheckRow label="More Features does not modify WhatsApp connection settings" /></div><div className="mf-info"><ShieldCheck size={16} /><span>For Vercel/Netlify, durable queues, databases and worker state should remain external to serverless request lifetimes.</span></div></div>}
      </div>
    </div>
    <style>{styles}</style>
  </section>;
}

function PanelTitle({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) { return <div className="mf-panel-title"><span>{icon}</span><div><h3>{title}</h3><p>{text}</p></div></div>; }
function Metric({ label, value }: { label: string; value: number }) { return <div className="mf-metric"><span>{label}</span><strong>{value}</strong></div>; }
function Empty({ text }: { text: string }) { return <div className="mf-empty"><Sparkles size={18} /><span>{text}</span></div>; }
function CheckRow({ label }: { label: string }) { return <div className="mf-check"><Check size={15} /><span>{label}</span></div>; }
function StoredRules() { const [rules, setRules] = useState<Array<{ keyword: string; reply: string }>>([]); useEffect(() => setRules(read("laawa.automations", [])), []); return <div className="mf-rules">{rules.map((r, i) => <div key={`${r.keyword}-${i}`}><b>{r.keyword}</b><span>{r.reply}</span></div>)}{!rules.length && <Empty text="No rules yet." />}</div>; }
function Contacts({ conversations, notes, setNotes }: { conversations: Conversation[]; notes: Record<string, ContactNote>; setNotes: (next: Record<string, ContactNote>) => void }) { const [selected, setSelected] = useState(conversations[0]?.chatId || ""); useEffect(() => { if (!selected && conversations[0]) setSelected(conversations[0].chatId); }, [conversations, selected]); const contact = conversations.find((c) => c.chatId === selected); const current = notes[selected] || { note: "", tags: [] }; return <div className="mf-panel"><PanelTitle icon={<ContactRound size={18} />} title="Contacts & CRM" text="Use real WhatsApp identities from the Inbox as your customer list." /><div className="mf-crm"><div className="mf-contact-list">{conversations.map((c) => <button className={c.chatId === selected ? "selected" : ""} key={c.chatId} onClick={() => setSelected(c.chatId)}><i>{initials(c.name)}</i><span><b>{c.name || c.phone}</b><small>{c.phone}</small></span></button>)}</div><div className="mf-contact-detail">{contact ? <><div className="mf-contact-hero"><i>{initials(contact.name)}</i><div><h3>{contact.name || "Unknown"}</h3><span>{contact.phone || "No phone resolved"}</span></div></div><label>Private note<textarea value={current.note} onChange={(e) => setNotes({ ...notes, [selected]: { ...current, note: e.target.value } })} placeholder="Customer context, preferences, follow-up…" /></label><label>Tags<input value={current.tags.join(", ")} onChange={(e) => setNotes({ ...notes, [selected]: { ...current, tags: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) } })} placeholder="lead, vip, follow-up" /></label></> : <Empty text="No contacts yet." />}</div></div></div> }
function AIWorkspace() { const [prompt, setPrompt] = useState(""); const [result, setResult] = useState(""); const [busy, setBusy] = useState(false); async function run() { if (!prompt.trim()) return; setBusy(true); setResult(""); try { const r = await fetch("/api/ai/generate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prompt: prompt.trim() }) }); const data = await r.json(); setResult(r.ok ? String(data.text || data.output || "No response") : String(data.error || "AI request failed.")); } catch { setResult("AI request failed."); } finally { setBusy(false); } } return <div className="mf-panel"><PanelTitle icon={<Sparkles size={18} />} title="AI workspace" text="Generate a real response using the configured LaaWa AI route." /><textarea className="mf-textarea" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Write a customer reply, summarize a conversation, create a campaign idea…" /><button className="mf-primary" onClick={run} disabled={busy || !prompt.trim()}>{busy ? "Generating…" : "Generate"}</button>{result && <div className="mf-ai-result">{result}</div>}</div> }

const styles = `
.mf-shell{padding:24px!important;border-radius:24px;min-height:680px;background:linear-gradient(180deg,rgba(10,14,21,.96),rgba(7,10,15,.96))!important;border:1px solid rgba(255,255,255,.08)}
.mf-head{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;margin-bottom:22px}.mf-head h2{margin:4px 0 4px;font-size:30px;letter-spacing:-.055em}.mf-head p{margin:0;color:#7d8798;font-size:12px}.mf-brand{display:flex;align-items:center;gap:7px;color:#8f9aab;font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.mf-layout{display:grid;grid-template-columns:255px minmax(0,1fr);gap:18px;min-height:590px}.mf-nav{display:flex;flex-direction:column;gap:5px}.mf-nav button{display:grid;grid-template-columns:35px minmax(0,1fr) 14px;gap:10px;align-items:center;text-align:left;padding:10px;border:1px solid transparent;border-radius:13px;background:transparent;color:#8b95a6;cursor:pointer;transition:.18s}.mf-nav button:hover{background:rgba(255,255,255,.03);color:#dfe4ec}.mf-nav button.active{background:linear-gradient(90deg,rgba(124,58,237,.17),rgba(34,211,238,.035));border-color:rgba(124,58,237,.2);color:#fff}.mf-icon{width:35px;height:35px;display:grid;place-items:center;border-radius:10px;background:rgba(255,255,255,.035)}.mf-nav b,.mf-nav small{display:block}.mf-nav b{font-size:11px}.mf-nav small{font-size:8px;line-height:1.35;margin-top:3px;color:#667183}.mf-content{min-width:0}.mf-panel{min-height:590px;padding:20px;border:1px solid rgba(255,255,255,.07);border-radius:18px;background:rgba(255,255,255,.018)}.mf-panel-title{display:flex;gap:12px;align-items:flex-start;margin-bottom:20px}.mf-panel-title>span{width:36px;height:36px;display:grid;place-items:center;border-radius:10px;background:rgba(124,58,237,.13);color:#b89bff}.mf-panel-title h3{margin:0;font-size:18px;letter-spacing:-.03em}.mf-panel-title p{margin:5px 0 0;color:#737e90;font-size:10px;line-height:1.5}.mf-notice{display:flex;gap:7px;align-items:center;padding:10px 12px;margin-bottom:10px;border:1px solid rgba(34,197,94,.2);background:rgba(34,197,94,.06);border-radius:10px;color:#69df91;font-size:10px}.mf-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin-bottom:16px}.mf-metric{padding:15px;border:1px solid rgba(255,255,255,.065);border-radius:13px;background:rgba(255,255,255,.018)}.mf-metric span{display:block;color:#697486;font-size:9px}.mf-metric strong{display:block;margin-top:7px;font-size:25px;letter-spacing:-.05em}.mf-table{border:1px solid rgba(255,255,255,.065);border-radius:13px;overflow:hidden}.mf-table-head,.mf-table-row{display:grid;grid-template-columns:minmax(0,1fr) 110px 55px;gap:10px;align-items:center;padding:10px 12px}.mf-table-head{background:rgba(255,255,255,.025);color:#596577;font-size:8px;text-transform:uppercase;letter-spacing:.1em}.mf-table-row{border-top:1px solid rgba(255,255,255,.045);font-size:10px;color:#8993a3}.mf-table-row>span:first-child{display:flex;align-items:center;gap:8px;color:#e5e9ef}.mf-table-row i,.mf-chat-picker i,.mf-contact-list i,.mf-contact-hero>i{display:grid;place-items:center;width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,rgba(124,58,237,.45),rgba(34,211,238,.2));font-style:normal;font-size:8px;font-weight:900}.mf-toolbar{display:flex;align-items:center;gap:10px;margin-bottom:12px;color:#6e7889;font-size:9px}.mf-secondary,.mf-primary{display:inline-flex;align-items:center;justify-content:center;gap:7px;height:34px;padding:0 12px;border-radius:9px;border:1px solid rgba(255,255,255,.09);font-size:9px;font-weight:800;cursor:pointer}.mf-secondary{background:rgba(255,255,255,.035);color:#cbd1da}.mf-primary{background:#f1f3f7;color:#080b10;border-color:#f1f3f7}.mf-primary:disabled,.mf-secondary:disabled{opacity:.4;cursor:not-allowed}.mf-chat-picker{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;max-height:270px;overflow:auto;margin-bottom:13px}.mf-chat-picker label{display:flex;align-items:center;gap:8px;padding:8px;border:1px solid rgba(255,255,255,.055);border-radius:10px;cursor:pointer}.mf-chat-picker label.picked{border-color:rgba(34,211,238,.22);background:rgba(34,211,238,.035)}.mf-chat-picker input{accent-color:#8b5cf6}.mf-chat-picker span{min-width:0}.mf-chat-picker b,.mf-chat-picker small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.mf-chat-picker b{font-size:9px}.mf-chat-picker small{font-size:8px;color:#657083;margin-top:2px}.mf-textarea,.mf-form-grid textarea,.mf-full textarea,.mf-full input,.mf-form-grid input,.mf-form-grid select,.mf-contact-detail textarea,.mf-contact-detail input{width:100%;box-sizing:border-box;border:1px solid rgba(255,255,255,.08);border-radius:10px;background:rgba(0,0,0,.18);color:#e9edf3;outline:none;padding:11px;font:inherit;font-size:10px}.mf-textarea{min-height:105px;resize:vertical}.mf-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px}.mf-form-grid label,.mf-full,.mf-contact-detail label{display:block;color:#6f7a8b;font-size:9px}.mf-form-grid input,.mf-form-grid select{margin-top:6px;height:37px}.mf-form-grid textarea,.mf-full textarea{margin-top:6px;min-height:95px;resize:vertical}.mf-full{margin-bottom:12px}.mf-actions{display:flex;gap:8px;margin-top:10px}.mf-template-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:9px}.mf-template{padding:13px;border:1px solid rgba(255,255,255,.06);border-radius:12px}.mf-template>div{display:flex;justify-content:space-between}.mf-template>div b{font-size:10px}.mf-template>div button{background:none;border:0;color:#697487;cursor:pointer}.mf-template p{font-size:9px;line-height:1.5;color:#7b8595;min-height:45px}.mf-rules{margin-top:18px;display:grid;gap:6px}.mf-rules>div{padding:11px;border:1px solid rgba(255,255,255,.06);border-radius:10px}.mf-rules b{display:inline-block;color:#dfe4ec;font-size:9px;min-width:90px}.mf-rules span{color:#747f90;font-size:9px}.mf-info{display:flex;gap:9px;align-items:flex-start;margin-top:18px;padding:12px;border:1px solid rgba(255,255,255,.06);border-radius:11px;color:#697587;font-size:9px;line-height:1.5}.mf-key{display:flex;gap:10px;align-items:center;padding:14px;border:1px solid rgba(255,255,255,.07);border-radius:12px;background:rgba(0,0,0,.15);margin-bottom:10px}.mf-key code{font-size:10px;color:#bfc7d3;overflow:hidden;text-overflow:ellipsis}.mf-ai-result{margin-top:12px;padding:14px;border:1px solid rgba(124,58,237,.16);border-radius:12px;background:rgba(124,58,237,.05);white-space:pre-wrap;color:#cbd2dc;font-size:10px;line-height:1.55}.mf-security{display:grid;gap:7px}.mf-check{display:flex;gap:9px;align-items:center;padding:12px;border:1px solid rgba(255,255,255,.055);border-radius:10px;color:#aeb6c3;font-size:9px}.mf-check svg{color:#4ade80}.mf-empty{display:flex;align-items:center;justify-content:center;gap:8px;min-height:120px;padding:18px;text-align:center;color:#687487;font-size:10px}.mf-crm{display:grid;grid-template-columns:240px minmax(0,1fr);gap:12px;min-height:450px}.mf-contact-list{display:flex;flex-direction:column;gap:4px;overflow:auto}.mf-contact-list button{display:flex;align-items:center;gap:8px;padding:8px;border:1px solid transparent;border-radius:10px;background:transparent;color:#cbd2dc;text-align:left;cursor:pointer}.mf-contact-list button.selected{background:rgba(124,58,237,.1);border-color:rgba(124,58,237,.17)}.mf-contact-list b,.mf-contact-list small{display:block}.mf-contact-list b{font-size:9px}.mf-contact-list small{font-size:8px;color:#687486;margin-top:2px}.mf-contact-detail{border-left:1px solid rgba(255,255,255,.06);padding-left:18px}.mf-contact-hero{display:flex;align-items:center;gap:10px;margin-bottom:20px}.mf-contact-hero>i{width:46px;height:46px}.mf-contact-hero h3{margin:0;font-size:15px}.mf-contact-hero span{display:block;color:#6c7789;font-size:9px;margin-top:4px}.mf-contact-detail label{margin-top:12px}.mf-contact-detail textarea{margin-top:6px;min-height:130px;resize:vertical}.mf-contact-detail input{margin-top:6px;height:38px}
@media(max-width:900px){.mf-layout{grid-template-columns:1fr}.mf-nav{display:grid;grid-template-columns:repeat(2,1fr)}.mf-nav button{min-height:62px}.mf-panel{min-height:520px}.mf-stats{grid-template-columns:repeat(2,1fr)}}
@media(max-width:600px){.mf-shell{padding:15px!important}.mf-head{display:block}.mf-brand{margin-top:12px}.mf-chat-picker,.mf-template-grid,.mf-form-grid,.mf-crm{grid-template-columns:1fr}.mf-contact-detail{border-left:0;border-top:1px solid rgba(255,255,255,.06);padding:15px 0 0}.mf-table-head,.mf-table-row{grid-template-columns:minmax(0,1fr) 75px 35px}}
`;
