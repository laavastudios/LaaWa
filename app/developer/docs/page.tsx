"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Activity, BookOpen, Boxes, Check, Copy, ExternalLink, Layers3, Link2, LockKeyhole, Radio, ShieldCheck, Sparkles, Workflow } from "lucide-react";
import "../../developer.css";
import "./docs.css";

const groups = [
 { title:"System",items:[["GET","/"],["GET","/health"],["GET","/openapi.json"]] },
 { title:"Authentication",items:[["GET","/keys"],["POST","/keys"],["DELETE","/keys/{id}"]] },
 { title:"Messaging",items:[["GET","/messages"],["POST","/messages"],["GET","/conversations"],["GET","/conversations/{id}/messages"],["GET","/contacts"]] },
 { title:"Engines",items:[["GET","/engines"]] },
 { title:"Realtime",items:[["GET","/events?accountId={accountId}"]] },
 { title:"Integrations",items:[["GET","/integrations"],["POST","/integrations"],["POST","/integrations/{id}/dispatch"]] },
 { title:"Operations",items:[["GET","/notifications"],["GET","/metrics"],["GET","/metrics/snapshot"]] },
 { title:"Privacy",items:[["GET","/privacy"],["PATCH","/privacy"],["POST","/privacy"],["GET","/privacy/export"]] },
 { title:"Plugins",items:[["GET","/plugins"],["POST","/plugins"],["PATCH","/plugins/{id}"],["DELETE","/plugins/{id}"],["POST","/plugins/{id}/test"]] },
];

const implementation = [
 ["01","API foundation","Versioned API, request IDs, common responses, authentication and deployment-safe API boundaries."],
 ["02","API keys","Scoped credentials, expiry, revocation, hashing and optional WhatsApp-account restrictions."],
 ["03","Messaging API","Messages, conversations, contacts and engine-aware account routing."],
 ["04","Realtime SSE","Authenticated account-scoped Server-Sent Events for external consumers."],
 ["05","OpenAPI docs","Machine-readable API contract plus the in-product developer reference."],
 ["06","Multi-engine","Engine abstraction and Engine Control Center for account-specific WhatsApp runtimes."],
 ["07","SDKs","TypeScript, Python and PHP client foundations using the same API contract."],
 ["08","n8n","Isolated community-node integration with messaging, engines and health operations."],
 ["09","Integrations","Chatwoot, WordPress and signed generic HTTPS webhook integrations."],
 ["10","Notifications","Browser push, optional SMTP, preferences, rules, severity and delivery worker."],
 ["11","Observability","Workspace metrics, Prometheus output, JSON snapshots and operational dashboard."],
 ["12","Privacy","Inventory, retention, transactional export and explicit data erasure controls."],
 ["13","Plugins","Catalog, installations, permissions, encrypted secrets and signed event delivery."],
 ["14","Premium + hardening","Premium command-center UI, responsive motion, security headers, CSP and production recovery surfaces."],
];

export default function DeveloperDocsPage(){
 const[copied,setCopied]=useState(false),[base,setBase]=useState("/api/v1");
 useEffect(()=>setBase(`${window.location.origin}/api/v1`),[]);
 const copy=async()=>{await navigator.clipboard?.writeText(`${base}/openapi.json`);setCopied(true);setTimeout(()=>setCopied(false),1600)};
 return <main className="developer-shell docs-shell">
  <div className="developer-orb developer-orb-one"/><div className="developer-orb developer-orb-two"/>
  <section className="developer-header docs-header"><div><div className="developer-kicker"><Sparkles size={13}/> LaaWa Developer Platform</div><h1>Complete Documentation</h1><p>API reference, architecture, integrations, SDKs, operations, privacy, plugins and the complete Step 1–14 implementation record.</p></div><div className="docs-open-actions"><Link className="developer-badge docs-open" href="/developer"><ShieldCheck size={15}/> API Keys</Link><Link className="developer-badge docs-open" href="/developer/plugins"><Boxes size={15}/> Plugin Center</Link><a className="developer-badge docs-open" href="/api/v1/openapi.json" target="_blank" rel="noreferrer"><ExternalLink size={15}/> OpenAPI</a></div></section>
  <section className="docs-layout">
   <aside className="developer-card docs-sidebar"><div className="docs-sidebar-title"><BookOpen size={18}/> API Reference</div>{groups.map(group=><div className="docs-group" key={group.title}><span>{group.title}</span>{group.items.map(([method,path])=><div className="docs-nav-item" key={`${method}-${path}`}><b className={`docs-method docs-${method.toLowerCase()}`}>{method}</b><code>{path}</code></div>)}</div>)}</aside>
   <div className="docs-main">
    <article className="developer-card docs-hero-card"><div className="docs-icon"><Layers3 size={22}/></div><div><h2>Everything shipped in one place.</h2><p>The Developer Center is the live product reference. The repository also contains detailed Markdown guides under <code>docs/</code>, including deployment, engines, SDKs, integrations, notifications, observability, privacy, plugins and hardening.</p></div></article>
    <div className="docs-grid"><article className="developer-card docs-feature"><ShieldCheck size={20}/><h3>Security</h3><p>Scoped API credentials, encrypted integration/plugin secrets, signed deliveries, workspace isolation and hardened browser policies.</p></article><article className="developer-card docs-feature"><Radio size={20}/><h3>Realtime</h3><p>Versioned SSE plus persistent worker-backed event paths for external integrations.</p></article><article className="developer-card docs-feature"><Check size={20}/><h3>Deploy</h3><p>Next.js web/API deployment is compatible with Vercel and Netlify while persistent workers remain separate.</p></article></div>
    <article className="developer-card docs-endpoint-card"><div className="developer-card-title"><span className="developer-icon"><BookOpen size={19}/></span><div><h2>Complete implementation history</h2><p>Steps 1 through 14 are recorded so the platform does not lose architectural context between iterations.</p></div></div><div className="implementation-list">{implementation.map(([step,title,copy])=><div className="implementation-item" key={step}><b>{step}</b><div><strong>{title}</strong><p>{copy}</p></div></div>)}</div></article>
    <article className="developer-card docs-endpoint-card"><div className="developer-card-title"><span className="developer-icon"><Workflow size={19}/></span><div><h2>Developer surfaces</h2><p>Direct links to the in-product operational areas.</p></div></div><div className="developer-link-grid"><Link href="/developer/engines"><Layers3 size={15}/> Engine Control Center</Link><Link href="/developer/sdk"><BookOpen size={15}/> SDKs</Link><Link href="/developer/n8n"><Workflow size={15}/> n8n</Link><Link href="/developer/integrations"><Link2 size={15}/> Integrations</Link><Link href="/developer/notifications"><Activity size={15}/> Notifications</Link><Link href="/developer/observability"><Activity size={15}/> Observability</Link><Link href="/developer/privacy"><LockKeyhole size={15}/> Privacy</Link><Link href="/developer/plugins"><Boxes size={15}/> Plugins</Link></div></article>
    <article className="developer-card docs-endpoint-card"><div className="developer-card-title"><span className="developer-icon"><Copy size={19}/></span><div><h2>OpenAPI endpoint</h2><p>Use the live machine-readable contract for client generation and API tooling.</p></div></div><div className="docs-copy-row"><code>{base}/openapi.json</code><button className="developer-primary docs-copy" onClick={copy}>{copied?<Check size={16}/>:<Copy size={16}/>} {copied?"Copied":"Copy"}</button></div></article>
   </div>
  </section>
 </main>
}
