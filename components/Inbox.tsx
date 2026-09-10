"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Conversation = { chatId: string; name: string; phone: string; lastMessage: string; timestamp: number; unread: number };
type Message = { id: string; chatId: string; body: string; timestamp: number; fromMe: boolean; name: string; phone: string; read: boolean };

function time(ts: number) { return ts ? new Date(ts * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""; }
function day(ts: number) { return ts ? new Date(ts * 1000).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" }) : ""; }
function isChannel(id: string) { return id.includes("@lid"); }
function displayName(c?: Conversation | Message, fallback = "Unknown") {
  if (!c) return fallback;
  if (isChannel(c.chatId)) return c.name && !c.name.includes("@lid") ? c.name : "WhatsApp Channel";
  return c.name && !c.name.includes("@c.us") && !c.name.includes("@lid") ? c.name : c.phone || fallback;
}
function displayPhone(c?: Conversation | Message) {
  if (!c || isChannel(c.chatId)) return "";
  return c.phone ? `+${c.phone.replace(/^\+/, "")}` : "";
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
  const bottomRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef("");

  useEffect(() => { selectedRef.current = selected; }, [selected]);

  async function loadConversations() {
    try {
      const r = await fetch("/api/whatsapp/messages", { cache: "no-store" });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Could not load inbox.");
      const next = Array.isArray(data.conversations) ? data.conversations : [];
      setConversations(next);
      setSelected((current) => current || next[0]?.chatId || "");
      setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load inbox."); }
    finally { setLoading(false); }
  }

  async function loadMessages(chatId: string, scroll = false) {
    if (!chatId) return;
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
    loadConversations();
    const source = new EventSource("/api/whatsapp/events");
    source.addEventListener("open", () => setLive(true));
    source.addEventListener("state", () => loadConversations());
    source.addEventListener("snapshot", () => loadConversations());
    source.addEventListener("message", () => { loadConversations(); if (selectedRef.current) loadMessages(selectedRef.current, true); });
    source.addEventListener("sync", () => { loadConversations(); if (selectedRef.current) loadMessages(selectedRef.current, false); });
    source.onerror = () => setLive(false);
    return () => source.close();
  }, []);

  useEffect(() => {
    if (!selected) { setMessages([]); return; }
    loadMessages(selected);
  }, [selected]);

  useEffect(() => {
    const handler = () => { loadConversations(); if (selected) loadMessages(selected); };
    window.addEventListener("focus", handler);
    return () => window.removeEventListener("focus", handler);
  }, [selected]);

  async function send() {
    const body = text.trim();
    if (!selected || !body || sending) return;
    setSending(true); setError("");
    try {
      const r = await fetch("/api/whatsapp/messages", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chatId: selected, body }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Message could not be sent.");
      setText("");
      await loadMessages(selected, true);
      await loadConversations();
    } catch (e) { setError(e instanceof Error ? e.message : "Message could not be sent."); }
    finally { setSending(false); }
  }

  const selectedConversation = useMemo(() => conversations.find((c) => c.chatId === selected), [conversations, selected]);
  const channel = isChannel(selected);
  const title = displayName(selectedConversation, channel ? "WhatsApp Channel" : "Select a conversation");
  const initials = channel ? "WA" : title.slice(0, 2).toUpperCase();

  return (
    <section className="inbox-shell glass">
      <div className="inbox-layout">
        <aside className="inbox-list">
          <div className="inbox-list-head">
            <div><div className="eyebrow">MESSAGING CENTER</div><h2>Inbox</h2><p>{conversations.length} active conversation{conversations.length === 1 ? "" : "s"}</p></div>
            <span className={`live-pill ${live ? "on" : ""}`}><i />{live ? "LIVE" : "RECONNECTING"}</span>
          </div>
          <div className="conversation-scroll">
            {loading ? <div className="inbox-empty"><div className="spinner" /><span>Loading conversations…</span></div> : conversations.length === 0 ? <div className="inbox-empty"><strong>No conversations yet</strong><span>Connect WhatsApp and receive a message. Chats are imported automatically.</span></div> : conversations.map((c) => {
              const selectedRow = selected === c.chatId;
              const cChannel = isChannel(c.chatId);
              return <button key={c.chatId} className={`conversation-row ${selectedRow ? "selected" : ""}`} onClick={() => setSelected(c.chatId)}><div className="avatar">{cChannel ? "WA" : displayName(c, "?").slice(0, 2).toUpperCase()}</div><div className="conversation-copy"><strong>{displayName(c)}</strong><span>{c.lastMessage || "No message"}</span></div><div className="conversation-meta"><time>{time(c.timestamp)}</time>{c.unread > 0 && <b>{c.unread}</b>}</div></button>;
            })}
          </div>
        </aside>

        <div className="chat-pane">
          <header className="chat-head">
            <div className="avatar avatar-large">{selected ? initials : "WA"}</div>
            <div className="chat-identity"><div className="eyebrow">{channel ? "CHANNEL" : "CONVERSATION"}</div><h2>{title}</h2><span>{displayPhone(selectedConversation) || (selected ? "Connected through WhatsApp Web" : "Select a conversation")}</span></div>
            {selected && <div className="chat-live"><i /> WhatsApp live</div>}
          </header>

          <div className="message-scroll">
            {!selected ? <div className="inbox-empty center"><strong>Your live inbox</strong><span>Select a conversation to view messages. Incoming WhatsApp messages appear automatically.</span></div> : messages.length === 0 ? <div className="inbox-empty center"><strong>No messages yet</strong><span>Waiting for the first message in this conversation.</span></div> : messages.map((m, i) => <div key={m.id} className="message-wrap">{i > 0 && day(m.timestamp) !== day(messages[i - 1].timestamp) && <div className="day-divider"><span>{day(m.timestamp)}</span></div>}<div className={`message-row ${m.fromMe ? "mine" : "theirs"}`}><div className="message-bubble"><div className="message-body">{m.body || "[media/message]"}</div><div className="message-time">{time(m.timestamp)} {m.fromMe ? "✓✓" : ""}</div></div></div></div>)}
            <div ref={bottomRef} />
          </div>

          <div className="composer-wrap">
            {error && <div className="inbox-error">{error}</div>}
            <div className="composer"><input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder={selected ? "Write a WhatsApp message…" : "Select a conversation first"} disabled={!selected || sending} /><button onClick={send} disabled={!selected || !text.trim() || sending}>{sending ? "Sending…" : "Send"}</button></div>
            <div className="composer-hint"><span>{live ? "Live stream connected" : "Reconnecting to live stream…"}</span><span>Enter to send</span></div>
          </div>
        </div>
      </div>
    </section>
  );
}
