"use client";

import { useMemo, useState } from "react";
import { Braces, Check, Copy, FileCode2, Layers3, Package, Sparkles, Terminal } from "lucide-react";
import Link from "next/link";
import "./sdk.css";

const snippets = {
  TypeScript: `import { LaaWaClient } from "@laava/sdk";\n\nconst client = new LaaWaClient({\n  baseUrl: "https://your-laawa.example.com/api/v1",\n  apiKey: process.env.LAAWA_API_KEY!,\n});\n\nawait client.sendMessage({\n  accountId,\n  chatId,\n  text: "Hello from LaaWa",\n});`,
  Python: `from laawa import LaaWaClient\n\nclient = LaaWaClient(\n    "https://your-laawa.example.com/api/v1",\n    api_key,\n)\n\nclient.send_message(\n    account_id=account_id,\n    chat_id=chat_id,\n    text="Hello from LaaWa",\n)`,
  PHP: `$client = new \\LaaWa\\LaaWaClient(\n    'https://your-laawa.example.com/api/v1',\n    getenv('LAAWA_API_KEY')\n);\n\n$client->sendMessage([\n    'accountId' => $accountId,\n    'chatId' => $chatId,\n    'text' => 'Hello from LaaWa',\n]);`,
} as const;

type Language = keyof typeof snippets;

export default function SdkPage() {
  const [language, setLanguage] = useState<Language>("TypeScript");
  const [copied, setCopied] = useState(false);
  const code = useMemo(() => snippets[language], [language]);
  async function copy() { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1400); }
  return <main className="sdk-shell">
    <div className="sdk-glow sdk-glow-a" /><div className="sdk-glow sdk-glow-b" />
    <header className="sdk-hero"><div className="sdk-kicker"><Sparkles size={14} /> Developer platform</div><h1>Build on LaaWa.</h1><p>One authenticated API. Native SDK foundations for TypeScript, Python, and PHP. No vendor lock-in, no hosted dependency.</p><div className="sdk-nav"><Link href="/developer/docs">API Docs</Link><Link href="/developer/engines"><Layers3 size={14}/> Engines</Link><Link className="active" href="/developer/sdk"><Package size={14}/> SDKs</Link></div></header>
    <section className="sdk-metrics"><div><Braces/><strong>3</strong><span>Languages</span></div><div><Terminal/><strong>v1</strong><span>Stable API</span></div><div><FileCode2/><strong>0</strong><span>Runtime lock-ins</span></div></section>
    <section className="sdk-panel"><div className="sdk-tabs">{(Object.keys(snippets) as Language[]).map((item) => <button className={language === item ? "active" : ""} onClick={() => setLanguage(item)} key={item}>{item}</button>)}</div><div className="sdk-code-head"><span>Quick start</span><button onClick={copy}>{copied ? <Check size={15}/> : <Copy size={15}/>} {copied ? "Copied" : "Copy"}</button></div><pre><code>{code}</code></pre></section>
    <section className="sdk-cards"><article><Package/><h2>Typed by default</h2><p>Consistent request and error semantics across every SDK surface.</p></article><article><Layers3/><h2>Same API contract</h2><p>SDKs map directly to the authenticated v1 HTTP endpoints.</p></article><article><Sparkles/><h2>Deploy anywhere</h2><p>The SDK layer adds no persistent process or WhatsApp engine dependency to the web app.</p></article></section>
  </main>;
}
