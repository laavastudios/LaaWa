"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Pencil, Plus, Save, X } from "lucide-react";

type Tag = { id: string; name: string };
type Contact = { id: string; name: string | null; push_name: string | null; phone: string | null; email: string | null; notes: string | null; stage: string; value: number; tags: Tag[]; last_message_at: string | null };
type ApiData = { contacts: Contact[]; tags: Array<Tag & { count: number }> };

export default function Customer360Hub() {
  const [contacts, setContacts] = useState<Contact[]>([]), [tags, setTags] = useState<ApiData["tags"]>([]), [selected, setSelected] = useState<Contact | null>(null);
  const [query, setQuery] = useState(""), [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [editing, setEditing] = useState(false), [error, setError] = useState(""), [draft, setDraft] = useState({ name: "", phone: "", email: "", notes: "" });

  async function load() {
    setLoading(true); setError("");
    try {
      const r = await fetch(`/api/contacts?q=${encodeURIComponent(query)}`, { cache: "no-store" });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || "Could not load contacts");
      setContacts(d.contacts || []); setTags(d.tags || []);
      if (selected) setSelected((d.contacts || []).find((c: Contact) => c.id === selected.id) || null);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load contacts"); }
    finally { setLoading(false); }
  }
  useEffect(() => { const t = window.setTimeout(load, 180); return () => window.clearTimeout(t); }, [query]);

  const selectedTagIds = useMemo(() => new Set((selected?.tags || []).map(t => t.id)), [selected]);
  function beginEdit() { if (!selected) return; setDraft({ name: selected.name || selected.push_name || "", phone: selected.phone || "", email: selected.email || "", notes: selected.notes || "" }); setEditing(true); }
  async function saveContact() {
    if (!selected) return; setSaving(true); setError("");
    try { const r = await fetch("/api/contacts", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: selected.id, ...draft }) }); const d = await r.json(); if (!r.ok) throw new Error(d.error || "Could not save contact"); setEditing(false); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not save contact"); } finally { setSaving(false); }
  }
  async function toggleTag(tagId: string) {
    if (!selected || saving) return; setSaving(true); setError("");
    const next = selectedTagIds.has(tagId) ? selected.tags.filter(t => t.id !== tagId).map(t => t.id) : [...selected.tags.map(t => t.id), tagId];
    try { const r = await fetch("/api/contacts", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: selected.id, action: "tags", tagIds: next }) }); const d = await r.json(); if (!r.ok) throw new Error(d.error || "Could not update tags"); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not update tags"); } finally { setSaving(false); }
  }

  return <section className="customer360">
    <div className="customer360-hero glass"><div><div className="eyebrow">CUSTOMER 360 / LIVE</div><h2>Every customer. One view.</h2><p className="muted">Real contact records, CRM context, tags and editable customer details.</p></div><div className="customer360-orbit"><span/><i/><b/></div></div>
    <div className="customer360-layout">
      <section className="panel glass"><div className="panel-head"><div><h2>Contacts</h2><span className="small muted">{contacts.length} matching records</span></div><button className="primary compact" onClick={load}>Refresh</button></div><input className="setting-input" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search name, phone, email…" />
        {error && <div className="error">{error}</div>}
        {loading ? <div className="empty">Loading customer graph…</div> : contacts.length === 0 ? <div className="empty"><strong>No contacts found</strong><span>Contacts appear here from your connected WhatsApp workspace.</span></div> : <div className="customer-list">{contacts.map(c=><button className={`customer-row ${selected?.id===c.id?"active":""}`} key={c.id} onClick={()=>{setSelected(c);setEditing(false)}}><span className="customer-avatar">{(c.name||c.push_name||"?").slice(0,1).toUpperCase()}</span><span className="customer-main"><strong>{c.name||c.push_name||c.phone||"Unknown contact"}</strong><small>{c.phone||c.email||"No contact detail"}</small></span><span className="customer-stage">{c.stage}</span></button>)}</div>}
      </section>
      <aside className="panel glass customer-profile">{selected ? <>{editing ? <><div className="panel-head"><div><div className="eyebrow">EDIT PROFILE</div><h2>Customer details</h2></div><button className="icon-button" onClick={()=>setEditing(false)} title="Cancel"><X size={17}/></button></div><label>Name<input className="setting-input" value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></label><label>Phone<input className="setting-input" value={draft.phone} onChange={e=>setDraft({...draft,phone:e.target.value})}/></label><label>Email<input className="setting-input" value={draft.email} onChange={e=>setDraft({...draft,email:e.target.value})}/></label><label>Notes<textarea className="setting-input" value={draft.notes} onChange={e=>setDraft({...draft,notes:e.target.value})} rows={5}/></label><button className="primary" disabled={saving} onClick={saveContact}><Save size={16}/> {saving?"Saving…":"Save changes"}</button></> : <><div className="profile-top"><div className="profile-orb">{(selected.name||selected.push_name||"?").slice(0,1).toUpperCase()}</div><button className="icon-button" onClick={beginEdit} title="Edit customer"><Pencil size={16}/></button></div><div className="eyebrow">CUSTOMER PROFILE</div><h2>{selected.name||selected.push_name||selected.phone||"Unknown contact"}</h2><p className="muted">{selected.phone||"No phone"}{selected.email?` · ${selected.email}`:""}</p><div className="profile-stats"><div><span>Stage</span><strong>{selected.stage}</strong></div><div><span>Value</span><strong>{selected.value.toLocaleString()}</strong></div></div><div className="tag-section"><span className="small muted">Tags</span><div className="tag-list">{selected.tags.length?selected.tags.map(t=><span key={t.id}>{t.name}</span>):<span className="muted">No tags</span>}</div><div className="tag-picker">{tags.map(t=><button key={t.id} disabled={saving} className={selectedTagIds.has(t.id)?"active":""} onClick={()=>toggleTag(t.id)}>{selectedTagIds.has(t.id)?<Check size={12}/>:<Plus size={12}/>} {t.name}<small>{t.count}</small></button>)}</div></div>{selected.notes&&<div className="profile-note"><span>Notes</span><p>{selected.notes}</p></div>}<div className="profile-note"><span>Last conversation</span><p>{selected.last_message_at?new Date(selected.last_message_at).toLocaleString():"No messages yet"}</p></div></>}</> : <div className="empty"><strong>Select a customer</strong><span>The profile panel will show CRM context and engagement details.</span></div>}</aside>
    </div>
  </section>;
}
