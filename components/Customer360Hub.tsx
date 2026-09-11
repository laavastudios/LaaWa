"use client";

import { useEffect, useState } from "react";

type Contact = { id: string; name: string | null; push_name: string | null; phone: string | null; email: string | null; notes: string | null; stage: string; value: number; tags: string[]; last_message_at: string | null };

export default function Customer360Hub() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selected, setSelected] = useState<Contact | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true); setError("");
    try {
      const r = await fetch(`/api/contacts?q=${encodeURIComponent(query)}`, { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Could not load contacts");
      setContacts(d.contacts || []);
      if (selected) setSelected((d.contacts || []).find((c: Contact) => c.id === selected.id) || null);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load contacts"); }
    finally { setLoading(false); }
  }
  useEffect(() => { const t = window.setTimeout(load, 180); return () => window.clearTimeout(t); }, [query]);

  return <section className="customer360">
    <div className="customer360-hero glass"><div><div className="eyebrow">CUSTOMER 360 / LIVE</div><h2>Every customer. One view.</h2><p className="muted">Search real workspace contacts and open a complete customer profile.</p></div><div className="customer360-orbit"><span/><i/><b/></div></div>
    <div className="customer360-layout">
      <section className="panel glass"><div className="panel-head"><div><h2>Contacts</h2><span className="small muted">{contacts.length} matching records</span></div><button className="primary compact" onClick={load}>Refresh</button></div><input className="setting-input" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search name, phone, email…" />
        {error && <div className="error">{error}</div>}
        {loading ? <div className="empty">Loading customer graph…</div> : contacts.length === 0 ? <div className="empty"><strong>No contacts found</strong><span>Contacts appear here from your connected WhatsApp workspace.</span></div> : <div className="customer-list">{contacts.map(c=><button className={`customer-row ${selected?.id===c.id?"active":""}`} key={c.id} onClick={()=>setSelected(c)}><span className="customer-avatar">{(c.name||c.push_name||"?").slice(0,1).toUpperCase()}</span><span className="customer-main"><strong>{c.name||c.push_name||c.phone||"Unknown contact"}</strong><small>{c.phone||c.email||"No contact detail"}</small></span><span className="customer-stage">{c.stage}</span></button>)}</div>}
      </section>
      <aside className="panel glass customer-profile">{selected ? <><div className="profile-orb">{(selected.name||selected.push_name||"?").slice(0,1).toUpperCase()}</div><div className="eyebrow">CUSTOMER PROFILE</div><h2>{selected.name||selected.push_name||selected.phone||"Unknown contact"}</h2><p className="muted">{selected.phone||"No phone"}{selected.email?` · ${selected.email}`:""}</p><div className="profile-stats"><div><span>Stage</span><strong>{selected.stage}</strong></div><div><span>Value</span><strong>{selected.value.toLocaleString()}</strong></div></div><div className="tag-list">{selected.tags.length?selected.tags.map(t=><span key={t}>{t}</span>):<span className="muted">No tags</span>}</div>{selected.notes&&<div className="profile-note"><span>Notes</span><p>{selected.notes}</p></div>}<div className="profile-note"><span>Last conversation</span><p>{selected.last_message_at?new Date(selected.last_message_at).toLocaleString():"No messages yet"}</p></div></> : <div className="empty"><strong>Select a customer</strong><span>The profile panel will show CRM context and engagement details.</span></div>}</aside>
    </div>
  </section>;
}
