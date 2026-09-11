"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCheck, FileText, Image as ImageIcon, Mic, Paperclip, Search, Send, Sparkles, Video, X, Zap } from "lucide-react";

type Media = { data?: string; mimetype?: string; filename?: string; kind?: string; voice?: boolean } | null;
type Conversation = { chatId: string; name: string; phone: string; avatar?: string | null; lastMessage: string; timestamp: number; unread: number; isBusiness?: boolean };
type Message = { id: string; chatId: string; body: string; timestamp: number; fromMe: boolean; name: string; phone: string; avatar?: string | null; read: boolean; type?: string; hasMedia?: boolean; media?: Media };

const QUICK = [
  "Thanks for reaching out — how can we help?",
  "Got it. We’ll take a look and get back to you shortly.",
  "Thanks! Your request has been received.",
];

function time(ts: number) {
  return ts ? new Date(ts * 1000).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "";
}
function day(ts: number) {
  return ts ? new Date(ts * 1000).toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" }) : "";
}
function nameOf(item?: Conversation | Message, fallback = "Unknown") {
  const name = String(item?.name || "").trim();
  return name && !name.includes("@lid") && !name.includes("@c.us") ? name : item?.phone ? `+${item.phone.replace(/^\+/, "")}` : fallback;
}
function phoneOf(item?: Conversation | Message) {
  return item?.phone ? `+${item.phone.replace(/^\+/, "")}` : "";
}
function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "WA";
}
function kindFor(file: File) {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  return "document";
}

