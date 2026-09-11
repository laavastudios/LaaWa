"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Clock3, MessageCircle, Pencil, Plus, RefreshCw, Save, UserRound, X } from "lucide-react";

type Tag = { id: string; name: string };
type Contact = {
  id: string;
  name: string | null;
  push_name: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  stage: string;
  value: number;
  tags: Tag[];
  last_message_at: string | null;
};
type ApiData = { contacts: Contact[]; tags: Array<Tag & { count: number }> };
type Message = {
  id: string;
  conversation_id: string;
  direction: "inbound" | "outbound";
  message_type: string;
  body: string | null;
  status: string | null;
  created_at: string;
};
type Conversation = {
  id: string;
  chat_id: string;
  title: string | null;
  status: string;
  unread_count: number;
  last_message_at: string | null;
  last_message_preview: string | null;
  message_count: number;
};
type Detail = { tags: Tag[]; conversations: Conversation[]; messages: Message[]; selectedConversationId: string | null };

export default function Customer360Hub() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [tags, setTags] = useState<ApiData["tags"]>([]);
  const [selected, setSelected] = useState<Contact | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [activeConversation, setActiveConversation] = useState<string>("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState({ name: "", phone: "", email: "", notes: "" });

  async function loadContacts() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/contacts?q=${encodeURIComponent(query)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load contacts");
      const nextContacts: Contact[] = data.contacts || [];
      setContacts(nextContacts);
      setTags(data.tags || []);
      setSelected((current) => current ? nextContacts.find((contact) => contact.id === current.id) || null : current);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load contacts");
    } finally {
      setLoading(false);
    }
  }

  async function loadDetail(contact: Contact, conversationId = "") {
    setDetailLoading(true);
    setError("");
    try {
      const suffix = conversationId ? `?conversationId=${encodeURIComponent(conversationId)}` : "";
      const response = await fetch(`/api/contacts/${contact.id}${suffix}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load customer");
      setDetail({
        tags: data.tags || [],
        conversations: data.conversations || [],
        messages: data.messages || [],
        selectedConversationId: data.selectedConversationId || null,
      });
      setActiveConversation(data.selectedConversationId || "");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load customer");
    } finally {
      setDetailLoading(false);
    }
  }

  async function openContact(contact: Contact) {
    setSelected(contact);
    setEditing(false);
    setActiveConversation("");
    await loadDetail(contact);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void loadContacts(), 180);
    return () => window.clearTimeout(timer);
  }, [query]);

  const selectedTagIds = useMemo(() => new Set((selected?.tags || []).map((tag) => tag.id)), [selected]);

  function beginEdit() {
    if (!selected) return;
    setDraft({
      name: selected.name || selected.push_name || "",
      phone: selected.phone || "",
      email: selected.email || "",
      notes: selected.notes || "",
    });
    setEditing(true);
  }

  async function saveContact() {
    if (!selected) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/contacts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selected.id, ...draft }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save contact");
      setEditing(false);
      await loadContacts();
      const refreshed = { ...selected, name: draft.name || null, phone: draft.phone || null, email: draft.email || null, notes: draft.notes || null };
      setSelected(refreshed);
      await loadDetail(refreshed, activeConversation);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save contact");
    } finally {
      setSaving(false);
    }
  }

  async function toggleTag(tagId: string) {
    if (!selected || saving) return;
    setSaving(true);
    setError("");
    const nextIds = selectedTagIds.has(tagId)
      ? selected.tags.filter((tag) => tag.id !== tagId).map((tag) => tag.id)
      : [...selected.tags.map((tag) => tag.id), tagId];

    try {
      const response = await fetch("/api/contacts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selected.id, action: "tags", tagIds: nextIds }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not update tags");

      const refreshedResponse = await fetch(`/api/contacts?q=${encodeURIComponent(query)}`, { cache: "no-store" });
      const refreshed = await refreshedResponse.json();
      if (!refreshedResponse.ok) throw new Error(refreshed.error || "Could not refresh contacts");
      const nextContacts: Contact[] = refreshed.contacts || [];
      const nextContact = nextContacts.find((contact) => contact.id === selected.id);
      setContacts(nextContacts);
      setTags(refreshed.tags || []);
      if (nextContact) {
        setSelected(nextContact);
        await loadDetail(nextContact, activeConversation);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update tags");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="customer360">
      <div className="customer360-hero glass">
        <div>
          <div className="eyebrow">CUSTOMER 360 / LIVE</div>
          <h2>Every customer. One view.</h2>
          <p className="muted">Real CRM context, tags, conversations, and message history in one workspace.</p>
        </div>
        <div className="customer360-orbit"><span /><i /><b /></div>
      </div>

      <div className="customer360-layout">
        <section className="panel glass">
          <div className="panel-head">
            <div><h2>Contacts</h2><span className="small muted">{contacts.length} matching records</span></div>
            <button className="icon-button" onClick={() => void loadContacts()} title="Refresh"><RefreshCw size={16} /></button>
          </div>
          <input className="setting-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, phone, email…" />
          {error && <div className="error">{error}</div>}
          {loading ? <div className="empty">Loading customer graph…</div> : contacts.length === 0 ? (
            <div className="empty"><strong>No contacts found</strong><span>Contacts appear here from your connected WhatsApp workspace.</span></div>
          ) : (
            <div className="customer-list">
              {contacts.map((contact) => (
                <button className={`customer-row ${selected?.id === contact.id ? "active" : ""}`} key={contact.id} onClick={() => void openContact(contact)}>
                  <span className="customer-avatar">{(contact.name || contact.push_name || "?").slice(0, 1).toUpperCase()}</span>
                  <span className="customer-main"><strong>{contact.name || contact.push_name || contact.phone || "Unknown contact"}</strong><small>{contact.phone || contact.email || "No contact detail"}</small></span>
                  <span className="customer-stage">{contact.stage}</span>
                </button>
              ))}
            </div>
          )}
        </section>

        <aside className="panel glass customer-profile">
          {!selected ? <div className="empty"><strong>Select a customer</strong><span>The profile panel will show CRM context, conversations, and message history.</span></div> : detailLoading ? <div className="empty">Loading customer timeline…</div> : editing ? (
            <>
              <div className="panel-head"><div><div className="eyebrow">EDIT PROFILE</div><h2>Customer details</h2></div><button className="icon-button" onClick={() => setEditing(false)} title="Cancel"><X size={17} /></button></div>
              <label>Name<input className="setting-input" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
              <label>Phone<input className="setting-input" value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} /></label>
              <label>Email<input className="setting-input" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} /></label>
              <label>Notes<textarea className="setting-input" value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} rows={5} /></label>
              <button className="primary" disabled={saving} onClick={() => void saveContact()}><Save size={16} /> {saving ? "Saving…" : "Save changes"}</button>
            </>
          ) : (
            <>
              <div className="profile-top"><div className="profile-orb">{(selected.name || selected.push_name || "?").slice(0, 1).toUpperCase()}</div><button className="icon-button" onClick={beginEdit} title="Edit customer"><Pencil size={16} /></button></div>
              <div className="eyebrow">CUSTOMER PROFILE</div>
              <h2>{selected.name || selected.push_name || selected.phone || "Unknown contact"}</h2>
              <p className="muted">{selected.phone || "No phone"}{selected.email ? ` · ${selected.email}` : ""}</p>
              <div className="profile-stats">
                <div><span>Stage</span><strong>{selected.stage}</strong></div>
                <div><span>Value</span><strong>{selected.value.toLocaleString()}</strong></div>
                <div><span>Chats</span><strong>{detail?.conversations.length ?? 0}</strong></div>
                <div><span>Messages</span><strong>{detail?.messages.length ?? 0}</strong></div>
              </div>

              <div className="tag-section">
                <span className="small muted">Tags</span>
                <div className="tag-list">{detail?.tags.length ? detail.tags.map((tag) => <span key={tag.id}>{tag.name}</span>) : <span className="muted">No tags</span>}</div>
                <div className="tag-picker">{tags.map((tag) => <button key={tag.id} disabled={saving} className={selectedTagIds.has(tag.id) ? "active" : ""} onClick={() => void toggleTag(tag.id)}>{selectedTagIds.has(tag.id) ? <Check size={12} /> : <Plus size={12} />} {tag.name}<small>{tag.count}</small></button>)}</div>
              </div>

              {selected.notes && <div className="profile-note"><span>Notes</span><p>{selected.notes}</p></div>}

              <div className="timeline-head"><div><div className="eyebrow">CONVERSATION TIMELINE</div><h3>Recent messages</h3></div><span className="small muted">{detail?.messages.length ?? 0} loaded</span></div>
              <div className="conversation-switcher">
                <button className={!activeConversation ? "active" : ""} onClick={() => void loadDetail(selected)}><span>All conversations</span><small>{detail?.conversations.reduce((sum, conversation) => sum + Number(conversation.message_count || 0), 0) || 0} messages</small></button>
                {detail?.conversations.map((conversation) => (
                  <button key={conversation.id} className={activeConversation === conversation.id ? "active" : ""} onClick={() => void loadDetail(selected, conversation.id)}>
                    <span>{conversation.title || conversation.chat_id}</span>
                    <small>{conversation.message_count} messages{conversation.unread_count ? ` · ${conversation.unread_count} unread` : ""}</small>
                  </button>
                ))}
              </div>

              <div className="customer-timeline">
                {detail?.messages.length ? detail.messages.map((message) => (
                  <article key={message.id} className={`timeline-message ${message.direction}`}>
                    <div className="timeline-icon">{message.direction === "inbound" ? <UserRound size={13} /> : <MessageCircle size={13} />}</div>
                    <div>
                      <div className="timeline-meta"><span>{message.direction === "inbound" ? "Customer" : "LaaWa"}</span><time><Clock3 size={11} />{new Date(message.created_at).toLocaleString()}</time></div>
                      <p>{message.body || `[${message.message_type}]`}</p>
                    </div>
                  </article>
                )) : <div className="empty">No messages yet.</div>}
              </div>
            </>
          )}
        </aside>
      </div>
    </section>
  );
}
