"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Media = { data?: string; mimetype?: string; filename?: string; kind?: string; voice?: boolean } | null;
type Conversation = { chatId: string; name: string; phone: string; avatar?: string | null; lastMessage: string; timestamp: number; unread: number; isBusiness?: boolean };
type Message = { id: string; chatId: string; body: string; timestamp: number; fromMe: boolean; name: string; phone: string; avatar?: string | null; read: boolean; type?: string; hasMedia?: boolean; media?: Media };

function formatTime(ts: number) { return ts ? new Date(ts * 1000).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : ""; }
function formatDay(ts: number) { return ts ? new Date(ts * 1000).toLocaleDateString([], { weekday: "long", month: "short", day: "numeric", year: "numeric" }) : ""; }
function isChannel(id: string) { return id.includes("@newsletter"); }
function cleanName(value: string, fallback = "Unknown") { const v = String(value || "").trim(); return v && !v.includes("@lid") && !v.includes("@c.us") ? v : fallback; }
function displayName(c?: Conversation | Message, fallback = "Unknown") { if (!c) return fallback; return cleanName(c.name, c.phone || fallback); }
function displayPhone(c?: Conversation | Message) { if (!c || isChannel(c.chatId) || !c.phone) return ""; return `+${c.phone.replace(/^\+/, "")}`; }
function initials(name: string) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join("").toUpperCase() || "WA"; }
function kindFor(file: File) { if (file.type.startsWith("image/")) return "image"; if (file.type.startsWith("video/")) return "video"; if (file.type.startsWith("audio/")) return "audio"; return "document"; }

function Avatar({ name, src, large = false }: { name: string; src?: string | null; large?: boolean }) {
  const [failed, setFailed] = useState(false);
  return src && !failed ? <img className={`avatar ${large ? "avatar-large" : ""}`} src={src} alt="" onError={() => setFailed(true)} /> : <div className={`avatar ${large ? "avatar-large" : ""}`}>{initials(name)}</div>;
}

