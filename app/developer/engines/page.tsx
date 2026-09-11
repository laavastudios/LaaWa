"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Cpu, Layers3, Radio, Server, Sparkles, Zap } from "lucide-react";
import "./engines.css";

type Engine = {
  id: string;
  label: string;
  version: string;
  mode: "local" | "remote-adapter";
  configured: boolean;
  default: boolean;
  capabilities: Record<string, boolean>;
};

const capabilityLabels: Record<string, string> = {
  messaging: "Messaging",
  media: "Media",
  locations: "Locations",
  groups: "Groups",
  history: "History sync",
  realtime: "Realtime events",
  reactions: "Reactions",
};

export default function EnginesPage() {
  const [engines, setEngines] = useState<Engine[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/engines", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Unable to load engines")))
      .then((payload) => setEngines(payload.engines || []))
      .catch(() => setEngines([]))
      .finally(() => setLoading(false));
  }, []);

  const capabilityCount = useMemo(() => Object.keys(capabilityLabels).length, []);

  return (
    <main className="engine-shell">
      <div className="engine-orb engine-orb-a" />
      <div className="engine-orb engine-orb-b" />
      <section className="engine-hero">
        <div className="engine-kicker"><Sparkles size={14} /> Runtime architecture</div>
        <h1>Engine Control Center</h1>
        <p>One messaging surface. Multiple WhatsApp runtimes. Accounts keep their engine choice behind a stable API contract.</p>
        <div className="engine-stat-row">
          <div><Cpu size={17} /><strong>{loading ? "—" : engines.length}</strong><span>Engines</span></div>
          <div><Layers3 size={17} /><strong>{capabilityCount}</strong><span>Capabilities</span></div>
          <div><Zap size={17} /><strong>v1</strong><span>API contract</span></div>
        </div>
      </section>

      <section className="engine-grid" aria-label="WhatsApp engines">
        {engines.map((engine, index) => (
          <article className={`engine-card ${engine.default ? "engine-card-active" : ""}`} key={engine.id} style={{ animationDelay: `${index * 90}ms` }}>
            <div className="engine-card-top">
              <div className="engine-icon"><Server size={21} /></div>
              <span className={`engine-badge ${engine.configured ? "configured" : ""}`}>{engine.configured ? "READY" : "ADAPTER"}</span>
            </div>
            <div className="engine-name-row"><h2>{engine.label}</h2>{engine.default && <span className="default-pill">DEFAULT</span>}</div>
            <p className="engine-meta">{engine.id} · {engine.version} · {engine.mode === "local" ? "Local runtime" : "Remote adapter"}</p>
            <div className="capability-list">
              {Object.entries(capabilityLabels).map(([key, label]) => (
                <div key={key} className="capability"><Check size={14} /><span>{label}</span><b>{engine.capabilities[key] ? "ON" : "—"}</b></div>
              ))}
            </div>
            <div className="engine-footer"><Radio size={15} /> Stable transport contract</div>
          </article>
        ))}
      </section>

      <section className="engine-note">
        <div className="note-icon"><Zap size={17} /></div>
        <div><strong>Deployment-safe by design</strong><p>The default runtime stays local to the persistent WhatsApp worker. Optional engines connect through an HTTP adapter, so Vercel and Netlify builds do not require an extra runtime package or a long-lived browser process.</p></div>
      </section>
    </main>
  );
}
