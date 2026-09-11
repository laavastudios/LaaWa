"use client";

import Link from "next/link";
import { Boxes, BookOpen, Cable, Code2, ExternalLink, Layers3, Sparkles } from "lucide-react";

const links = [
  { href: "/developer/docs", label: "Docs", icon: BookOpen },
  { href: "/developer/plugins", label: "Plugins", icon: Boxes },
  { href: "/developer/sdk", label: "SDKs", icon: Code2 },
  { href: "/developer/integrations", label: "Integrations", icon: Cable },
  { href: "/developer/engines", label: "Engines", icon: Layers3 },
];

export default function DeveloperDock() {
  return (
    <aside className="developer-dock" aria-label="Developer platform">
      <div className="developer-dock-orbit" aria-hidden="true" />
      <div className="developer-dock-head">
        <span className="developer-dock-mark"><Sparkles size={13} /></span>
        <div><strong>Developer</strong><small>Platform</small></div>
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