export default function Inbox() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selected, setSelected] = useState("");
  const [text, setText] = useState("");
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
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { selectedRef.current = selected; }, [selected]);
  useEffect(() => () => { if (recordTimerRef.current) clearInterval(recordTimerRef.current); mediaRecorderRef.current?.stream.getTracks().forEach((t) => t.stop()); }, []);

  async function loadConversations() {
    try {
      const r = await fetch("/api/whatsapp/messages", { cache: "no-store" }); const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Could not load inbox.");
      const next = Array.isArray(data.conversations) ? data.conversations : [];
      setConversations(next); setSelected((current) => current || next[0]?.chatId || ""); setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load inbox."); } finally { setLoading(false); }
  }

  async function loadMessages(chatId: string, scroll = false) {
    if (!chatId) return;
    try {
      const r = await fetch(`/api/whatsapp/messages?chatId=${encodeURIComponent(chatId)}`, { cache: "no-store" }); const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Could not load conversation.");
      setMessages(Array.isArray(data.messages) ? data.messages : []); setError("");
      if (scroll) requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load conversation."); }
  }

  useEffect(() => {
    loadConversations();
    const source = new EventSource("/api/whatsapp/events");
    source.addEventListener("open", () => setLive(true));
    source.addEventListener("state", () => loadConversations());
    source.addEventListener("snapshot", () => loadConversations());
    source.addEventListener("message", () => { loadConversations(); if (selectedRef.current) loadMessages(selectedRef.current, true); });
    source.addEventListener("sync", () => { loadConversations(); if (selectedRef.current) loadMessages(selectedRef.current); });
    source.onerror = () => setLive(false);
    return () => source.close();
  }, []);

  useEffect(() => { if (!selected) { setMessages([]); return; } loadMessages(selected); }, [selected]);

  async function sendMessage() {
    if (!selected || sending || recording) return;
    const body = text.trim(); if (!body && !file) return;
    setSending(true); setError("");
    try {
      let response: Response;
      if (file) {
        const form = new FormData(); form.append("chatId", selected); form.append("body", body); form.append("file", file); form.append("kind", kindFor(file));
        response = await fetch("/api/whatsapp/messages", { method: "POST", body: form });
      } else response = await fetch("/api/whatsapp/messages", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chatId: selected, body }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Message could not be sent.");
      setText(""); setFile(null); if (fileRef.current) fileRef.current.value = "";
      await loadMessages(selected, true); await loadConversations();
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
        stream.getTracks().forEach((t) => t.stop()); if (recordTimerRef.current) clearInterval(recordTimerRef.current);
        setRecording(false); setRecordSeconds(0);
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" }); if (!blob.size) return;
        const ext = blob.type.includes("ogg") ? "ogg" : "webm"; setSending(true); setError("");
        try {
          const form = new FormData(); form.append("chatId", selected); form.append("file", new File([blob], `Voice-${Date.now()}.${ext}`, { type: blob.type || "audio/webm" })); form.append("kind", "audio"); form.append("voice", "true");
          const response = await fetch("/api/whatsapp/messages", { method: "POST", body: form }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Voice message could not be sent.");
          await loadMessages(selected, true); await loadConversations();
        } catch (e) { setError(e instanceof Error ? e.message : "Voice message could not be sent."); }
        finally { setSending(false); }
      };
      mediaRecorderRef.current = recorder; recorder.start(); setRecording(true); setRecordSeconds(0); recordTimerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    } catch { setError("Microphone permission is required to record a voice message."); }
  }

  function stopRecording() { mediaRecorderRef.current?.stop(); }
  function onComposerKey(e: React.KeyboardEvent<HTMLInputElement>) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendMessage(); } }

  const selectedConversation = useMemo(() => conversations.find((c) => c.chatId === selected), [conversations, selected]);
  const channel = isChannel(selected); const title = displayName(selectedConversation, channel ? "WhatsApp Channel" : "Select a conversation"); const phone = displayPhone(selectedConversation);

  return <section className="inbox-shell glass"><style>{` .inbox-shell{width:100%;height:680px;min-height:680px;padding:0!important;overflow:hidden;border-radius:22px}.inbox-layout{display:grid;grid-template-columns:360px minmax(0,1fr);height:100%;min-width:0}.inbox-list{display:flex;flex-direction:column;min-width:0;border-right:1px solid var(--line);background:linear-gradient(180deg,rgba(10,14,21,.98),rgba(6,9,14,.94))}.inbox-list-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:22px 18px 17px;border-bottom:1px solid var(--line)}.inbox-list-head h2{margin:5px 0 0;font-size:23px;letter-spacing:-.04em}.inbox-list-head p{margin:6px 0 0;color:var(--muted);font-size:12px}.live-pill{display:inline-flex;align-items:center;gap:6px;padding:7px 9px;border:1px solid rgba(245,158,11,.2);border-radius:999px;color:#fbbf24;background:rgba(245,158,11,.06);font-size:9px;font-weight:900;letter-spacing:.12em}.live-pill i,.chat-live i{width:6px;height:6px;border-radius:50%;background:#f59e0b;box-shadow:0 0 9px rgba(245,158,11,.7)}.live-pill.on{border-color:rgba(34,197,94,.22);color:#4ade80;background:rgba(34,197,94,.055)}.live-pill.on i,.chat-live i{background:#4ade80;box-shadow:0 0 10px rgba(74,222,128,.85)}.conversation-scroll{flex:1;min-height:0;overflow:auto}.conversation-row{width:100%;display:grid;grid-template-columns:44px minmax(0,1fr) auto;gap:11px;align-items:center;padding:13px 15px;border:0;border-bottom:1px solid rgba(255,255,255,.045);border-left:2px solid transparent;background:transparent;color:inherit;text-align:left;transition:.18s}.conversation-row:hover{background:rgba(255,255,255,.035)}.conversation-row.selected{background:linear-gradient(90deg,rgba(124,58,237,.16),rgba(34,211,238,.025));border-left-color:#8b5cf6}.avatar{width:44px;height:44px;display:grid;place-items:center;object-fit:cover;flex:none;border-radius:50%;border:1px solid rgba(255,255,255,.12);background:radial-gradient(circle at 30% 20%,rgba(34,211,238,.24),rgba(124,58,237,.26) 55%,rgba(255,255,255,.04));font-size:12px;font-weight:900;box-shadow:0 8px 24px rgba(0,0,0,.22)}.avatar-large{width:46px;height:46px;font-size:13px}.conversation-copy{min-width:0;overflow:hidden}.conversation-copy strong,.conversation-copy span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.conversation-copy strong{font-size:13px;color:#f3f6fb}.conversation-copy span{margin-top:4px;font-size:11px;color:var(--muted)}.conversation-meta{display:grid;justify-items:end;gap:6px;align-self:stretch}.conversation-meta time{font-size:9px;color:#778294;white-space:nowrap}.conversation-meta b{min-width:19px;height:19px;display:grid;place-items:center;padding:0 5px;border-radius:99px;background:#22c55e;color:#06110a;font-size:9px}.chat-pane{display:grid;grid-template-rows:auto minmax(0,1fr) auto;min-width:0;min-height:0;background:radial-gradient(circle at 90% 0,rgba(124,58,237,.1),transparent 35%),#080b11}.chat-head{display:flex;align-items:center;gap:12px;padding:16px 20px;border-bottom:1px solid var(--line);background:rgba(255,255,255,.018);backdrop-filter:blur(18px)}.chat-identity{min-width:0}.chat-identity h2{margin:3px 0 0;font-size:17px;letter-spacing:-.02em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.chat-identity span{display:block;margin-top:3px;font-size:10px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.chat-live{margin-left:auto;display:flex;align-items:center;gap:7px;white-space:nowrap;font-size:10px;color:#4ade80}.message-scroll{min-height:0;overflow:auto;padding:20px 22px 24px;display:flex;flex-direction:column;gap:7px;scroll-behavior:smooth}.message-row{display:flex;width:100%;margin-top:1px}.message-row.mine{justify-content:flex-end}.message-row.theirs{justify-content:flex-start}.message-bubble{max-width:min(72%,680px);padding:9px 12px 7px;border:1px solid rgba(255,255,255,.08);box-shadow:0 8px 28px rgba(0,0,0,.16);font-size:13px;line-height:1.5}.message-row.mine .message-bubble{border-radius:17px 17px 5px 17px;background:linear-gradient(135deg,rgba(124,58,237,.94),rgba(8,145,178,.86))}.message-row.theirs .message-bubble{border-radius:17px 17px 17px 5px;background:rgba(255,255,255,.055)}.message-body{white-space:pre-wrap;overflow-wrap:anywhere}.message-time{margin-top:4px;text-align:right;font-size:9px;opacity:.58}.day-divider{display:flex;align-items:center;gap:10px;margin:10px 0 5px;color:#687486;font-size:9px;text-transform:uppercase;letter-spacing:.1em}.day-divider:before,.day-divider:after{content:"";height:1px;flex:1;background:rgba(255,255,255,.055)}.day-divider span{padding:4px 8px;border:1px solid var(--line);border-radius:99px;background:rgba(255,255,255,.025)}.media-card{display:grid;gap:7px;min-width:210px}.media-card img,.media-card video{display:block;max-width:320px;max-height:280px;border-radius:11px;object-fit:cover}.media-card audio{width:280px;max-width:100%}.media-file{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:11px;background:rgba(0,0,0,.18);border:1px solid rgba(255,255,255,.08)}.media-file b{font-size:12px}.media-file span{display:block;font-size:10px;opacity:.6}.composer-wrap{padding:10px 14px 11px;border-top:1px solid var(--line);background:rgba(5,8,13,.9);backdrop-filter:blur(18px)}.attachment-preview{display:flex;align-items:center;gap:9px;margin:0 0 8px;padding:8px 10px;border:1px solid rgba(139,92,246,.25);border-radius:11px;background:rgba(124,58,237,.07);font-size:11px}.attachment-preview button{margin-left:auto;border:0;background:none;color:#94a3b8;font-size:16px;cursor:pointer}.composer{display:flex;gap:8px;align-items:center}.icon-button{width:43px;height:43px;display:grid;place-items:center;border:1px solid var(--line);border-radius:13px;background:rgba(255,255,255,.035);color:#b9c3d1;cursor:pointer;font-size:18px}.icon-button:hover{border-color:rgba(139,92,246,.55);color:#fff}.composer input{width:100%;height:43px;min-width:0;padding:0 13px;border:1px solid var(--line);border-radius:13px;outline:none;background:rgba(8,11,16,.86);color:var(--text)}.composer input:focus{border-color:rgba(139,92,246,.65);box-shadow:0 0 0 3px rgba(139,92,246,.1)}.send-button{height:43px;min-width:78px;border:0;border-radius:13px;padding:0 15px;background:linear-gradient(135deg,#7c3aed,#0891b2);color:#fff;font-weight:800}.send-button:disabled{opacity:.4}.recording{display:flex;align-items:center;gap:9px;flex:1;height:43px;padding:0 13px;border:1px solid rgba(248,113,113,.3);border-radius:13px;background:rgba(127,29,29,.13);color:#fca5a5;font-size:12px}.record-dot{width:8px;height:8px;border-radius:50%;background:#ef4444;box-shadow:0 0 12px #ef4444;animation:pulse 1s infinite}.record-stop{margin-left:auto;border:0;border-radius:9px;padding:6px 10px;background:#ef4444;color:#fff;font-weight:800}.composer-hint{display:flex;justify-content:space-between;margin:6px 3px 0;color:#657184;font-size:9px}.inbox-empty{min-height:180px;margin:14px;padding:28px 20px;display:grid;place-items:center;align-content:center;gap:8px;text-align:center;border:1px dashed var(--line);border-radius:14px;color:var(--muted);font-size:12px}.inbox-empty strong{color:#e2e8f0}.inbox-empty.center{height:100%;margin:0;border:0}.inbox-error{margin:0 0 8px;padding:8px 10px;border-radius:9px;background:rgba(127,29,29,.16);border:1px solid rgba(251,113,133,.18);color:#fb7185;font-size:11px}@media(max-width:900px){.inbox-shell{height:auto;min-height:680px}.inbox-layout{grid-template-columns:300px minmax(0,1fr)}}@media(max-width:700px){.inbox-shell{min-height:760px}.inbox-layout{grid-template-columns:1fr;grid-template-rows:260px minmax(500px,1fr)}.inbox-list{border-right:0;border-bottom:1px solid var(--line)}.message-bubble{max-width:86%}.chat-live{display:none}}`}</style>
      <div className="inbox-layout">
        <aside className="inbox-list">
          <div className="inbox-list-head"><div><div className="eyebrow">MESSAGING CENTER</div><h2>Inbox</h2><p>{conversations.length} active conversation{conversations.length === 1 ? "" : "s"}</p></div><span className={`live-pill ${live ? "on" : ""}`}><i />{live ? "LIVE" : "RECONNECTING"}</span></div>
          <div className="conversation-scroll">{loading ? <div className="inbox-empty"><span>Loading conversations…</span></div> : conversations.length === 0 ? <div className="inbox-empty"><strong>No conversations yet</strong><span>Connect WhatsApp and receive a message. Chats are imported automatically.</span></div> : conversations.map((c) => { const name = displayName(c); return <button key={c.chatId} className={`conversation-row ${selected === c.chatId ? "selected" : ""}`} onClick={() => setSelected(c.chatId)}><Avatar name={name} src={c.avatar} /><div className="conversation-copy"><strong>{name}{c.isBusiness ? " · Business" : ""}</strong><span>{c.lastMessage || "No message"}</span></div><div className="conversation-meta"><time>{formatTime(c.timestamp)}</time>{c.unread > 0 && <b>{c.unread}</b>}</div></button>; })}</div>
        </aside>
        <div className="chat-pane">
          <header className="chat-head"><Avatar large name={title} src={selectedConversation?.avatar} /><div className="chat-identity"><h2>{title}</h2><span>{channel ? "WhatsApp Channel" : phone || "WhatsApp contact"}</span></div><div className="chat-live"><i />WhatsApp live</div></header>
          <div className="message-scroll">
            {!selected ? <div className="inbox-empty center"><strong>Select a conversation</strong><span>Your live WhatsApp inbox will appear here.</span></div> : messages.length === 0 ? <div className="inbox-empty center"><strong>No messages</strong><span>Start the conversation from the composer below.</span></div> : messages.map((m, i) => { const previous = messages[i - 1]; const showDay = !previous || formatDay(previous.timestamp) !== formatDay(m.timestamp); const mediaUrl = m.media?.data ? `data:${m.media.mimetype || "application/octet-stream"};base64,${m.media.data}` : ""; return <div key={m.id}>{showDay && <div className="day-divider"><span>{formatDay(m.timestamp)}</span></div>}<div className={`message-row ${m.fromMe ? "mine" : "theirs"}`}><div className="message-bubble">{m.hasMedia && m.media ? <div className="media-card">{m.media.kind === "image" && mediaUrl ? <img src={mediaUrl} alt={m.media.filename || "Image"} /> : null}{m.media.kind === "video" && mediaUrl ? <video src={mediaUrl} controls /> : null}{m.media.kind === "audio" && mediaUrl ? <audio src={mediaUrl} controls /> : null}{m.media.kind === "document" ? <div className="media-file"><span>DOC</span><div><b>{m.media.filename || "Document"}</b><span>WhatsApp document</span></div></div> : null}{m.body ? <div className="message-body">{m.body}</div> : null}</div> : <div className="message-body">{m.body || `[${m.type || "media"}]`}</div>}<div className="message-time">{formatTime(m.timestamp)} {m.fromMe ? "✓✓" : ""}</div></div></div></div>; })}<div ref={bottomRef} />
          </div>
          <div className="composer-wrap">
            {error && <div className="inbox-error">{error}</div>}
            {file && <div className="attachment-preview"><span>ATTACHMENT</span><strong>{file.name}</strong><span>{Math.round(file.size / 1024)} KB</span><button onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ""; }}>×</button></div>}
            <div className="composer">
              {recording ? <div className="recording"><i className="record-dot" />Recording voice message · {recordSeconds}s<button className="record-stop" onClick={stopRecording}>Send</button></div> : <><button className="icon-button" title="Attach file" onClick={() => fileRef.current?.click()}>＋</button><input ref={fileRef} type="file" hidden accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar" onChange={(e) => setFile(e.target.files?.[0] || null)} /><input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onComposerKey} placeholder={selected ? "Write a WhatsApp message…" : "Select a conversation…"} disabled={!selected || sending} /><button className="icon-button" title="Record voice message" onClick={() => void startRecording()} disabled={!selected || sending}>●</button><button className="send-button" onClick={() => void sendMessage()} disabled={!selected || sending || (!text.trim() && !file)}>Send</button></>}
            </div>
            <div className="composer-hint"><span>{file ? "File ready to send" : "Attach photos, videos, audio or documents"}</span><span>{recording ? "Tap Send to finish" : "Enter to send"}</span></div>
          </div>
        </div>
      </div>
    </section>;
}
