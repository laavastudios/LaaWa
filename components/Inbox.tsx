"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Media = { data?: string; mimetype?: string; filename?: string; kind?: string; voice?: boolean } | null;
type Conversation = { chatId: string; name: string; phone: string; avatar?: string | null; lastMessage: string; timestamp: number; unread: number; isBusiness?: boolean };
type Message = { id: string; chatId: string; body: string; timestamp: number; fromMe: boolean; name: string; phone: string; avatar?: string | null; read: boolean; type?: string; hasMedia?: boolean; media?: Media };

function time(ts: number) { return ts ? new Date(ts * 1000).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : ""; }
function day(ts: number) { return ts ? new Date(ts * 1000).toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" }) : ""; }
function channel(id: string) { return id.includes("@newsletter"); }
function nameOf(item?: Conversation | Message, fallback = "Unknown") { const n = String(item?.name || "").trim(); return n && !n.includes("@lid") && !n.includes("@c.us") ? n : item?.phone ? `+${item.phone.replace(/^\+/, "")}` : fallback; }
function phoneOf(item?: Conversation | Message) { if (!item || channel(item.chatId) || !item.phone) return ""; return `+${item.phone.replace(/^\+/, "")}`; }
function initials(name: string) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join("").toUpperCase() || "WA"; }
function kindFor(file: File) { if (file.type.startsWith("image/")) return "image"; if (file.type.startsWith("video/")) return "video"; if (file.type.startsWith("audio/")) return "audio"; return "document"; }

function Avatar({ name, src, large = false }: { name: string; src?: string | null; large?: boolean }) {
  const [bad, setBad] = useState(false);
  if (src && !bad) return <img className={`wa-avatar ${large ? "large" : ""}`} src={src} alt="" onError={() => setBad(true)} />;
  return <div className={`wa-avatar fallback ${large ? "large" : ""}`}>{initials(name)}</div>;
}

