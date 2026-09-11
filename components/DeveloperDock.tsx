"use client";

import Link from "next/link";
import { Bell, Boxes, Cable, Code2, ExternalLink, Layers3, LockKeyhole, Network, Radio, Sparkles } from "lucide-react";

const links = [
  { href: "/developer/docs", label: "Docs", icon: BookOpenIcon },
  { href: "/developer/plugins", label: "Plugins", icon: Boxes },
  { href: "/developer/sdk", label: "SDKs", icon: Code2 },
  { href: "/developer/integrations", label: "Integrations", icon: Cable },
  { href: "/developer/engines", label: "Engines", icon: Layers3 },
  { href: "/developer/n8n", label: "n8n", icon: Network },
  { href: "/developer/notifications", label: "Notifications", icon: Bell },
  { href: "/developer/observability", label: "Observability", icon: Radio },
  { href: "/developer/privacy", label: "Privacy", icon: LockKeyhole },
];

function BookOpenIcon(props: { size?: number }) {
  return <span style={{ display: "inline-flex" }}><svg width={props.size ?? 14} height={props.size ?? 14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 4.5A2.5 2.5 0 0 1 4.5 2H12v18H4.5A2.5 2.5 0 0 1 2 17.5z"/><path d="M22 4.5A2.5 2.5 0 0 0 19.5 2H12v18h7.5a2.5 2.5 0 0 0 2.5-2.5z"/></svg></span>;
}

export default function DeveloperDock() {
  return (
    <aside className="developer-dock" aria-label="Developer platform">
      <div className="developer-dock-orbit" aria-hidden="true" />
      <div className="developer-dock-head">
        <span className="developer-dock-mark"><Sparkles size={13} /></span>
        <div><strong>Developer</strong><small>All platform tools</small></div>
      </div>
      <nav>
        {links.map(({ href, label, icon: Icon }) => (
          <Link href={href} key={href} className="developer-dock-link">
            <span><Icon size={14} />{label}</span>
            <ExternalLink size={11} />
          </Link>
        ))}
      </nav>
    </aside>
  );
}