function Avatar({ name, src, large = false }: { name: string; src?: string | null; large?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (src && !failed) return <img className={`wa-avatar ${large ? "large" : ""}`} src={src} alt="" onError={() => setFailed(true)} />;
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
  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    mediaRecorderRef.current?.stream.getTracks().forEach((track) => track.stop());
  }, []);

  async function loadConversations(keepSelection = true) {
    try {
      const response = await fetch("/api/whatsapp/messages", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load inbox.");
      const next = Array.isArray(data.conversations) ? data.conversations : [];
      setConversations(next);
      setSelected((current) => keepSelection && current && next.some((item: Conversation) => item.chatId === current) ? current : (next[0]?.chatId || ""));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load inbox.");
    } finally {
      setLoading(false);
    }
  }

  async function loadMessages(chatId: string, scroll = false) {
    if (!chatId) {
      setMessages([]);
      return;
    }
    try {
      const response = await fetch(`/api/whatsapp/messages?chatId=${encodeURIComponent(chatId)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load conversation.");
      setMessages(Array.isArray(data.messages) ? data.messages : []);
      setError("");
      if (scroll) requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load conversation.");
    }
  }

  useEffect(() => {
    void loadConversations(false);
    const source = new EventSource("/api/whatsapp/events");
    source.addEventListener("open", () => setLive(true));
    source.addEventListener("state", () => void loadConversations(true));
    source.addEventListener("snapshot", () => void loadConversations(true));
    source.addEventListener("message", () => {
      void loadConversations(true);
      if (selectedRef.current) void loadMessages(selectedRef.current, true);
    });
    source.addEventListener("sync", () => {
      void loadConversations(true);
      if (selectedRef.current) void loadMessages(selectedRef.current);
    });
    source.onerror = () => setLive(false);
    return () => source.close();
  }, []);

  useEffect(() => { void loadMessages(selected); }, [selected]);

  async function sendMessage() {
    if (!selected || sending || recording) return;
    const body = text.trim();
    if (!body && !file) return;
    setSending(true);
    setError("");
    try {
      let response: Response;
      if (file) {
        if (file.size > 25 * 1024 * 1024) throw new Error("File is larger than 25 MB.");
        const form = new FormData();
        form.append("chatId", selected);
        form.append("body", body);
        form.append("file", file);
        form.append("kind", kindFor(file));
        response = await fetch("/api/whatsapp/messages", { method: "POST", body: form });
      } else {
        response = await fetch("/api/whatsapp/messages", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ chatId: selected, body }),
        });
      }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Message could not be sent.");
      setText("");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      await Promise.all([loadMessages(selected, true), loadConversations(true)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Message could not be sent.");
    } finally {
      setSending(false);
    }
  }

  async function startRecording() {
    if (recording || sending || !selected) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferred = ["audio/ogg;codecs=opus", "audio/webm;codecs=opus", "audio/webm"].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, preferred ? { mimeType: preferred } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        if (timerRef.current) clearInterval(timerRef.current);
        setRecording(false);
        setRecordSeconds(0);
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (!blob.size) return;
        const extension = blob.type.includes("ogg") ? "ogg" : "webm";
        setSending(true);
        setError("");
        try {
          const form = new FormData();
          form.append("chatId", selected);
          form.append("file", new File([blob], `Voice-${Date.now()}.${extension}`, { type: blob.type || "audio/webm" }));
          form.append("kind", "audio");
          form.append("voice", "true");
          const response = await fetch("/api/whatsapp/messages", { method: "POST", body: form });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || "Voice message could not be sent.");
          await Promise.all([loadMessages(selected, true), loadConversations(true)]);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Voice message could not be sent.");
        } finally {
          setSending(false);
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setRecordSeconds(0);
      timerRef.current = setInterval(() => setRecordSeconds((seconds) => seconds + 1), 1000);
    } catch {
      setError("Microphone permission is required to record a voice message.");
    }
  }

  function stopRecording() { mediaRecorderRef.current?.stop(); }
  function onKey(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  }
  function pickFile(next: File | null) {
    if (!next) return;
    if (next.size > 25 * 1024 * 1024) {
      setError("File is larger than 25 MB.");
      return;
    }
    setFile(next);
    setError("");
  }

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return conversations;
    return conversations.filter((conversation) => `${nameOf(conversation)} ${phoneOf(conversation)} ${conversation.lastMessage}`.toLowerCase().includes(query));
  }, [conversations, search]);
  const current = useMemo(() => conversations.find((conversation) => conversation.chatId === selected), [conversations, selected]);
  const title = nameOf(current, "Conversation");

  return (
    <section className="wa-inbox glass">
      <style>{`
        .wa-inbox{height:720px;width:100%;padding:0!important;overflow:hidden;border-radius:28px;background:#070a0f!important;border:1px solid rgba(255,255,255,.09);box-shadow:0 35px 110px rgba(0,0,0,.42);position:relative}
        .wa-grid{height:100%;display:grid;grid-template-columns:330px minmax(0,1fr);min-width:0}
        .wa-sidebar{display:flex;flex-direction:column;min-width:0;border-right:1px solid rgba(255,255,255,.075);background:linear-gradient(180deg,#0b0f16,#080b10)}
        .wa-side-top{padding:20px 16px 14px;border-bottom:1px solid rgba(255,255,255,.07)}
        .wa-kicker{font-size:9px;font-weight:900;letter-spacing:.2em;color:#7c8799;text-transform:uppercase}
        .wa-side-title{display:flex;align-items:center;justify-content:space-between;margin-top:6px}.wa-side-title h2{margin:0;font-size:23px;letter-spacing:-.05em}
        .wa-live{display:flex;align-items:center;gap:6px;padding:6px 8px;border-radius:999px;border:1px solid rgba(34,197,94,.18);background:rgba(34,197,94,.06);color:#4ade80;font-size:8px;font-weight:900;letter-spacing:.12em}.wa-live i,.wa-chat-status i{width:6px;height:6px;border-radius:50%;background:#22c55e;box-shadow:0 0 12px #22c55e}
        .wa-count{margin:5px 0 13px;color:#697587;font-size:11px}.wa-search{height:38px;display:flex;align-items:center;gap:8px;padding:0 11px;border:1px solid rgba(255,255,255,.075);border-radius:12px;background:rgba(255,255,255,.035)}.wa-search svg{width:14px;color:#677386}.wa-search input{width:100%;border:0;outline:0;background:transparent;color:#e9edf4;font-size:11px}.wa-search input::placeholder{color:#5e6878}
        .wa-list{flex:1;min-height:0;overflow:auto;padding:7px}.wa-row{width:100%;display:grid;grid-template-columns:43px minmax(0,1fr) auto;gap:10px;align-items:center;padding:11px 9px;border:1px solid transparent;border-radius:15px;background:transparent;color:#eef2f7;text-align:left;cursor:pointer;transition:transform .22s ease,background .22s ease,border-color .22s ease}.wa-row:hover{background:rgba(255,255,255,.035);transform:translateX(2px)}.wa-row.selected{background:linear-gradient(100deg,rgba(124,58,237,.18),rgba(34,211,238,.035));border-color:rgba(139,92,246,.2);box-shadow:inset 3px 0 0 rgba(167,139,250,.85)}
        .wa-avatar{width:43px;height:43px;border-radius:50%;display:block;object-fit:cover;border:1px solid rgba(255,255,255,.12);background:#111721;box-shadow:0 9px 24px rgba(0,0,0,.24)}.wa-avatar.large{width:45px;height:45px}.wa-avatar.fallback{display:grid;place-items:center;background:radial-gradient(circle at 30% 20%,rgba(34,211,238,.3),rgba(124,58,237,.3) 58%,rgba(255,255,255,.035));font-size:11px;font-weight:900}
        .wa-row-copy{min-width:0}.wa-row-copy strong,.wa-row-copy span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.wa-row-copy strong{font-size:12px}.wa-row-copy span{margin-top:4px;color:#687486;font-size:10px}.wa-row-meta{height:100%;display:flex;flex-direction:column;align-items:flex-end;justify-content:space-between}.wa-row-meta time{font-size:8px;color:#667183}.wa-unread{min-width:17px;height:17px;display:grid;place-items:center;padding:0 5px;border-radius:999px;background:#25d366;color:#06110a;font-size:8px;font-weight:900}
        .wa-empty{padding:35px 18px;text-align:center;color:#687486;font-size:11px}.wa-chat{display:grid;grid-template-rows:70px minmax(0,1fr) auto;min-width:0;min-height:0;background:radial-gradient(circle at 92% 0,rgba(124,58,237,.13),transparent 29%),#080b10}.wa-chat-head{display:flex;align-items:center;gap:11px;padding:11px 19px;border-bottom:1px solid rgba(255,255,255,.07);background:rgba(8,11,16,.82);backdrop-filter:blur(18px);z-index:2}.wa-chat-copy{min-width:0;flex:1}.wa-chat-copy strong{display:block;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.wa-chat-copy span{display:block;margin-top:4px;color:#667385;font-size:9px}.wa-chat-status{display:flex;align-items:center;gap:6px;color:#6f7b8e;font-size:8px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
        .wa-stream{position:relative;overflow:auto;padding:22px 25px 18px;background-image:radial-gradient(rgba(255,255,255,.025) 1px,transparent 1px);background-size:18px 18px}.wa-stream:after{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(120deg,transparent 35%,rgba(139,92,246,.035),transparent 65%);animation:wa-flow 8s linear infinite}.wa-day{display:flex;justify-content:center;margin:4px 0 14px;position:relative;z-index:1}.wa-day span{padding:5px 9px;border:1px solid rgba(255,255,255,.07);border-radius:999px;background:rgba(255,255,255,.035);color:#667385;font-size:8px}.wa-message{display:flex;gap:8px;align-items:flex-end;margin:7px 0;position:relative;z-index:1;animation:wa-in .3s ease both}.wa-message.mine{justify-content:flex-end}.wa-bubble-wrap{max-width:min(72%,620px)}.wa-sender{margin:0 0 4px 5px;color:#7f8a9d;font-size:8px}.wa-bubble{padding:9px 11px;border:1px solid rgba(255,255,255,.07);border-radius:15px 15px 5px 15px;background:linear-gradient(145deg,rgba(139,92,246,.18),rgba(255,255,255,.035));box-shadow:0 12px 30px rgba(0,0,0,.18);transition:transform .22s ease}.wa-bubble:hover{transform:translateY(-2px) perspective(700px) rotateX(1deg)}.wa-message.theirs .wa-bubble{border-radius:15px 15px 15px 5px;background:rgba(255,255,255,.045)}.wa-body{white-space:pre-wrap;overflow-wrap:anywhere;font-size:11px;line-height:1.45;color:#e8edf5}.wa-time{margin-top:5px;text-align:right;color:#667385;font-size:7px}.wa-media img,.wa-media video{display:block;max-width:320px;max-height:300px;border-radius:10px}.wa-media audio{width:260px;max-width:100%}.wa-file{display:flex;align-items:center;gap:8px;color:#dbe3ee;font-size:10px}.wa-compose-row{display:flex;align-items:flex-end;gap:7px;padding:11px 16px;border-top:1px solid rgba(255,255,255,.07);background:rgba(8,11,16,.9);backdrop-filter:blur(18px)}.wa-tool,.wa-send{display:grid;place-items:center;flex:0 0 34px;width:34px;height:34px;border:1px solid rgba(255,255,255,.08);border-radius:11px;background:rgba(255,255,255,.035);color:#8490a2;cursor:pointer;transition:transform .2s ease,background .2s ease}.wa-tool:hover,.wa-send:hover{transform:translateY(-2px);background:rgba(139,92,246,.12)}.wa-tool:disabled,.wa-send:disabled{opacity:.35;cursor:not-allowed;transform:none}.wa-send{color:#fff;background:linear-gradient(135deg,#7c3aed,#06b6d4);border-color:transparent}.wa-textarea{min-height:34px;max-height:120px;flex:1;resize:none;padding:9px 11px;border:1px solid rgba(255,255,255,.08);border-radius:12px;outline:0;background:rgba(255,255,255,.035);color:#edf2f8;font:inherit;font-size:11px}.wa-textarea:focus{border-color:rgba(139,92,246,.45)}.wa-error{margin:8px 16px 0;padding:8px 10px;border:1px solid rgba(248,113,113,.2);border-radius:10px;background:rgba(248,113,113,.06);color:#fca5a5;font-size:9px}.wa-attachment{display:flex;align-items:center;gap:7px;margin:8px 16px 0;padding:7px 9px;border:1px solid rgba(255,255,255,.08);border-radius:10px;background:rgba(255,255,255,.035);color:#aeb8c8;font-size:9px}.wa-attachment span{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.wa-attachment button{border:0;background:transparent;color:#8994a5;cursor:pointer}.wa-quick{display:flex;gap:7px;overflow:auto;padding:9px 16px 0}.wa-quick button{flex:0 0 auto;border:1px solid rgba(255,255,255,.08);border-radius:10px;background:rgba(255,255,255,.035);color:#aeb8c8;padding:7px 9px;font-size:9px;cursor:pointer}.wa-recording{display:flex;align-items:center;gap:8px;flex:1;height:34px;padding-left:9px;color:#fb7185;font-size:10px;font-weight:800}.wa-recording i{width:7px;height:7px;border-radius:50%;background:#fb7185;box-shadow:0 0 12px #fb7185;animation:wa-pulse 1s infinite}.wa-drop{position:absolute;inset:70px 0 0;display:grid;place-items:center;z-index:5;background:rgba(6,8,12,.7);backdrop-filter:blur(10px)}.wa-drop-card{padding:28px 34px;text-align:center;border:1px solid rgba(167,139,250,.3);border-radius:22px;background:rgba(20,17,30,.92);box-shadow:0 30px 80px rgba(0,0,0,.4);transform:perspective(800px) rotateX(2deg)}.wa-drop-card strong,.wa-drop-card span{display:block}.wa-drop-card strong{margin-top:10px;font-size:14px}.wa-drop-card span{margin-top:5px;color:#7f8a9d;font-size:9px}@keyframes wa-flow{0%{transform:translateX(-12%)}100%{transform:translateX(12%)}}@keyframes wa-in{from{opacity:0;transform:translateY(7px) scale(.99)}to{opacity:1;transform:none}}@keyframes wa-pulse{50%{opacity:.35;transform:scale(.7)}}
        @media(max-width:850px){.wa-grid{grid-template-columns:250px minmax(0,1fr)}.wa-bubble-wrap{max-width:84%}}@media(max-width:650px){.wa-inbox{height:calc(100vh - 120px);min-height:560px;border-radius:20px}.wa-grid{grid-template-columns:1fr}.wa-sidebar{display:none}.wa-chat{grid-template-rows:62px minmax(0,1fr) auto}.wa-stream{padding:16px 12px}.wa-compose-row{padding:9px}.wa-tool,.wa-send{flex-basis:32px;width:32px}.wa-bubble-wrap{max-width:88%}}
        @media(prefers-reduced-motion:reduce){.wa-stream:after,.wa-message,.wa-recording i{animation:none}.wa-row,.wa-bubble,.wa-tool,.wa-send{transition:none}}
      `}</style>
      <div className="wa-grid">
        <aside className="wa-sidebar">
          <div className="wa-side-top">
            <div className="wa-kicker">Command center</div>
            <div className="wa-side-title"><h2>Inbox</h2><div className="wa-live"><i />{live ? "LIVE" : "OFFLINE"}</div></div>
            <div className="wa-count">{conversations.length} active conversation{conversations.length === 1 ? "" : "s"}</div>
            <label className="wa-search"><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search chats, names, numbers…" /></label>
          </div>
          <div className="wa-list">
            {loading ? <div className="wa-empty">Syncing WhatsApp…</div> : filtered.length === 0 ? <div className="wa-empty">{search ? "No matching conversations." : "No conversations yet."}</div> : filtered.map((conversation) => (
              <button className={`wa-row ${selected === conversation.chatId ? "selected" : ""}`} key={conversation.chatId} onClick={() => setSelected(conversation.chatId)}>
                <Avatar name={nameOf(conversation)} src={conversation.avatar} />
                <div className="wa-row-copy"><strong>{nameOf(conversation)}</strong><span>{conversation.lastMessage || phoneOf(conversation) || "Conversation"}</span></div>
                <div className="wa-row-meta"><time>{time(conversation.timestamp)}</time>{conversation.unread > 0 && <b className="wa-unread">{conversation.unread > 99 ? "99+" : conversation.unread}</b>}</div>
              </button>
            ))}
          </div>
        </aside>

        <main className="wa-chat" onDragEnter={(event) => { event.preventDefault(); setDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={(event) => { if (event.currentTarget === event.target) setDragging(false); }} onDrop={(event) => { event.preventDefault(); setDragging(false); pickFile(event.dataTransfer.files?.[0] || null); }}>
          <header className="wa-chat-head">
            {current ? <><Avatar name={title} src={current.avatar} large /><div className="wa-chat-copy"><strong>{title}</strong><span>{phoneOf(current) || "WhatsApp conversation"}</span></div><div className="wa-chat-status"><i />{live ? "Realtime" : "Reconnecting"}</div></> : <div className="wa-chat-copy"><strong>Select a conversation</strong><span>Your WhatsApp messages will appear here.</span></div>}
          </header>

          <div className="wa-stream">
            {messages.length === 0 && selected && <div className="wa-empty">No messages in this conversation.</div>}
            {messages.map((message, index) => {
              const showDay = index === 0 || day(messages[index - 1].timestamp) !== day(message.timestamp);
              return (
                <div key={message.id}>
                  {showDay && <div className="wa-day"><span>{day(message.timestamp)}</span></div>}
                  <div className={`wa-message ${message.fromMe ? "mine" : "theirs"}`}>
                    {!message.fromMe && <Avatar name={nameOf(message)} src={message.avatar} />}
                    <div className="wa-bubble-wrap">
                      {!message.fromMe && <div className="wa-sender">{nameOf(message)}</div>}
                      <div className="wa-bubble">
                        {message.hasMedia && message.media?.data && <div className="wa-media">
                          {message.media.mimetype?.startsWith("image/") ? <img src={`data:${message.media.mimetype};base64,${message.media.data}`} alt={message.media.filename || "Image"} /> : message.media.mimetype?.startsWith("video/") ? <video controls src={`data:${message.media.mimetype};base64,${message.media.data}`} /> : message.media.mimetype?.startsWith("audio/") ? <audio controls src={`data:${message.media.mimetype};base64,${message.media.data}`} /> : <div className="wa-file"><FileText size={15} /><span>{message.media.filename || "Document"}</span></div>}
                        </div>}
                        {message.body && <div className="wa-body">{message.body}</div>}
                        <div className="wa-time">{time(message.timestamp)} {message.fromMe && <CheckCheck size={10} style={{ verticalAlign: "middle" }} />}</div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          <div className="wa-composer">
            {error && <div className="wa-error">{error}</div>}
            {file && <div className="wa-attachment">{kindFor(file) === "image" ? <ImageIcon size={13} /> : kindFor(file) === "video" ? <Video size={13} /> : <FileText size={13} />}<span>{file.name}</span><button onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ""; }}><X size={13} /></button></div>}
            {quickOpen && <div className="wa-quick">{QUICK.map((quick) => <button key={quick} onClick={() => { setText(quick); setQuickOpen(false); }}>{quick}</button>)}</div>}
            <div className="wa-compose-row">
              <input ref={fileRef} type="file" hidden accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" onChange={(event) => pickFile(event.target.files?.[0] || null)} />
              <button className="wa-tool" title="Attach file" disabled={!selected || sending} onClick={() => fileRef.current?.click()}><Paperclip size={15} /></button>
              <button className="wa-tool" title="Quick replies" disabled={!selected || sending} onClick={() => setQuickOpen((open) => !open)}><Zap size={15} /></button>
              {recording ? <div className="wa-recording"><i />{Math.floor(recordSeconds / 60).toString().padStart(2, "0")}:{(recordSeconds % 60).toString().padStart(2, "0")}<button className="wa-tool" onClick={stopRecording} title="Stop recording"><Send size={13} /></button></div> : <><button className="wa-tool" title="Voice message" disabled={!selected || sending} onClick={() => void startRecording()}><Mic size={15} /></button><textarea className="wa-textarea" value={text} onChange={(event) => setText(event.target.value)} onKeyDown={onKey} disabled={!selected || sending} placeholder={selected ? "Write a message…  Enter to send · Shift+Enter for a new line" : "Select a conversation to start"} /><button className="wa-send" disabled={!selected || sending || (!text.trim() && !file)} onClick={() => void sendMessage()} title="Send"><Send size={16} /></button></>}
            </div>
          </div>
          {dragging && <div className="wa-drop"><div className="wa-drop-card"><Sparkles size={26} /><strong>Drop media to attach</strong><span>Images, video, audio and documents · 25 MB max</span></div></div>}
        </main>
      </div>
    </section>
  );
}
