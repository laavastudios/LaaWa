"use client";

import Link from "next/link";
import { Activity, Bell, Boxes, BookOpen, Cable, ChevronDown, Code2, Database, Gauge, Layers3, LockKeyhole, Network, Sparkles, Workflow, Zap } from "lucide-react";
import { useState } from "react";

const links = [
  ["Dashboard", "/", Gauge],
  ["API Keys", "/developer", LockKeyhole],
  ["Documentation", "/developer/docs", BookOpen],
  ["Engines", "/developer/engines", Layers3],
  ["SDKs", "/developer/sdk", Code2],
  ["n8n", "/developer/n8n", Workflow],
  ["Integrations", "/developer/integrations", Cable],
  ["Notifications", "/developer/notifications", Bell],
  ["Observability", "/developer/observability", Activity],
  ["Privacy", "/developer/privacy", LockKeyhole],
  ["Plugins", "/developer/plugins", Boxes],
  ["Platform", "/developer", Database],
  ["Automations", "/developer", Zap],
  ["API Realtime", "/developer/docs", Network],
] as const;

export default function SitePlatformMenu() {
  const [open, setOpen] = useState(false);
  return (
    <div className={`site-platform-menu ${open ? "is-open" : ""}`}>
      <button className="site-platform-trigger" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-controls="site-platform-panel">
        <span className="site-platform-trigger-icon"><Sparkles size={15} /></span>
        <span><strong>Platform</strong><small>Developer &amp; system tools</small></span>
        <ChevronDown size={16} className="site-platform-chevron" />
      </button>
      <div id="site-platform-panel" className="site-platform-panel">
        <div className="site-platform-panel-head"><div><span className="site-platform-kicker">LAAWA PLATFORM</span><h2>Everything in one place</h2></div><span className="site-platform-live"><i /> Live</span></div>
        <div className="site-platform-grid">
          {links.map(([label, href, Icon]) => <Link href={href} key={`${label}-${href}`} onClick={() => setOpen(false)} className="site-platform-link"><span className="site-platform-link-icon"><Icon size={15} /></span><span><strong>{label}</strong><small>{label === "Documentation" ? "API reference & guides" : label === "Plugins" ? "Extension control center" : label === "Engines" ? "WhatsApp engine control" : label === "Observability" ? "Metrics & system health" : label === "Integrations" ? "External services" : label === "SDKs" ? "Build with LaaWa" : "Open platform"}</small></span></Link>)}
        </div>
      </div>
    </div>
  );
}