export default function Inbox() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selected, setSelected] = useState("");
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [live, setLive] = useState(false);
  const [error, setError] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const selectedRef = useRef("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { selectedRef.current = selected; }, [selected]);
  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); mediaRecorderRef.current?.stream.getTracks().forEach((t) => t.stop()); }, []);

  async function loadConversations(keepSelection = true) {
    try {
      const r = await fetch("/api/whatsapp/messages", { cache: "no-store" });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Could not load inbox.");
      const next = Array.isArray(data.conversations) ? data.conversations : [];
      setConversations(next);
      setSelected((current) => keepSelection && current && next.some((c: Conversation) => c.chatId === current) ? current : (next[0]?.chatId || ""));
      setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load inbox."); }
    finally { setLoading(false); }
  }

  async function loadMessages(chatId: string, scroll = false) {
    if (!chatId) { setMessages([]); return; }
    try {
      const r = await fetch(`/api/whatsapp/messages?chatId=${encodeURIComponent(chatId)}`, { cache: "no-store" });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Could not load conversation.");
      setMessages(Array.isArray(data.messages) ? data.messages : []);
      setError("");
      if (scroll) requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load conversation."); }
  }

  useEffect(() => {
    void loadConversations(false);
    const source = new EventSource("/api/whatsapp/events");
    source.addEventListener("open", () => setLive(true));
    source.addEventListener("state", () => void loadConversations(true));
    source.addEventListener("snapshot", () => void loadConversations(true));
    source.addEventListener("message", () => { void loadConversations(true); if (selectedRef.current) void loadMessages(selectedRef.current, true); });
    source.addEventListener("sync", () => { void loadConversations(true); if (selectedRef.current) void loadMessages(selectedRef.current, false); });
    source.onerror = () => setLive(false);
    return () => source.close();
  }, []);

  useEffect(() => { void loadMessages(selected); }, [selected]);

  async function sendMessage() {
    if (!selected || sending || recording) return;
    const body = text.trim();
    if (!body && !file) return;
    setSending(true); setError("");
    try {
      let response: Response;
      if (file) {
        const form = new FormData(); form.append("chatId", selected); form.append("body", body); form.append("file", file); form.append("kind", kindFor(file));
        response = await fetch("/api/whatsapp/messages", { method: "POST", body: form });
      } else response = await fetch("/api/whatsapp/messages", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chatId: selected, body }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Message could not be sent.");
      setText(""); setFile(null); if (fileRef.current) fileRef.current.value = "";
      await loadMessages(selected, true); await loadConversations(true);
    } catch (e) { setError(e instanceof Error ? e.message : "Message could not be sent."); }
    finally { setSending(false); }
  }

  async function startRecording() {
    if (recording || sending || !selected) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferred = ["audio/ogg;codecs=opus", "audio/webm;codecs=opus", "audio/webm"].find((x) => MediaRecorder.isTypeSupported(x));
      const recorder = new MediaRecorder(stream, preferred ? { mimeType: preferred } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop()); if (timerRef.current) clearInterval(timerRef.current);
        setRecording(false); setRecordSeconds(0);
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" }); if (!blob.size) return;
        const ext = blob.type.includes("ogg") ? "ogg" : "webm";
        setSending(true); setError("");
        try {
          const form = new FormData(); form.append("chatId", selected); form.append("file", new File([blob], `Voice-${Date.now()}.${ext}`, { type: blob.type || "audio/webm" })); form.append("kind", "audio"); form.append("voice", "true");
          const response = await fetch("/api/whatsapp/messages", { method: "POST", body: form }); const data = await response.json();
          if (!response.ok) throw new Error(data.error || "Voice message could not be sent.");
          await loadMessages(selected, true); await loadConversations(true);
        } catch (e) { setError(e instanceof Error ? e.message : "Voice message could not be sent."); }
        finally { setSending(false); }
      };
      mediaRecorderRef.current = recorder; recorder.start(); setRecording(true); setRecordSeconds(0);
      timerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    } catch { setError("Microphone permission is required to record a voice message."); }
  }

  function stopRecording() { mediaRecorderRef.current?.stop(); }
  function onKey(e: React.KeyboardEvent<HTMLInputElement>) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendMessage(); } }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => `${nameOf(c)} ${phoneOf(c)} ${c.lastMessage}`.toLowerCase().includes(q));
  }, [conversations, search]);
  const current = useMemo(() => conversations.find((c) => c.chatId === selected), [conversations, selected]);
  const title = nameOf(current, channel(selected) ? "WhatsApp Channel" : "Conversation");
  const phone = phoneOf(current);

  const renderedMessages = useMemo(() => {
    const out: React.ReactNode[] = [];
    let previousDay = "";
    for (const m of messages) {
      const d = day(m.timestamp);
      if (d !== previousDay) { out.push(<div className="wa-day" key={`day-${m.id}`}><span>{d}</span></div>); previousDay = d; }
      out.push(
        <div className={`wa-message ${m.fromMe ? "mine" : "theirs"}`} key={m.id}>
          {!m.fromMe && <Avatar name={nameOf(m)} src={m.avatar} />}
          <div className="wa-bubble-wrap">
            {!m.fromMe && <div className="wa-sender">{nameOf(m)}</div>}
            <div className="wa-bubble">
              {m.hasMedia && m.media?.data ? <div className="wa-media">{m.media.mimetype?.startsWith("image/") ? <img src={`data:${m.media.mimetype};base64,${m.media.data}`} alt="" /> : m.media.mimetype?.startsWith("video/") ? <video controls src={`data:${m.media.mimetype};base64,${m.media.data}`} /> : m.media.mimetype?.startsWith("audio/") ? <audio controls src={`data:${m.media.mimetype};base64,${m.media.data}`} /> : <div className="wa-file"><b>FILE</b><span>{m.media.filename || "Document"}</span></div>}</div> : null}
              {m.body ? <div className="wa-body">{m.body}</div> : null}
              <div className="wa-time">{time(m.timestamp)}{m.fromMe ? "  ✓✓" : ""}</div>
            </div>
          </div>
        </div>
      );
    }
    return out;
  }, [messages]);

  return <section className="wa-inbox glass">
    <style>{`
      .wa-inbox{height:680px;min-height:680px;width:100%;padding:0!important;overflow:hidden;border-radius:24px;background:#070a0f!important;border:1px solid rgba(255,255,255,.09);box-shadow:0 30px 90px rgba(0,0,0,.35)}
      .wa-grid{height:100%;display:grid;grid-template-columns:320px minmax(0,1fr);min-width:0}.wa-sidebar{display:flex;flex-direction:column;min-width:0;border-right:1px solid rgba(255,255,255,.075);background:linear-gradient(180deg,#0a0e14,#080b10)}.wa-side-top{padding:18px 16px 14px;border-bottom:1px solid rgba(255,255,255,.07)}.wa-kicker{font-size:9px;font-weight:900;letter-spacing:.18em;color:#788397;text-transform:uppercase}.wa-side-title{display:flex;align-items:center;justify-content:space-between;margin-top:5px}.wa-side-title h2{margin:0;font-size:22px;letter-spacing:-.045em}.wa-live{display:flex;align-items:center;gap:6px;padding:6px 8px;border-radius:999px;border:1px solid rgba(34,197,94,.18);background:rgba(34,197,94,.06);color:#4ade80;font-size:8px;font-weight:900;letter-spacing:.12em}.wa-live i,.wa-chat-status i{width:6px;height:6px;border-radius:50%;background:#22c55e;box-shadow:0 0 10px #22c55e}.wa-count{margin:5px 0 12px;color:#697587;font-size:11px}.wa-search{height:36px;display:flex;align-items:center;gap:8px;padding:0 11px;border:1px solid rgba(255,255,255,.075);border-radius:11px;background:rgba(255,255,255,.035)}.wa-search svg{width:14px;color:#677386}.wa-search input{width:100%;border:0;outline:0;background:transparent;color:#e9edf4;font-size:11px}.wa-search input::placeholder{color:#5e6878}.wa-list{flex:1;min-height:0;overflow:auto;padding:7px}.wa-row{width:100%;display:grid;grid-template-columns:43px minmax(0,1fr) auto;gap:10px;align-items:center;padding:11px 9px;border:1px solid transparent;border-radius:14px;background:transparent;color:#eef2f7;text-align:left;cursor:pointer;transition:.18s}.wa-row:hover{background:rgba(255,255,255,.035)}.wa-row.selected{background:linear-gradient(90deg,rgba(124,58,237,.15),rgba(34,211,238,.025));border-color:rgba(124,58,237,.18)}
      .wa-avatar{width:43px;height:43px;border-radius:50%;display:block;object-fit:cover;border:1px solid rgba(255,255,255,.12);background:#111721;box-shadow:0 8px 20px rgba(0,0,0,.22)}.wa-avatar.large{width:45px;height:45px}.wa-avatar.fallback{display:grid;place-items:center;background:radial-gradient(circle at 30% 20%,rgba(34,211,238,.28),rgba(124,58,237,.3) 58%,rgba(255,255,255,.035));font-size:11px;font-weight:900;color:#f6f7fb}.wa-row-copy{min-width:0}.wa-row-copy strong,.wa-row-copy span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.wa-row-copy strong{font-size:12px}.wa-row-copy span{margin-top:4px;color:#687486;font-size:10px}.wa-row-meta{height:100%;display:flex;flex-direction:column;align-items:flex-end;justify-content:space-between}.wa-row-meta time{font-size:8px;color:#667183;white-space:nowrap}.wa-unread{min-width:17px;height:17px;display:grid;place-items:center;padding:0 5px;border-radius:999px;background:#25d366;color:#06110a;font-size:8px;font-weight:900}
      .wa-chat{display:grid;grid-template-rows:67px minmax(0,1fr) auto;min-width:0;min-height:0;background:radial-gradient(circle at 90% 0,rgba(124,58,237,.1),transparent 30%),#080b10}.wa-chat-head{display:flex;align-items:center;gap:11px;padding:11px 18px;border-bottom:1px solid rgba(255,255,255,.07);background:rgba(8,11,16,.84);backdrop-filter:blur(18px)}.wa-identity{min-width:0}.wa-identity h3{margin:0;font-size:14px;letter-spacing:-.02em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.wa-identity span{display:block;margin-top:3px;color:#687486;font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.wa-chat-status{margin-left:auto;display:flex;align-items:center;gap:6px;color:#4ade80;font-size:9px;white-space:nowrap}.wa-messages{min-height:0;overflow:auto;padding:18px 22px 22px}.wa-day{display:flex;align-items:center;gap:10px;margin:4px 0 14px;color:#596577;font-size:8px;font-weight:800;letter-spacing:.1em;text-transform:uppercase}.wa-day:before,.wa-day:after{content:"";height:1px;flex:1;background:rgba(255,255,255,.045)}.wa-day span{padding:5px 8px;border:1px solid rgba(255,255,255,.06);border-radius:99px;background:rgba(255,255,255,.02)}.wa-message{display:flex;align-items:flex-end;gap:7px;margin:4px 0}.wa-message.mine{justify-content:flex-end}.wa-message.mine>.wa-avatar{display:none}.wa-bubble-wrap{max-width:min(72%,650px)}.wa-sender{margin:0 0 4px 9px;color:#a78bfa;font-size:9px;font-weight:800}.wa-bubble{padding:8px 10px 6px;border:1px solid rgba(255,255,255,.075);box-shadow:0 7px 24px rgba(0,0,0,.16);font-size:12px;line-height:1.48}.theirs .wa-bubble{border-radius:14px 14px 14px 4px;background:rgba(255,255,255,.045)}.mine .wa-bubble{border-radius:14px 14px 4px 14px;background:linear-gradient(135deg,#6d28d9,#087f91)}.wa-body{white-space:pre-wrap;overflow-wrap:anywhere}.wa-time{text-align:right;margin-top:3px;font-size:8px;opacity:.55}.wa-media{display:grid;gap:6px;margin-bottom:5px}.wa-media img,.wa-media video{max-width:310px;max-height:250px;border-radius:9px;display:block}.wa-media audio{width:270px;max-width:100%}.wa-file{display:flex;align-items:center;gap:9px;min-width:190px;padding:9px;border-radius:9px;background:rgba(0,0,0,.17)}.wa-file b{font-size:8px}.wa-file span{font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .wa-empty{height:100%;display:grid;place-items:center;text-align:center;color:#687486}.wa-empty-inner{display:grid;justify-items:center;gap:8px}.wa-empty-icon{width:54px;height:54px;display:grid;place-items:center;border-radius:17px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.025);font-size:20px}.wa-empty strong{color:#dce2ea;font-size:13px}.wa-empty span{font-size:10px}.wa-error{position:absolute;left:50%;bottom:82px;transform:translateX(-50%);max-width:70%;padding:8px 11px;border:1px solid rgba(248,113,113,.2);border-radius:10px;background:rgba(55,12,18,.9);color:#fca5a5;font-size:10px;z-index:4}.wa-composer{padding:9px 13px 10px;border-top:1px solid rgba(255,255,255,.07);background:rgba(7,10,15,.95);backdrop-filter:blur(18px)}.wa-attachment-preview{display:flex;align-items:center;gap:8px;margin:0 0 7px;padding:6px 9px;border:1px solid rgba(255,255,255,.07);border-radius:9px;background:rgba(255,255,255,.025);font-size:9px;color:#aab3c0}.wa-attachment-preview button{margin-left:auto;border:0;background:transparent;color:#8b95a5;cursor:pointer}.wa-compose-row{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:8px}.wa-actions{display:flex;gap:5px}.wa-icon{width:34px;height:34px;display:grid;place-items:center;border:1px solid rgba(255,255,255,.08);border-radius:10px;background:rgba(255,255,255,.035);color:#aeb7c5;cursor:pointer;transition:.16s}.wa-icon:hover{background:rgba(124,58,237,.13);border-color:rgba(139,92,246,.3);color:#fff}.wa-icon.recording{background:rgba(239,68,68,.13);border-color:rgba(239,68,68,.35);color:#f87171}.wa-input{height:36px;width:100%;box-sizing:border-box;border:1px solid rgba(255,255,255,.08);outline:0;border-radius:11px;padding:0 12px;background:rgba(255,255,255,.035);color:#f2f4f8;font-size:11px}.wa-input:focus{border-color:rgba(139,92,246,.45);box-shadow:0 0 0 3px rgba(124,58,237,.08)}.wa-input::placeholder{color:#5e6878}.wa-send{height:36px;padding:0 17px;border:0;border-radius:11px;background:linear-gradient(135deg,#22c55e,#16a34a);color:#041009;font-size:10px;font-weight:900;cursor:pointer}.wa-send:disabled{opacity:.4;cursor:not-allowed}.wa-hint{margin:5px 0 0 78px;color:#4f5a6b;font-size:8px}
      @media(max-width:900px){.wa-grid{grid-template-columns:275px minmax(0,1fr)}.wa-bubble-wrap{max-width:82%}}@media(max-width:680px){.wa-grid{grid-template-columns:1fr}.wa-sidebar{display:none}.wa-inbox{height:calc(100vh - 150px);min-height:560px}.wa-bubble-wrap{max-width:86%}.wa-hint{display:none}}
    `}</style>

    <div className="wa-grid">
      <aside className="wa-sidebar">
        <div className="wa-side-top">
          <div className="wa-kicker">Messaging center</div>
          <div className="wa-side-title"><h2>Inbox</h2><div className="wa-live"><i />{live ? "LIVE" : "RECONNECTING"}</div></div>
          <div className="wa-count">{conversations.length} active conversation{conversations.length === 1 ? "" : "s"}</div>
          <label className="wa-search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or number" /></label>
        </div>
        <div className="wa-list">
          {loading ? <div className="wa-empty"><div className="wa-empty-inner"><strong>Loading inbox…</strong></div></div> : filtered.length === 0 ? <div className="wa-empty"><div className="wa-empty-inner"><div className="wa-empty-icon">⌕</div><strong>No conversations</strong><span>New WhatsApp chats will appear here.</span></div></div> : filtered.map((c) => {
            const display = nameOf(c, channel(c.chatId) ? "WhatsApp Channel" : "Unknown");
            return <button className={`wa-row ${selected === c.chatId ? "selected" : ""}`} key={c.chatId} onClick={() => setSelected(c.chatId)}><Avatar name={display} src={c.avatar} /><div className="wa-row-copy"><strong>{display}{c.isBusiness ? " · Business" : ""}</strong><span>{c.lastMessage || phoneOf(c) || "No messages yet"}</span></div><div className="wa-row-meta"><time>{time(c.timestamp)}</time>{c.unread > 0 && <b className="wa-unread">{c.unread > 99 ? "99+" : c.unread}</b>}</div></button>;
          })}
        </div>
      </aside>

      <main className="wa-chat" style={{ position: "relative" }}>
        <header className="wa-chat-head"><Avatar name={title} src={current?.avatar} large /><div className="wa-identity"><h3>{title}</h3><span>{phone || (channel(selected) ? "Official WhatsApp Channel" : "WhatsApp contact")}</span></div><div className="wa-chat-status"><i />WhatsApp live</div></header>
        <div className="wa-messages">
          {!selected ? <div className="wa-empty"><div className="wa-empty-inner"><div className="wa-empty-icon">◌</div><strong>Select a conversation</strong><span>Choose a chat from the inbox.</span></div></div> : messages.length === 0 ? <div className="wa-empty"><div className="wa-empty-inner"><div className="wa-empty-icon">✓</div><strong>No messages</strong><span>Start the conversation from the composer below.</span></div></div> : renderedMessages}
          <div ref={bottomRef} />
        </div>
        <div className="wa-composer">
          {error && <div className="wa-error">{error}</div>}
          {file && <div className="wa-attachment-preview"><span>Attachment</span><strong>{file.name}</strong><button onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ""; }}>Remove</button></div>}
          <div className="wa-compose-row">
            <div className="wa-actions"><input ref={fileRef} type="file" hidden accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip" onChange={(e) => setFile(e.target.files?.[0] || null)} /><button className="wa-icon" type="button" title="Attach file" onClick={() => fileRef.current?.click()} aria-label="Attach file">＋</button><button className={`wa-icon ${recording ? "recording" : ""}`} type="button" title={recording ? "Stop recording" : "Record voice"} onClick={recording ? stopRecording : startRecording} aria-label={recording ? "Stop recording" : "Record voice"}>{recording ? "■" : "●"}</button></div>
            {recording ? <div className="wa-input" style={{ display: "flex", alignItems: "center", color: "#f87171" }}>Recording voice… {recordSeconds}s</div> : <input className="wa-input" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKey} placeholder={selected ? "Write a WhatsApp message" : "Select a conversation"} disabled={!selected || sending} />}
            <button className="wa-send" type="button" disabled={!selected || sending || recording || (!text.trim() && !file)} onClick={() => void sendMessage()}>{sending ? "Sending…" : "Send"}</button>
          </div>
          <div className="wa-hint">Attach photos, videos, audio or documents · Enter to send</div>
        </div>
      </main>
    </div>
  </section>;
}
