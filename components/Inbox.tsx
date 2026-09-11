"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCheck, FileText, Image as ImageIcon, Mic, Paperclip, Search, Send, Sparkles, Video, X, Zap } from "lucide-react";

type Media = { data?: string; mimetype?: string; filename?: string; kind?: string; voice?: boolean } | null;
type Conversation = { chatId: string; name: string; phone: string; avatar?: string | null; lastMessage: string; timestamp: number; unread: number; isBusiness?: boolean };
type Message = { id: string; chatId: string; body: string; timestamp: number; fromMe: boolean; name: string; phone: string; avatar?: string | null; read: boolean; type?: string; hasMedia?: boolean; media?: Media };

const QUICK = ["Thanks for reaching out — how can we help?", "Got it. We’ll take a look and get back to you shortly.", "Thanks! Your request has been received."];
function time(ts: number) { return ts ? new Date(ts * 1000).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : ""; }
function day(ts: number) { return ts ? new Date(ts * 1000).toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" }) : ""; }
function nameOf(item?: Conversation | Message, fallback = "Unknown") { const n = String(item?.name || "").trim(); return n && !n.includes("@lid") && !n.includes("@c.us") ? n : item?.phone ? `+${item.phone.replace(/^\+/, "")}` : fallback; }
function phoneOf(item?: Conversation | Message) { return item?.phone ? `+${item.phone.replace(/^\+/, "")}` : ""; }
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
  const [dragging, setDragging] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
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
    source.addEventListener("sync", () => { void loadConversations(true); if (selectedRef.current) void loadMessages(selectedRef.current); });
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
        if (file.size > 25 * 1024 * 1024) throw new Error("File is larger than 25 MB.");
        const form = new FormData(); form.append("chatId", selected); form.append("body", body); form.append("file", file); form.append("kind", kindFor(file));
        response = await fetch("/api/whatsapp/messages", { method: "POST", body: form });
      } else response = await fetch("/api/whatsapp/messages", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chatId: selected, body }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Message could not be sent.");
      setText(""); setFile(null); if (fileRef.current) fileRef.current.value = "";
      await Promise.all([loadMessages(selected, true), loadConversations(true)]);
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
          await Promise.all([loadMessages(selected, true), loadConversations(true)]);
        } catch (e) { setError(e instanceof Error ? e.message : "Voice message could not be sent."); }
        finally { setSending(false); }
      };
      mediaRecorderRef.current = recorder; recorder.start(); setRecording(true); setRecordSeconds(0);
      timerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    } catch { setError("Microphone permission is required to record a voice message."); }
  }
  function stopRecording() { mediaRecorderRef.current?.stop(); }
  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendMessage(); } }
  function pickFile(next: File | null) { if (!next) return; if (next.size > 25 * 1024 * 1024) { setError("File is larger than 25 MB."); return; } setFile(next); setError(""); }

  const filtered = useMemo(() => { const q = search.trim().toLowerCase(); return q ? conversations.filter((c) => `${nameOf(c)} ${phoneOf(c)} ${c.lastMessage}`.toLowerCase().includes(q)) : conversations; }, [conversations, search]);
  const current = useMemo(() => conversations.find((c) => c.chatId === selected), [conversations, selected]);
  const title = nameOf(current, "Conversation");

  return <section className="wa-inbox glass">
    <style>{`
      .wa-inbox{height:720px;width:100%;padding:0!important;overflow:hidden;border-radius:28px;background:#070a0f!important;border:1px solid rgba(255,255,255,.09);box-shadow:0 35px 110px rgba(0,0,0,.42);position:relative}.wa-grid{height:100%;display:grid;grid-template-columns:330px minmax(0,1fr);min-width:0}.wa-sidebar{display:flex;flex-direction:column;min-width:0;border-right:1px solid rgba(255,255,255,.075);background:linear-gradient(180deg,#0b0f16,#080b10)}.wa-side-top{padding:20px 16px 14px;border-bottom:1px solid rgba(255,255,255,.07)}.wa-kicker{font-size:9px;font-weight:900;letter-spacing:.2em;color:#7c8799;text-transform:uppercase}.wa-side-title{display:flex;align-items:center;justify-content:space-between;margin-top:6px}.wa-side-title h2{margin:0;font-size:23px;letter-spacing:-.05em}.wa-live{display:flex;align-items:center;gap:6px;padding:6px 8px;border-radius:999px;border:1px solid rgba(34,197,94,.18);background:rgba(34,197,94,.06);color:#4ade80;font-size:8px;font-weight:900;letter-spacing:.12em}.wa-live i{width:6px;height:6px;border-radius:50%;background:#22c55e;box-shadow:0 0 12px #22c55e}.wa-count{margin:5px 0 13px;color:#697587;font-size:11px}.wa-search{height:38px;display:flex;align-items:center;gap:8px;padding:0 11px;border:1px solid rgba(255,255,255,.075);border-radius:12px;background:rgba(255,255,255,.035)}.wa-search svg{width:14px;color:#677386}.wa-search input{width:100%;border:0;outline:0;background:transparent;color:#e9edf4;font-size:11px}.wa-search input::placeholder{color:#5e6878}.wa-list{flex:1;min-height:0;overflow:auto;padding:7px}.wa-row{width:100%;display:grid;grid-template-columns:43px minmax(0,1fr) auto;gap:10px;align-items:center;padding:11px 9px;border:1px solid transparent;border-radius:15px;background:transparent;color:#eef2f7;text-align:left;cursor:pointer;transition:transform .22s ease,background .22s ease,border-color .22s ease}.wa-row:hover{background:rgba(255,255,255,.035);transform:translateX(2px)}.wa-row.selected{background:linear-gradient(100deg,rgba(124,58,237,.18),rgba(34,211,238,.035));border-color:rgba(139,92,246,.2);box-shadow:inset 3px 0 0 rgba(167,139,250,.85)}.wa-avatar{width:43px;height:43px;border-radius:50%;display:block;object-fit:cover;border:1px solid rgba(255,255,255,.12);background:#111721;box-shadow:0 9px 24px rgba(0,0,0,.24)}.wa-avatar.large{width:45px;height:45px}.wa-avatar.fallback{display:grid;place-items:center;background:radial-gradient(circle at 30% 20%,rgba(34,211,238,.3),rgba(124,58,237,.3) 58%,rgba(255,255,255,.035));font-size:11px;font-weight:900}.wa-row-copy{min-width:0}.wa-row-copy strong,.wa-row-copy span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.wa-row-copy strong{font-size:12px}.wa-row-copy span{margin-top:4px;color:#687486;font-size:10px}.wa-row-meta{height:100%;display:flex;flex-direction:column;align-items:flex-end;justify-content:space-between}.wa-row-meta time{font-size:8px;color:#667183}.wa-unread{min-width:17px;height:17px;display:grid;place-items:center;padding:0 5px;border-radius:999px;background:#25d366;color:#06110a;font-size:8px;font-weight:900}.wa-empty{padding:35px 18px;text-align:center;color:#687486;font-size:11px}.wa-chat{display:grid;grid-template-rows:70px minmax(0,1fr) auto;min-width:0;min-height:0;background:radial-gradient(circle at 92% 0,rgba(124,58,237,.13),transparent 29%),#080b10}.wa-chat-head{display:flex;align-items:center;gap:11px;padding:11px 19px;border-bottom:1px solid rgba(255,255,255,.07);background:rgba(8,11,16,.82);backdrop-filter:blur(18px);z-index:2}.wa-chat-copy{min-width:0;flex:1}.wa-chat-copy strong{display:block;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.wa-chat-copy span{display:block;margin-top:4px;color:#667385;font-size:9px}.wa-chat-status{display:flex;align-items:center;gap:6px;color:#6f7b8e;font-size:8px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.wa-chat-status i{width:6px;height:6px;border-radius:50%;background:#22c55e;box-shadow:0 0 10px #22c55e}.wa-stream{position:relative;overflow:auto;padding:22px 25px 18px;background-image:radial-gradient(rgba(255,255,255,.025) 1px,transparent 1px);background-size:18px 18px}.wa-stream:before{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(115deg,transparent 25%,rgba(124,58,237,.035),transparent 60%);animation:wa-scan 9s linear infinite}.wa-day{display:flex;justify-content:center;margin:4px 0 17px;position:relative;z-index:1}.wa-day span{padding:6px 10px;border:1px solid rgba(255,255,255,.06);border-radius:999px;background:rgba(8,11,16,.82);color:#657185;font-size:8px;font-weight:800;letter-spacing:.08em}.wa-message{display:flex;gap:8px;margin:8px 0;position:relative;z-index:1;animation:wa-rise .28s ease both}.wa-message.mine{justify-content:flex-end}.wa-bubble-wrap{max-width:min(74%,600px)}.wa-sender{font-size:8px;color:#8a95a6;margin:0 0 4px 4px}.wa-bubble{padding:9px 11px 7px;border:1px solid rgba(255,255,255,.075);border-radius:15px 15px 15px 5px;background:rgba(20,25,34,.92);box-shadow:0 10px 28px rgba(0,0,0,.16);transition:transform .2s ease,box-shadow .2s ease}.wa-bubble:hover{transform:translateY(-1px);box-shadow:0 15px 35px rgba(0,0,0,.22)}.mine .wa-bubble{border-radius:15px 15px 5px 15px;background:linear-gradient(135deg,rgba(96,58,190,.35),rgba(18,35,50,.94));border-color:rgba(139,92,246,.2)}.wa-body{white-space:pre-wrap;word-break:break-word;color:#edf1f7;font-size:11px;line-height:1.55}.wa-time{margin-top:5px;text-align:right;color:#667284;font-size:7px}.wa-media{overflow:hidden;border-radius:10px;margin-bottom:6px}.wa-media img,.wa-media video{display:block;max-width:100%;max-height:260px}.wa-media audio{width:260px;max-width:100%}.wa-file{display:flex;align-items:center;gap:8px;padding:10px;border:1px solid rgba(255,255,255,.07);border-radius:9px;color:#cbd3df;font-size:9px}.wa-file b{font-size:8px;padding:4px 5px;border-radius:5px;background:rgba(124,58,237,.25);color:#c4b5fd}.wa-composer{padding:10px 14px 14px;border-top:1px solid rgba(255,255,255,.07);background:rgba(7,10,15,.9);backdrop-filter:blur(20px);position:relative;z-index:3}.wa-error{margin:0 0 8px;padding:8px 10px;border:1px solid rgba(248,113,113,.2);border-radius:9px;background:rgba(127,29,29,.16);color:#fca5a5;font-size:9px}.wa-attachment{display:flex;align-items:center;gap:8px;margin:0 0 8px;padding:7px 9px;border:1px solid rgba(124,58,237,.22);border-radius:10px;background:rgba(124,58,237,.08);color:#c4b5fd;font-size:9px}.wa-attachment button{margin-left:auto;background:transparent;border:0;color:#8f9bad;cursor:pointer}.wa-compose-row{display:flex;align-items:flex-end;gap:8px}.wa-tool{width:36px;height:36px;flex:none;display:grid;place-items:center;border:1px solid rgba(255,255,255,.075);border-radius:11px;background:rgba(255,255,255,.035);color:#8b96a8;cursor:pointer;transition:.2s}.wa-tool:hover{transform:translateY(-2px) rotate(-2deg);border-color:rgba(139,92,246,.3);color:#c4b5fd;background:rgba(124,58,237,.08)}.wa-textarea{flex:1;min-height:38px;max-height:110px;resize:none;border:1px solid rgba(255,255,255,.075);border-radius:12px;background:rgba(255,255,255,.035);color:#eef2f7;outline:0;padding:10px 11px;font:inherit;font-size:11px;line-height:1.4}.wa-textarea:focus{border-color:rgba(139,92,246,.38);box-shadow:0 0 0 3px rgba(124,58,237,.07)}.wa-send{width:42px;height:38px;display:grid;place-items:center;border:1px solid rgba(139,92,246,.25);border-radius:12px;background:linear-gradient(135deg,#6d3ed1,#256d91);color:white;cursor:pointer;box-shadow:0 8px 25px rgba(76,55,150,.25);transition:.2s}.wa-send:hover:not(:disabled){transform:translateY(-2px) scale(1.02)}.wa-send:disabled{opacity:.45;cursor:not-allowed}.wa-recording{display:flex;align-items:center;justify-content:center;gap:9px;min-width:120px;height:38px;padding:0 12px;border-radius:12px;border:1px solid rgba(248,113,113,.2);background:rgba(127,29,29,.13);color:#fca5a5;font-size:9px;font-weight:900}.wa-recording i{width:7px;height:7px;border-radius:50%;background:#ef4444;box-shadow:0 0 12px #ef4444;animation:wa-pulse 1s infinite}.wa-quick{position:absolute;left:14px;bottom:66px;width:min(360px,calc(100% - 28px));padding:9px;border:1px solid rgba(255,255,255,.09);border-radius:15px;background:rgba(12,16,23,.96);box-shadow:0 25px 70px rgba(0,0,0,.42);backdrop-filter:blur(22px);animation:wa-rise .2s ease}.wa-quick button{display:block;width:100%;padding:9px;border:0;border-radius:9px;background:transparent;color:#d6dce6;text-align:left;font-size:9px;cursor:pointer}.wa-quick button:hover{background:rgba(255,255,255,.05)}.wa-drop{position:absolute;inset:70px 0 78px;z-index:5;display:grid;place-items:center;border:2px dashed rgba(139,92,246,.55);background:rgba(17,12,35,.76);backdrop-filter:blur(8px);pointer-events:none}.wa-drop-card{text-align:center}.wa-drop-card strong{display:block;color:#eee7ff;font-size:15px}.wa-drop-card span{display:block;margin-top:5px;color:#9d8fb9;font-size:9px}@keyframes wa-rise{from{opacity:0;transform:translateY(8px) scale(.99)}to{opacity:1;transform:none}}@keyframes wa-scan{0%{transform:translateX(-20%)}100%{transform:translateX(20%)}}@keyframes wa-pulse{50%{opacity:.35;transform:scale(.7)}}@media(max-width:820px){.wa-inbox{height:760px}.wa-grid{grid-template-columns:92px minmax(0,1fr)}.wa-side-top{padding:15px 8px}.wa-side-title h2,.wa-kicker,.wa-count,.wa-search{display:none}.wa-live{margin:auto}.wa-row{grid-template-columns:43px;justify-content:center;padding:10px 4px}.wa-row-copy,.wa-row-meta{display:none}.wa-sidebar{overflow:hidden}.wa-stream{padding:18px 12px}.wa-bubble-wrap{max-width:86%}}@media(prefers-reduced-motion:reduce){.wa-row,.wa-bubble,.wa-send{transition:none}.wa-message,.wa-quick{animation:none}.wa-stream:before,.wa-recording i{animation:none}}
    `}</style>
    <div className="wa-grid">
      <aside className="wa-sidebar">
        <div className="wa-side-top">
          <div className="wa-kicker">Command center</div>
          <div className="wa-side-title"><h2>Inbox</h2><div className="wa-live"><i />{live ? "LIVE" : "OFFLINE"}</div></div>
          <div className="wa-count">{conversations.length} active conversation{conversations.length === 1 ? "" : "s"}</div>
          <label className="wa-search"><Search /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search chats, names, numbers…" /></label>
        </div>
        <div className="wa-list">
          {loading ? <div className="wa-empty">Syncing WhatsApp…</div> : filtered.length === 0 ? <div className="wa-empty">{search ? "No matching conversations." : "No conversations yet."}</div> : filtered.map((c) => <button className={`wa-row ${selected === c.chatId ? "selected" : ""}`} key={c.chatId} onClick={() => setSelected(c.chatId)}><Avatar name={nameOf(c)} src={c.avatar} /><div className="wa-row-copy"><strong>{nameOf(c)}</strong><span>{c.lastMessage || phoneOf(c) || "Conversation"}</span></div><div className="wa-row-meta"><time>{time(c.timestamp)}</time>{c.unread > 0 && <b className="wa-unread">{c.unread > 99 ? "99+" : c.unread}</b>}</div></button>)}
        </div>
      </aside>
      <main className="wa-chat" onDragEnter={(e) => { e.preventDefault(); setDragging(true); }} onDragOver={(e) => e.preventDefault()} onDragLeave={(e) => { if (e.currentTarget === e.target) setDragging(false); }} onDrop={(e) => { e.preventDefault(); setDragging(false); pickFile(e.dataTransfer.files?.[0] || null); }}>
        <header className="wa-chat-head">{current ? <><Avatar name={title} src={current.avatar} large /><div className="wa-chat-copy"><strong>{title}</strong><span>{phoneOf(current) || "WhatsApp conversation"}</span></div><div className="wa-chat-status"><i />{live ? "Realtime" : "Reconnecting"}</div></> : <div className="wa-chat-copy"><strong>Select a conversation</strong><span>Your WhatsApp messages will appear here.</span></div>}</header>
        <div className="wa-stream">
          {messages.length === 0 && selected && <div className="wa-empty">No messages in this conversation.</div>}
          {messages.map((m, index) => <div key={m.id}><>{index === 0 || day(messages[index - 1].timestamp) !== day(m.timestamp) ? <div className="wa-day"><span>{day(m.timestamp)}</span></div> : null}</><div className={`wa-message ${m.fromMe ? "mine" : "theirs"}`}>{!m.fromMe && <Avatar name={nameOf(m)} src={m.avatar} />}<div className="wa-bubble-wrap">{!m.fromMe && <div className="wa-sender">{nameOf(m)}</div>}<div className="wa-bubble">{m.hasMedia && m.media?.data ? <div className="wa-media">{m.media.mimetype?.startsWith("image/") ? <img src={`data:${m.media.mimetype};base64,${m.media.data}`} alt={m.media.filename || "Image"} /> : m.media.mimetype?.startsWith("video/") ? <video controls src={`data:${m.media.mimetype};base64,${m.media.data}`} /> : m.media.mimetype?.startsWith("audio/") ? <audio controls src={`data:${m.media.mimetype};base64,${m.media.data}`} /> : <div className="wa-file"><FileText size={15} /><span>{m.media.filename || "Document"}</span></div>}</div> : null}{m.body && <div className="wa-body">{m.body}</div>}<div className="wa-time">{time(m.timestamp)} {m.fromMe && <CheckCheck size={10} style={{ verticalAlign: "middle" }} />}</div></div></div></div></div>)}</div>
          <div ref={bottomRef} />
        </div>
        <div className="wa-composer">
          {error && <div className="wa-error">{error}</div>}
          {file && <div className="wa-attachment">{kindFor(file) === "image" ? <ImageIcon size={13} /> : kindFor(file) === "video" ? <Video size={13} /> : <FileText size={13} />}<span>{file.name}</span><button onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ""; }}><X size={13} /></button></div>}
          {quickOpen && <div className="wa-quick">{QUICK.map((q) => <button key={q} onClick={() => { setText(q); setQuickOpen(false); }}>{q}</button>)}</div>}
          <div className="wa-compose-row">
            <input ref={fileRef} type="file" hidden accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" onChange={(e) => pickFile(e.target.files?.[0] || null)} />
            <button className="wa-tool" title="Attach file" disabled={!selected || sending} onClick={() => fileRef.current?.click()}><Paperclip size={15} /></button>
            <button className="wa-tool" title="Quick replies" disabled={!selected || sending} onClick={() => setQuickOpen((v) => !v)}><Zap size={15} /></button>
            {recording ? <div className="wa-recording"><i />{Math.floor(recordSeconds / 60).toString().padStart(2, "0")}:{(recordSeconds % 60).toString().padStart(2, "0")}<button className="wa-tool" onClick={stopRecording} title="Stop recording"><Send size={13} /></button></div> : <><button className="wa-tool" title="Voice message" disabled={!selected || sending} onClick={() => void startRecording()}><Mic size={15} /></button><textarea className="wa-textarea" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKey} disabled={!selected || sending} placeholder={selected ? "Write a message…  Enter to send · Shift+Enter for a new line" : "Select a conversation to start"} /><button className="wa-send" disabled={!selected || sending || (!text.trim() && !file)} onClick={() => void sendMessage()} title="Send"><Send size={16} /></button></>}
          </div>
        </div>
        {dragging && <div className="wa-drop"><div className="wa-drop-card"><Sparkles size={26} /><strong>Drop media to attach</strong><span>Images, video, audio and documents · 25 MB max</span></div></div>}
      </main>
    </div>
  </section>;
}
