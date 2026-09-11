"use client";

import Link from "next/link";
import { Activity, Bell, Boxes, BookOpen, Cable, ChevronDown, Code2, Database, Gauge, Layers3, LockKeyhole, Network, Sparkles, Workflow, Zap } from "lucide-react";
import { useState } from "react";

const links = [
  ["Dashboard", "/", Gauge], ["API Keys", "/developer", LockKeyhole], ["Documentation", "/developer/docs", BookOpen],
  ["Engines", "/developer/engines", Layers3], ["SDKs", "/developer/sdk", Code2], ["n8n", "/developer/n8n", Workflow],
  ["Integrations", "/developer/integrations", Cable], ["Notifications", "/developer/notifications", Bell], ["Observability", "/developer/observability", Activity],
  ["Privacy", "/developer/privacy", LockKeyhole], ["Plugins", "/developer/plugins", Boxes], ["Platform Center", "/developer", Database],
  ["Automations", "/", Zap], ["API Realtime", "/developer/docs", Network],
] as const;

export default function SitePlatformMenu() {
  const [open, setOpen] = useState(false);
  return (
    <div className={`site-platform-menu ${open ? "is-open" : ""}`}>
      <button type="button" className="site-platform-trigger" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-controls="site-platform-panel">
        <span className="nav-icon site-platform-trigger-icon"><Sparkles size={16} /></span>
        <span className="site-platform-trigger-label">Platform</span>
        <ChevronDown size={14} className="site-platform-chevron" />
      </button>
      <div id="site-platform-panel" className="site-platform-panel" aria-hidden={!open}>
        <div className="site-platform-panel-head"><span className="site-platform-kicker">PLATFORM</span><span className="site-platform-live"><i /> Ready</span></div>
        <div className="site-platform-grid">
          {links.map(([label, href, Icon]) => <Link href={href} key={label} onClick={() => setOpen(false)} className="site-platform-link"><span className="site-platform-link-icon"><Icon size={14} /></span><span><strong>{label}</strong><small>Open platform</small></span></Link>)}
        </div>
      </div>
    </div>
  );
}
