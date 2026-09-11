"use client";

import Link from "next/link";
import { ArrowUpRight, Boxes, Check, Copy, GitBranch, Layers3, Sparkles, Zap } from "lucide-react";
import "./n8n.css";

const install = "cd integrations/n8n && npm install && npm run build";
const operations = [
  ["Message", "Send", "Write", "Send text to a WhatsApp chat."],
  ["Message", "List Messages", "Read", "Pull the latest messages for a chat."],
  ["Engine", "List", "Read", "Discover configured WhatsApp runtimes."],
  ["Health", "Check", "Read", "Verify the API is reachable."],
];

export default function N8nPage() {
  async function copyInstall() {
    await navigator.clipboard.writeText(install);
  }

  return (
    <main className="n8n-shell">
      <div className="n8n-grid-glow" />
      <div className="n8n-orb n8n-orb-one" />
      <div className="n8n-orb n8n-orb-two" />
      <section className="n8n-hero">
        <div className="n8n-kicker"><Sparkles size={14} /> Automation bridge</div>
        <div className="n8n-hero-row">
          <div>
            <h1>Connect LaaWa to n8n.</h1>
            <p>Turn WhatsApp events, business logic, AI steps, schedules and external systems into one self-hosted automation graph.</p>
          </div>
          <div className="n8n-hero-mark"><Boxes size={36} /></div>
        </div>
        <div className="n8n-quickstats"><span><Zap size={15} /> Native community node</span><span><Layers3 size={15} /> v1 API</span><span><GitBranch size={15} /> Self-hosted</span></div>
      </section>

      <section className="n8n-panel n8n-install">
        <div><div className="n8n-label">INSTALL</div><h2>Drop the integration into your n8n runtime</h2><p>The package lives outside the Next.js application, keeping one-click Vercel and Netlify builds clean.</p></div>
        <div className="n8n-code"><code>{install}</code><button onClick={copyInstall} aria-label="Copy install command"><Copy size={16} /></button></div>
      </section>

      <section className="n8n-section">
        <div className="n8n-section-head"><div><div className="n8n-label">NODE CAPABILITIES</div><h2>Automation primitives</h2></div><span className="n8n-status"><Check size={14} /> Ready</span></div>
        <div className="n8n-ops">{operations.map(([resource, operation, scope, detail]) => <article className="n8n-op" key={`${resource}-${operation}`}><div className="n8n-op-icon"><Zap size={17} /></div><div><span>{resource} · {operation}</span><p>{detail}</p></div><b>{scope}</b></article>)}</div>
      </section>

      <section className="n8n-bottom-grid">
        <article className="n8n-panel n8n-card"><div className="n8n-label">INBOUND</div><h3>Trigger workflows from LaaWa</h3><p>Use n8n Webhook as the workflow trigger for LaaWa webhook deliveries. Keep the endpoint private and verify your delivery secret.</p><Link href="/developer/docs">Open API docs <ArrowUpRight size={15} /></Link></article>
        <article className="n8n-panel n8n-card"><div className="n8n-label">OUTBOUND</div><h3>Build actions visually</h3><p>Compose schedules, AI, databases, transforms and external APIs before the LaaWa node without adding runtime code to the core application.</p><Link href="/developer/sdk">Explore SDKs <ArrowUpRight size={15} /></Link></article>
      </section>
    </main>
  );
}
