"use client";

import { useMemo, useState } from "react";
import { Bot, Copy, FileText, MessageSquareText, RefreshCw, Sparkles, WandSparkles } from "lucide-react";

type Mode = "reply" | "rewrite" | "campaign" | "summarize";

const modes: { id: Mode; label: string; hint: string; icon: typeof Bot }[] = [
  { id: "reply", label: "Reply Studio", hint: "Draft a customer-ready WhatsApp response.", icon: MessageSquareText },
  { id: "rewrite", label: "Rewrite", hint: "Make existing copy clearer and more polished.", icon: WandSparkles },
  { id: "campaign", label: "Campaign", hint: "Turn an idea into concise campaign copy.", icon: Sparkles },
  { id: "summarize", label: "Summarize", hint: "Condense a conversation or notes into actions.", icon: FileText },
];

export default function AIStudio() {
  const [mode, setMode] = useState<Mode>("reply");
  const [input, setInput] = useState("");
  const [tone, setTone] = useState("premium and helpful");
  const [output, setOutput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const selected = useMemo(() => modes.find((item) => item.id === mode)!, [mode]);

  async function generate() {
    const prompt = input.trim();
    if (!prompt || busy) return;
    setBusy(true); setError(""); setOutput("");
    const instructions = `You are LaaWa AI, an expert business communications assistant. Produce concise, natural copy that sounds human. Never claim actions were completed unless the input says they were. Mode: ${mode}. Tone: ${tone}.`;
    try {
      const response = await fetch("/api/ai/generate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prompt, systemInstruction: instructions }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "AI generation failed.");
      setOutput(String(data.text || "").trim());
    } catch (e) { setError(e instanceof Error ? e.message : "AI generation failed."); }
    finally { setBusy(false); }
  }

  async function copyOutput() {
    if (!output) return;
    await navigator.clipboard?.writeText(output);
  }

  return <section className="ai-studio">
    <div className="ai-hero-orbit" aria-hidden="true" />
    <header className="ai-head"><div><div className="eyebrow">LAAWA / AI ENGINE</div><h2>AI Studio</h2><p>Real Gemini generation through an authenticated server route.</p></div><div className="ai-live"><span /> LIVE ENGINE</div></header>
    <div className="ai-layout">
      <aside className="ai-modes">{modes.map((item) => { const Icon = item.icon; return <button key={item.id} className={mode === item.id ? "active" : ""} onClick={() => { setMode(item.id); setOutput(""); setError(""); }}><span><Icon size={16} /></span><b>{item.label}</b><small>{item.hint}</small></button>; })}</aside>
      <div className="ai-workbench">
        <div className="ai-node ai-node-input"><span>01</span><b>Brief</b><small>What should the AI create?</small></div>
        <div className="ai-beam" aria-hidden="true"><i /><i /><i /></div>
        <div className="ai-node ai-node-engine"><span><Bot size={18} /></span><b>Gemini</b><small>Generate → refine</small></div>
        <div className="ai-beam" aria-hidden="true"><i /><i /><i /></div>
        <div className="ai-node ai-node-output"><span>03</span><b>Output</b><small>Ready to use</small></div>
        <label className="ai-field"><span>Prompt / customer context</span><textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder={selected.hint} rows={7} /></label>
        <div className="ai-controls"><label>Voice<select value={tone} onChange={(e) => setTone(e.target.value)}><option>premium and helpful</option><option>friendly and concise</option><option>professional and direct</option><option>warm and persuasive</option></select></label><button className="ai-generate" onClick={generate} disabled={busy || !input.trim()}>{busy ? <><RefreshCw size={15} className="spin" /> Generating…</> : <><Sparkles size={15} /> Generate</>}</button></div>
        {error && <div className="ai-error">{error}</div>}
        <div className="ai-result"><div className="ai-result-head"><span>Generated output</span><button onClick={copyOutput} disabled={!output}><Copy size={14} /> Copy</button></div>{output ? <p>{output}</p> : <div className="ai-placeholder"><Bot size={24} /><span>Your real AI response will appear here.</span></div>}</div>
      </div>
    </div>
    <style>{styles}</style>
  </section>;
}

const styles = `.ai-studio{position:relative;overflow:hidden;padding:24px;border-radius:24px;border:1px solid rgba(255,255,255,.08);background:radial-gradient(circle at 75% 0%,rgba(124,58,237,.18),transparent 32%),linear-gradient(145deg,#0b1018,#070a0f);min-height:620px;isolation:isolate}.ai-hero-orbit{position:absolute;right:-160px;top:-220px;width:460px;height:460px;border:1px solid rgba(124,58,237,.18);border-radius:50%;animation:ai-spin 26s linear infinite;pointer-events:none}.ai-hero-orbit:after{content:"";position:absolute;inset:45px;border:1px solid rgba(34,211,238,.12);border-radius:50%;animation:ai-spin 18s linear infinite reverse}.ai-head,.ai-layout{position:relative;z-index:1}.ai-head{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:22px}.ai-head h2{font-size:30px;letter-spacing:-.05em;margin:4px 0}.ai-head p{font-size:11px;color:#748095;margin:0}.ai-live{display:flex;gap:7px;align-items:center;border:1px solid rgba(34,197,94,.2);background:rgba(34,197,94,.06);border-radius:999px;padding:7px 10px;color:#77e39a;font-size:8px}.ai-live span{width:6px;height:6px;border-radius:50%;background:#4ade80;box-shadow:0 0 14px #4ade80;animation:ai-pulse 1.7s infinite}.ai-layout{display:grid;grid-template-columns:205px 1fr;gap:16px}.ai-modes{display:grid;gap:7px;align-content:start}.ai-modes button{display:grid;grid-template-columns:30px 1fr;gap:2px 8px;text-align:left;padding:12px;border:1px solid transparent;border-radius:13px;background:#ffffff03;color:#718096;cursor:pointer;transition:.25s;transform-style:preserve-3d}.ai-modes button:hover{transform:translateX(4px) translateZ(8px);background:#ffffff06}.ai-modes button.active{border-color:#7c3aed33;background:linear-gradient(135deg,#7c3aed18,#ffffff05);color:#fff;box-shadow:0 12px 35px #0004}.ai-modes button span{grid-row:span 2;width:28px;height:28px;display:grid;place-items:center;border-radius:9px;background:#7c3aed1c;color:#c4b5fd}.ai-modes b{font-size:9px}.ai-modes small{font-size:7px;color:#5d687a;line-height:1.35}.ai-workbench{position:relative;padding:18px;border:1px solid #ffffff0d;border-radius:18px;background:#ffffff03;box-shadow:inset 0 1px #ffffff05,0 25px 80px #0003;transform-style:preserve-3d}.ai-node{position:absolute;top:14px;display:grid;gap:2px;width:92px;padding:8px;border:1px solid #ffffff0d;border-radius:10px;background:#0d131cdd;box-shadow:0 12px 28px #0005;transform:translateZ(20px)}.ai-node span{font-size:7px;color:#a78bfa}.ai-node b{font-size:8px;color:#dce2eb}.ai-node small{font-size:6px;color:#566275}.ai-node-input{left:18px}.ai-node-engine{left:50%;transform:translateX(-50%) translateZ(30px);border-color:#7c3aed2b}.ai-node-output{right:18px}.ai-beam{position:absolute;top:36px;height:1px;width:calc((50% - 72px) - 20px);overflow:visible}.ai-node-input+.ai-beam{left:130px}.ai-node-engine+.ai-beam{right:130px}.ai-beam i{position:absolute;width:4px;height:4px;border-radius:50%;background:#a78bfa;box-shadow:0 0 10px #a78bfa;animation:ai-flow 1.8s linear infinite}.ai-beam i:nth-child(2){animation-delay:.6s}.ai-beam i:nth-child(3){animation-delay:1.2s}.ai-field{display:grid;gap:7px;margin-top:115px}.ai-field span,.ai-controls label{font-size:8px;color:#697589;text-transform:uppercase;letter-spacing:.12em}.ai-field textarea,.ai-controls select{width:100%;box-sizing:border-box;border:1px solid #ffffff0d;border-radius:11px;background:#080c12;color:#dce2ea;outline:none;padding:11px;font:inherit;font-size:10px;resize:vertical}.ai-field textarea:focus,.ai-controls select:focus{border-color:#7c3aed55;box-shadow:0 0 0 3px #7c3aed0c}.ai-controls{display:flex;align-items:end;gap:10px;margin-top:10px}.ai-controls label{display:grid;gap:6px;max-width:220px;flex:1}.ai-controls select{height:35px;padding:0 9px}.ai-generate{height:35px;border:1px solid #8b5cf644;border-radius:10px;padding:0 14px;background:linear-gradient(135deg,#7c3aed,#5b21b6);color:white;font-size:9px;cursor:pointer;box-shadow:0 10px 25px #7c3aed25;transition:.2s}.ai-generate:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 16px 32px #7c3aed35}.ai-generate:disabled{opacity:.45;cursor:not-allowed}.ai-result{margin-top:14px;border:1px solid #ffffff0d;border-radius:13px;background:#080c12;min-height:150px;overflow:hidden}.ai-result-head{display:flex;justify-content:space-between;align-items:center;padding:9px 11px;border-bottom:1px solid #ffffff08;color:#697589;font-size:8px;text-transform:uppercase;letter-spacing:.1em}.ai-result-head button{display:flex;gap:5px;align-items:center;border:0;background:transparent;color:#9da8b7;font-size:8px;cursor:pointer}.ai-result p{padding:14px;margin:0;color:#dbe1ea;font-size:11px;line-height:1.65;white-space:pre-wrap}.ai-placeholder{display:grid;place-items:center;gap:7px;min-height:150px;color:#4e5a6c;font-size:9px}.ai-error{margin-top:10px;padding:9px 11px;border-radius:9px;border:1px solid #ef444433;background:#ef44440a;color:#fca5a5;font-size:9px}@keyframes ai-spin{to{transform:rotate(360deg)}}@keyframes ai-pulse{50%{opacity:.35;transform:scale(.7)}}@keyframes ai-flow{0%{left:0;opacity:0}15%{opacity:1}85%{opacity:1}100%{left:100%;opacity:0}}.spin{animation:ai-spin 1s linear infinite}@media(max-width:850px){.ai-layout{grid-template-columns:1fr}.ai-modes{grid-template-columns:1fr 1fr}.ai-node{display:none}.ai-field{margin-top:8px}}@media(max-width:520px){.ai-studio{padding:15px}.ai-head{display:block}.ai-live{margin-top:10px;width:max-content}.ai-modes{grid-template-columns:1fr}.ai-controls{display:grid}.ai-controls label{max-width:none}}@media(prefers-reduced-motion:reduce){.ai-hero-orbit,.ai-hero-orbit:after,.ai-live span,.ai-beam i,.spin{animation:none}}`;
