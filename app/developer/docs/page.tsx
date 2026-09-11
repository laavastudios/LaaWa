"use client";

import { useEffect, useState } from "react";
import { BookOpen, Braces, Check, Copy, ExternalLink, Radio, ShieldCheck, Sparkles } from "lucide-react";
import "../developer.css";
import "./docs.css";

const groups = [
  { title: "System", items: [["GET", "/"], ["GET", "/health"], ["GET", "/openapi.json"]] },
  { title: "API Keys", items: [["GET", "/keys"], ["POST", "/keys"], ["DELETE", "/keys/{id}"]] },
  { title: "Messaging", items: [["GET", "/messages"], ["POST", "/messages"]] },
  { title: "Data", items: [["GET", "/conversations"], ["GET", "/contacts"]] },
  { title: "Realtime", items: [["GET", "/events?accountId={accountId}"]] },
];

export default function DeveloperDocsPage() {
  const [copied, setCopied] = useState(false);
  const [base, setBase] = useState("/api/v1");
  useEffect(() => setBase(`${window.location.origin}/api/v1`), []);
  const copy = async () => { await navigator.clipboard?.writeText(`${base}/openapi.json`); setCopied(true); setTimeout(() => setCopied(false), 1600); };

  return <main className="developer-shell docs-shell">
    <div className="developer-orb developer-orb-one" /><div className="developer-orb developer-orb-two" />
    <section className="developer-header docs-header">
      <div><div className="developer-kicker"><Sparkles size={13} /> LaaWa Developer Platform</div><h1>API Documentation</h1><p>Build on a clean, versioned API with scoped authentication, messaging primitives, and realtime events.</p></div>
      <a className="developer-badge docs-open" href="/api/v1/openapi.json" target="_blank" rel="noreferrer"><ExternalLink size={15} /> OpenAPI</a>
    </section>
    <section className="docs-layout">
      <aside className="developer-card docs-sidebar">
        <div className="docs-sidebar-title"><BookOpen size={18} /> Reference</div>
        {groups.map(group => <div className="docs-group" key={group.title}><span>{group.title}</span>{group.items.map(([method, path]) => <div className="docs-nav-item" key={`${method}-${path}`}><b className={`docs-method docs-${method.toLowerCase()}`}>{method}</b><code>{path}</code></div>)}</div>)}
      </aside>
      <div className="docs-main">
        <article className="developer-card docs-hero-card"><div className="docs-icon"><Braces size={22} /></div><div><h2>One contract. Every integration.</h2><p>OpenAPI 3.0 is available directly from this deployment, so SDK generators and API clients can consume the same contract without a separate documentation server.</p></div></article>
        <div className="docs-grid">
          <article className="developer-card docs-feature"><ShieldCheck size={20} /><h3>Scoped auth</h3><p>Use session auth in the console or bearer API keys with read, write, and admin scopes.</p></article>
          <article className="developer-card docs-feature"><Radio size={20} /><h3>Realtime ready</h3><p>Subscribe to authenticated Server-Sent Events for state, snapshot, message, and sync activity.</p></article>
          <article className="developer-card docs-feature"><Check size={20} /><h3>Deploy anywhere</h3><p>Route Handlers stay compatible with modern Next.js hosting on Vercel and Netlify.</p></article>
        </div>
        <article className="developer-card docs-endpoint-card"><div className="developer-card-title"><span className="developer-icon"><Braces size={19} /></span><div><h2>OpenAPI endpoint</h2><p>Machine-readable contract for tooling and client generation.</p></div></div><div className="docs-copy-row"><code>{base}/openapi.json</code><button className="developer-primary docs-copy" onClick={copy}>{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? "Copied" : "Copy"}</button></div></article>
      </div>
    </section>
  </main>;
}
