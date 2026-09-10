"use client";

import { useEffect, useMemo, useState } from "react";

type Conversation = { chatId: string; name: string; phone: string; lastMessage: string; timestamp: number; unread: number };
type Message = { id: string; chatId: string; body: string; timestamp: number; fromMe: boolean; name: string; phone: string; read: boolean };

function time(ts: number) {
  if (!ts) return "";
  return new Date(ts * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function Inbox() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selected, setSelected] = useState("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function loadConversations() {
    try {
      const r = await fetch("/api/whatsapp/status", { cache: "no-store" });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Could not load WhatsApp.");
      setConversations(Array.isArray(data.conversations) ? data.conversations : []);
      if (!selected && data.conversations?.[0]) setSelected(data.conversations[0].chatId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load inbox.");
    } finally {
      setLoading(false);
    }
  }

  async function loadMessages(chatId: string) {
    if (!chatId) return;
    try {
      const r = await fetch(`/api/whatsapp/status?chatId=${encodeURIComponent(chatId)}`, { cache: "no-store" });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Could not load conversation.");
      setMessages(Array.isArray(data.messages) ? data.messages : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load conversation.");
    }
  }

  useEffect(() => { loadConversations(); const timer = window.setInterval(loadConversations, 3000); return () => window.clearInterval(timer); }, []);
  useEffect(() => { loadMessages(selected); const timer = window.setInterval(() => loadMessages(selected), 2500); return () => window.clearInterval(timer); }, [selected]);

  async function send() {
    const body = text.trim();
    if (!selected || !body || sending) return;
    setSending(true); setError("");
    try {
      const r = await fetch("/api/whatsapp/logout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "send", chatId: selected, body }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Message could not be sent.");
      setText("");
      await loadMessages(selected);
      await loadConversations();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Message could not be sent.");
    } finally {
      setSending(false);
    }
  }

  const selectedConversation = useMemo(() => conversations.find((c) => c.chatId === selected), [conversations, selected]);

  return (
    <section className="panel glass" style={{ padding: 0, overflow: "hidden", minHeight: 650 }}>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(240px, 32%) 1fr", minHeight: 650 }}>
        <div style={{ borderRight: "1px solid var(--line)", background: "rgba(7,10,15,.55)" }}>
          <div style={{ padding: 18, borderBottom: "1px solid var(--line)" }}><div className="eyebrow">MESSAGES</div><h2 style={{ margin: "5px 0 0" }}>Inbox</h2><div className="small muted" style={{ marginTop: 5 }}>{conversations.length} conversation{conversations.length === 1 ? "" : "s"}</div></div>
          {loading ? <div className="empty" style={{ margin: 14, minHeight: 140 }}>Loading conversations…</div> : conversations.length === 0 ? <div className="empty" style={{ margin: 14, minHeight: 180 }}><strong>No conversations yet</strong><span>Connect WhatsApp and receive a message.</span></div> : conversations.map((c) => (
            <button key={c.chatId} onClick={() => setSelected(c.chatId)} style={{ width: "100%", display: "grid", gridTemplateColumns: "42px 1fr auto", gap: 10, alignItems: "center", textAlign: "left", padding: 14, border: 0, borderBottom: "1px solid var(--line)", background: selected === c.chatId ? "rgba(139,92,246,.10)" : "transparent", color: "inherit" }}>
              <div style={{ width: 42, height: 42, display: "grid", placeItems: "center", borderRadius: "50%", background: "linear-gradient(135deg,rgba(139,92,246,.28),rgba(34,211,238,.12))", fontWeight: 800 }}>{(c.name || c.phone || "?").slice(0, 1).toUpperCase()}</div>
              <div style={{ minWidth: 0 }}><strong style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name || c.phone || "Unknown"}</strong><span className="small muted" style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 3 }}>{c.lastMessage || "No message"}</span></div>
              <div style={{ display: "grid", gap: 5, justifyItems: "end" }}><span className="small muted">{time(c.timestamp)}</span>{c.unread > 0 && <span style={{ minWidth: 20, height: 20, padding: "0 6px", display: "grid", placeItems: "center", borderRadius: 99, background: "#22c55e", color: "#06110a", fontSize: 10, fontWeight: 800 }}>{c.unread}</span>}</div>
            </button>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateRows: "auto 1fr auto", minWidth: 0 }}>
          <div style={{ padding: "18px 20px", borderBottom: "1px solid var(--line)" }}>
            <div className="eyebrow">CONVERSATION</div>
            <h2 style={{ margin: "5px 0 0" }}>{selectedConversation?.name || selectedConversation?.phone || "Select a conversation"}</h2>
            {selectedConversation?.phone && <div className="small muted" style={{ marginTop: 4 }}>+{selectedConversation.phone}</div>}
          </div>
          <div style={{ padding: 20, overflowY: "auto", display: "grid", alignContent: "start", gap: 10 }}>
            {!selected ? <div className="empty" style={{ minHeight: 220 }}><strong>Your inbox is ready</strong><span>Select a WhatsApp conversation.</span></div> : messages.length === 0 ? <div className="empty" style={{ minHeight: 220 }}><strong>No messages yet</strong><span>This conversation has no stored messages.</span></div> : messages.map((m) => (
              <div key={m.id} style={{ display: "flex", justifyContent: m.fromMe ? "flex-end" : "flex-start" }}><div style={{ maxWidth: "72%", padding: "10px 13px", borderRadius: m.fromMe ? "15px 15px 4px 15px" : "15px 15px 15px 4px", background: m.fromMe ? "linear-gradient(135deg,rgba(124,58,237,.8),rgba(6,182,212,.65))" : "rgba(255,255,255,.055)", border: "1px solid var(--line)", boxShadow: "0 8px 25px rgba(0,0,0,.12)" }}><div style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{m.body || "[media/message]"}</div><div style={{ marginTop: 5, fontSize: 10, opacity: .65, textAlign: "right" }}>{time(m.timestamp)}</div></div></div>
            ))}
          </div>
          <div style={{ padding: 14, borderTop: "1px solid var(--line)", display: "flex", gap: 10 }}>
            <input className="setting-input" style={{ margin: 0 }} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder={selected ? "Write a message…" : "Select a conversation first"} disabled={!selected || sending} />
            <button className="primary compact" onClick={send} disabled={!selected || !text.trim() || sending}>{sending ? "Sending…" : "Send"}</button>
          </div>
          {error && <div className="error" style={{ padding: "0 14px 14px" }}>{error}</div>}
        </div>
      </div>
    </section>
  );
}
