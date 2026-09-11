"use client";

import { useMemo, useState } from "react";
import { BookOpen, Check, ChevronRight, Copy, ExternalLink, KeyRound, Radio, Send, ShieldCheck, Sparkles } from "lucide-react";
import "../../../developer.css";
import "./guide.css";

const examples = {
  curl: `curl -X POST "https://YOUR-LAAWA-HOST/api/v1/messages" \\\n  -H "Authorization: Bearer $LAAWA_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"accountId":"ACCOUNT_ID","to":"919876543210","type":"text","body":"Hello from LaaWa"}'`,
  javascript: `const response = await fetch("https://YOUR-LAAWA-HOST/api/v1/messages", {\n  method: "POST",\n  headers: {\n    Authorization: \`Bearer ${LAAWA_API_KEY}\`,\n    "Content-Type": "application/json",\n  },\n  body: JSON.stringify({\n    accountId: "ACCOUNT_ID",\n    to: "919876543210",\n    type: "text",\n    body: "Hello from LaaWa",\n  }),\n});`,
};

export default function DeveloperGuidePage() {
  const [language, setLanguage] = useState<keyof typeof examples>("curl");
  const [copied, setCopied] = useState(false);
  const snippet = useMemo(() => examples[language], [language]);

  async function copySnippet() {
    await navigator.clipboard?.writeText(snippet);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <main className="developer-shell guide-shell">
      <div className="developer-orb developer-orb-one" />
      <div className="developer-orb developer-orb-two" />
      <section className="developer-header guide-header">
        <div>
          <div className="developer-kicker"><Sparkles size={13} /> LaaWa Developer Platform</div>
          <h1>Build with LaaWa</h1>
          <p>From your first API key to live WhatsApp events, everything is versioned, scoped, and ready for production integrations.</p>
        </div>
        <a className="developer-badge guide-link" href="/api/v1/openapi.json" target="_blank" rel="noreferrer"><ExternalLink size={15} /> OpenAPI</a>
      </section>

      <section className="guide-steps">
        {[
          ["01", "Create a key", KeyRound, "Create a scoped API key from the Developer console."],
          ["02", "Send a message", Send, "Call the versioned messaging endpoint from your server."],
          ["03", "Go realtime", Radio, "Subscribe to authenticated SSE events for live updates."],
        ].map(([number, title, Icon, text]) => {
          const StepIcon = Icon as typeof KeyRound;
          return <article className="developer-card guide-step" key={String(number)}><span className="guide-number">{number}</span><StepIcon size={19} /><h2>{String(title)}</h2><p>{String(text)}</p></article>;
        })}
      </section>

      <section className="developer-card guide-code-card">
        <div className="guide-card-head">
          <div><div className="guide-title"><BookOpen size={18} /> Quick start</div><p>Copy a server-side request and replace the placeholders with your account details.</p></div>
          <div className="guide-tabs">
            {(Object.keys(examples) as Array<keyof typeof examples>).map((item) => <button key={item} className={language === item ? "active" : ""} onClick={() => setLanguage(item)}>{item === "curl" ? "cURL" : "JavaScript"}</button>)}
          </div>
        </div>
        <div className="guide-code-wrap"><pre><code>{snippet}</code></pre><button className="developer-primary guide-copy" onClick={copySnippet}>{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? "Copied" : "Copy"}</button></div>
      </section>

      <section className="guide-grid">
        <article className="developer-card guide-info"><ShieldCheck size={20} /><h3>Secure by scope</h3><p>Use read, write, and admin scopes deliberately. Account-restricted keys provide another isolation boundary.</p><a href="/developer">Open Developer Console <ChevronRight size={14} /></a></article>
        <article className="developer-card guide-info"><Radio size={20} /><h3>Realtime by default</h3><p>Use the authenticated SSE endpoint when your integration needs live state, snapshot, message, or sync activity.</p><a href="/developer/realtime">Explore Realtime <ChevronRight size={14} /></a></article>
        <article className="developer-card guide-info"><BookOpen size={20} /><h3>One source of truth</h3><p>Use the live OpenAPI contract for tooling, client generation, and endpoint discovery.</p><a href="/docs/api-reference.md" target="_blank" rel="noreferrer">Read full reference <ChevronRight size={14} /></a></article>
      </section>
    </main>
  );
}
