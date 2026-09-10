"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Conversation = { chatId: string; name: string; phone: string; lastMessage: string; timestamp: number; unread: number };
type Message = { id: string; chatId: string; body: string; timestamp: number; fromMe: boolean; name: string; phone: string; read: boolean };

function time(ts: number) { return ts ? new Date(ts * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""; }
function day(ts: number) { return ts ? new Date(ts * 1000).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" }) : ""; }

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
    source.addEventListener("message", () => {
      loadConversations();
      if (selectedRef.current) loadMessages(selectedRef.current, true);
    });
    source.addEventListener("sync", () => {
      loadConversations();
      if (selectedRef.current) loadMessages(selectedRef.current, false);
    });
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
  const initials = (selectedConversation?.name || selectedConversation?.phone || "?").slice(0, 2).toUpperCase();

  return (
    <section className="panel glass inbox-shell">
      <div className="inbox-grid">
        <aside className="inbox-list">
          <div className="inbox-list-head">
            <div><div className="eyebrow">MESSAGING CENTER</div><h2>Inbox</h2><p>{conversations.length} active conversation{conversations.length === 1 ? "" : "s"}</p></div>
            <span className={`live-pill ${live ? "on" : ""}`}><i />{live ? "LIVE" : "RECONNECTING"}</span>
          </div>
          <div className="inbox-conversations">
            {loading ? <div className="empty inbox-empty">Loading conversations…</div> : conversations.length === 0 ? <div className="empty inbox-empty"><strong>No conversations yet</strong><span>Connect WhatsApp and receive a message. Recent chats import automatically.</span></div> : conversations.map((c) => (
              <button key={c.chatId} className={`conversation ${selected === c.chatId ? "selected" : ""}`} onClick={() => setSelected(c.chatId)}>
                <div className="avatar">{(c.name || c.phone || "?").slice(0, 1).toUpperCase()}</div>
                <div className="conversation-main"><strong>{c.name || c.phone || "Unknown"}</strong><span>{c.lastMessage || "No message"}</span></div>
                <div className="conversation-meta"><small>{time(c.timestamp)}</small>{c.unread > 0 && <b>{c.unread}</b>}</div>
              </button>
            ))}
          </div>
        </aside>

        <div className="inbox-chat">
          <header className="chat-head">
            <div className="chat-person">
              <div className="avatar large">{initials}</div>
              <div><div className="eyebrow">CONVERSATION</div><h2>{selectedConversation?.name || selectedConversation?.phone || "Select a conversation"}</h2>{selectedConversation?.phone && <p>+{selectedConversation.phone}</p>}</div>
            </div>
            {selectedConversation && <div className="chat-live"><span /> WhatsApp live</div>}
          </header>

          <div className="message-area">
            {!selected ? <div className="empty chat-empty"><strong>Live inbox is ready</strong><span>Choose a conversation. New WhatsApp messages will appear here instantly.</span></div> : messages.length === 0 ? <div className="empty chat-empty"><strong>No messages yet</strong><span>Waiting for the first message in this conversation.</span></div> : messages.map((m, i) => (
              <div key={m.id} className={`message-row ${m.fromMe ? "outgoing" : "incoming"}`} style={{ marginTop: i && day(m.timestamp) !== day(messages[i - 1].timestamp) ? 16 : 0 }}>
                <div className="message-bubble"><div>{m.body || "[media/message]"}</div><small>{time(m.timestamp)} {m.fromMe ? "✓✓" : ""}</small></div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          <div className="composer">
            {error && <div className="error composer-error">{error}</div>}
            <div className="composer-row">
              <input className="setting-input" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder={selected ? "Write a WhatsApp message…" : "Select a conversation first"} disabled={!selected || sending} />
              <button className="primary compact send-button" onClick={send} disabled={!selected || !text.trim() || sending}>{sending ? "Sending…" : "Send"}</button>
            </div>
            <div className="composer-meta">{live ? "Live stream connected" : "Waiting for live stream"} · Enter to send</div>
          </div>
        </div>
      </div>
    </section>
  );
}
