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
      if (selected) loadMessages(selected, true);
    });
    source.addEventListener("sync", () => {
      loadConversations();
      if (selected) loadMessages(selected, false);
    });
    source.onerror = () => setLive(false);
    return () => source.close();
  }, [selected]);

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
    <section className="panel glass" style={{ padding: 0, overflow: "hidden", minHeight: 680, borderRadius: 22 }}>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(290px, 34%) 1fr", height: 680 }}>
        <aside style={{ borderRight: "1px solid var(--line)", background: "linear-gradient(180deg,rgba(9,12,19,.92),rgba(7,10,15,.7))", overflow: "hidden" }}>
          <div style={{ padding: "22px 20px 16px", borderBottom: "1px solid var(--line)", background: "rgba(255,255,255,.018)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div><div className="eyebrow">MESSAGING CENTER</div><h2 style={{ margin: "6px 0 0", fontSize: 24 }}>Inbox</h2></div>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 9px", borderRadius: 999, border: "1px solid rgba(34,197,94,.25)", background: "rgba(34,197,94,.07)", color: "#4ade80", fontSize: 10, fontWeight: 800, letterSpacing: ".08em" }}><i style={{ width: 6, height: 6, borderRadius: "50%", background: live ? "#4ade80" : "#f59e0b", boxShadow: live ? "0 0 12px #4ade80" : "none" }} />{live ? "LIVE" : "RECONNECTING"}</span>
            </div>
            <div className="small muted" style={{ marginTop: 7 }}>{conversations.length} active conversation{conversations.length === 1 ? "" : "s"} · real-time sync</div>
          </div>
          <div style={{ height: "calc(100% - 104px)", overflowY: "auto" }}>
            {loading ? <div className="empty" style={{ margin: 14, minHeight: 140 }}>Loading conversations…</div> : conversations.length === 0 ? <div className="empty" style={{ margin: 14, minHeight: 190 }}><strong>No conversations yet</strong><span>Connect WhatsApp and receive a message. Recent chats are imported automatically.</span></div> : conversations.map((c) => (
              <button key={c.chatId} onClick={() => setSelected(c.chatId)} style={{ width: "100%", display: "grid", gridTemplateColumns: "44px 1fr auto", gap: 11, alignItems: "center", textAlign: "left", padding: "13px 16px", border: 0, borderBottom: "1px solid rgba(255,255,255,.045)", borderLeft: selected === c.chatId ? "2px solid #8b5cf6" : "2px solid transparent", background: selected === c.chatId ? "linear-gradient(90deg,rgba(139,92,246,.14),rgba(139,92,246,.035))" : "transparent", color: "inherit", cursor: "pointer" }}>
                <div style={{ width: 44, height: 44, display: "grid", placeItems: "center", borderRadius: "50%", background: "linear-gradient(135deg,rgba(139,92,246,.32),rgba(34,211,238,.13))", border: "1px solid rgba(255,255,255,.09)", fontWeight: 800, fontSize: 13 }}>{(c.name || c.phone || "?").slice(0, 1).toUpperCase()}</div>
                <div style={{ minWidth: 0 }}><strong style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13 }}>{c.name || c.phone || "Unknown"}</strong><span className="small muted" style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 4 }}>{c.lastMessage || "No message"}</span></div>
                <div style={{ display: "grid", gap: 5, justifyItems: "end" }}><span className="small muted">{time(c.timestamp)}</span>{c.unread > 0 && <span style={{ minWidth: 20, height: 20, padding: "0 6px", display: "grid", placeItems: "center", borderRadius: 99, background: "#22c55e", color: "#06110a", fontSize: 10, fontWeight: 900 }}>{c.unread}</span>}</div>
              </button>
            ))}
          </div>
        </aside>

        <div style={{ display: "grid", gridTemplateRows: "auto 1fr auto", minWidth: 0, background: "radial-gradient(circle at 80% 0%,rgba(124,58,237,.08),transparent 34%),rgba(5,8,13,.55)" }}>
          <header style={{ padding: "17px 22px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 12, background: "rgba(255,255,255,.018)", backdropFilter: "blur(16px)" }}>
            {selectedConversation && <div style={{ width: 43, height: 43, display: "grid", placeItems: "center", borderRadius: "50%", background: "linear-gradient(135deg,#7c3aed,#0891b2)", fontWeight: 900 }}>{initials}</div>}
            <div style={{ minWidth: 0 }}><div className="eyebrow">CONVERSATION</div><h2 style={{ margin: "4px 0 0", fontSize: 18, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selectedConversation?.name || selectedConversation?.phone || "Select a conversation"}</h2>{selectedConversation?.phone && <div className="small muted" style={{ marginTop: 2 }}>+{selectedConversation.phone}</div>}</div>
            {selectedConversation && <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 7, fontSize: 11, color: "#4ade80" }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: "#4ade80", boxShadow: "0 0 10px #4ade80" }} /> WhatsApp live</div>}
          </header>

          <div style={{ padding: "20px 22px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
            {!selected ? <div className="empty" style={{ minHeight: 250, margin: "auto", width: "min(460px,100%)" }}><strong>Live inbox is ready</strong><span>Choose a conversation. New WhatsApp messages will appear here instantly.</span></div> : messages.length === 0 ? <div className="empty" style={{ minHeight: 220, margin: "auto", width: "min(460px,100%)" }}><strong>No messages yet</strong><span>Waiting for the first message in this conversation.</span></div> : messages.map((m, i) => (
              <div key={m.id} style={{ display: "flex", justifyContent: m.fromMe ? "flex-end" : "flex-start", marginTop: i && day(m.timestamp) !== day(messages[i - 1].timestamp) ? 12 : 0 }}>
                <div style={{ maxWidth: "min(72%, 620px)", padding: "11px 14px 8px", borderRadius: m.fromMe ? "17px 17px 5px 17px" : "17px 17px 17px 5px", background: m.fromMe ? "linear-gradient(135deg,rgba(124,58,237,.94),rgba(8,145,178,.84))" : "rgba(255,255,255,.055)", border: "1px solid rgba(255,255,255,.09)", boxShadow: m.fromMe ? "0 8px 28px rgba(124,58,237,.13)" : "0 8px 22px rgba(0,0,0,.14)" }}><div style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", lineHeight: 1.45 }}>{m.body || "[media/message]"}</div><div style={{ marginTop: 5, fontSize: 10, opacity: .6, textAlign: "right" }}>{time(m.timestamp)} {m.fromMe ? "✓✓" : ""}</div></div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          <div style={{ padding: "13px 15px", borderTop: "1px solid var(--line)", background: "rgba(5,8,13,.8)", backdropFilter: "blur(18px)" }}>
            {error && <div className="error" style={{ margin: "0 2px 9px", padding: "8px 10px", borderRadius: 10 }}>{error}</div>}
            <div style={{ display: "flex", gap: 9, alignItems: "end" }}><input className="setting-input" style={{ margin: 0, minHeight: 44, borderRadius: 14 }} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder={selected ? "Type a WhatsApp message…" : "Select a conversation first"} disabled={!selected || sending} /><button className="primary compact" style={{ minHeight: 44, padding: "0 20px", borderRadius: 14 }} onClick={send} disabled={!selected || !text.trim() || sending}>{sending ? "Sending…" : "Send"}</button></div>
            <div className="small muted" style={{ margin: "7px 3px 0" }}>{live ? "Connected to live message stream" : "Reconnecting to live message stream…"} · Enter to send</div>
          </div>
        </div>
      </div>
    </section>
  );
}
