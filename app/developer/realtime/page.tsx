"use client";

import { useEffect, useRef, useState } from "react";
import { Activity, Radio, Sparkles, Wifi, WifiOff } from "lucide-react";
import "../../developer.css";

export default function RealtimeDeveloperPage() {
  const [accountId, setAccountId] = useState("");
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState<Array<{ type: string; time: string }>>([]);
  const source = useRef<EventSource | null>(null);

  useEffect(() => () => source.current?.close(), []);

  function connect() {
    source.current?.close();
    if (!accountId.trim()) return;
    const next = new EventSource(`/api/v1/events?accountId=${encodeURIComponent(accountId.trim())}`);
    source.current = next;
    next.onopen = () => setConnected(true);
    next.onerror = () => setConnected(false);
    ["state", "snapshot", "message", "sync"].forEach((type) => next.addEventListener(type, () => {
      setEvents((current) => [{ type, time: new Date().toLocaleTimeString() }, ...current].slice(0, 24));
    }));
  }

  function disconnect() {
    source.current?.close();
    source.current = null;
    setConnected(false);
  }

  return (
    <main className="developer-shell">
      <div className="developer-orb developer-orb-one" />
      <div className="developer-orb developer-orb-two" />
      <section className="developer-header">
        <div>
          <div className="developer-kicker"><Sparkles size={13} /> LaaWa Developer</div>
          <h1>Realtime</h1>
          <p>Stream live WhatsApp state, inbox snapshots, messages, and synchronization events into your integration.</p>
        </div>
        <div className={connected ? "developer-badge realtime-live" : "developer-badge"}>{connected ? <Wifi size={15} /> : <WifiOff size={15} />} {connected ? "Live" : "Disconnected"}</div>
      </section>

      <section className="developer-grid">
        <article className="developer-card developer-card-create">
          <div className="developer-card-title"><span className="developer-icon"><Radio size={19} /></span><div><h2>Live event stream</h2><p>Standard Server-Sent Events over the authenticated API.</p></div></div>
          <label>WhatsApp account ID<input value={accountId} onChange={(e) => setAccountId(e.target.value)} placeholder="Account UUID" /></label>
          <div className="realtime-actions">
            {!connected ? <button className="developer-primary" onClick={connect} disabled={!accountId.trim()}><Wifi size={17} /> Connect stream</button> : <button className="developer-primary" onClick={disconnect}><WifiOff size={17} /> Disconnect</button>}
          </div>
          <div className="realtime-endpoint"><code>GET /api/v1/events?accountId={'{accountId}'}</code></div>
        </article>

        <article className="developer-card developer-card-list">
          <div className="developer-card-title"><span className="developer-icon"><Activity size={19} /></span><div><h2>Event activity</h2><p>Newest events appear instantly without polling.</p></div></div>
          {events.length === 0 ? <div className="developer-empty"><Radio size={25} /><strong>Waiting for events</strong><span>Connect a WhatsApp account to see live activity.</span></div> : <div className="key-list">{events.map((event, index) => <div className="key-item" key={`${event.time}-${event.type}-${index}`}><div className="key-main"><div><strong>{event.type}</strong><code>server-sent event</code></div><span className="key-status">Live</span></div><div className="key-meta"><span>{event.time}</span></div></div>)}</div>}
        </article>
      </section>
    </main>
  );
}
