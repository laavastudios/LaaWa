"use client";

import Link from "next/link";
import { Activity, Bell, BookOpen, Cable, Code2, Layers3, LockKeyhole, Network, Boxes, KeyRound, Zap } from "lucide-react";
import "./platform.css";

const features = [
  { title: "API Keys", text: "Create and manage scoped developer credentials.", href: "/developer", icon: KeyRound },
  { title: "Documentation", text: "Complete API reference, OpenAPI and platform guides.", href: "/developer/docs", icon: BookOpen },
  { title: "Realtime API", text: "Stream workspace events to external systems.", href: "/developer/docs", icon: Network },
  { title: "Engines", text: "Inspect and manage the WhatsApp engine layer.", href: "/developer/engines", icon: Layers3 },
  { title: "SDKs", text: "Build against LaaWa with TypeScript, Python and PHP SDKs.", href: "/developer/sdk", icon: Code2 },
  { title: "n8n", text: "Connect LaaWa workflows to n8n automation.", href: "/developer/n8n", icon: Zap },
  { title: "Integrations", text: "Manage Chatwoot, WordPress and webhook connections.", href: "/developer/integrations", icon: Cable },
  { title: "Notifications", text: "Configure browser, email and operational alerts.", href: "/developer/notifications", icon: Bell },
  { title: "Observability", text: "Monitor metrics, health and operational signals.", href: "/developer/observability", icon: Activity },
  { title: "Privacy", text: "Control retention, export and workspace erasure.", href: "/developer/privacy", icon: LockKeyhole },
  { title: "Plugins", text: "Install and manage signed external extensions.", href: "/developer/plugins", icon: Boxes },
];

export default function PlatformPage() {
  return (
    <main className="platform-page laawa-shell">
      <section className="platform-page-shell">
        <header className="platform-page-head">
          <div>
            <div className="eyebrow">LAAWA / PLATFORM</div>
            <h1>Everything added to LaaWa beyond the core workspace.</h1>
            <p>Developer, integration, operations and data-control features live here. The existing Inbox, Analytics, Automation, WhatsApp and business tools stay in the main workspace.</p>
          </div>
          <Link href="/" className="platform-back">← Back to workspace</Link>
        </header>

        <div className="platform-feature-grid">
          {features.map(({ title, text, href, icon: Icon }, index) => (
            <Link href={href} className="platform-feature-card" key={title} style={{ animationDelay: `${index * 45}ms` }}>
              <span className="platform-feature-icon"><Icon size={19} /></span>
              <span className="platform-feature-copy"><strong>{title}</strong><small>{text}</small></span>
              <span className="platform-feature-arrow">→</span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
