"use client";

import { useState } from "react";
import { CheckCircle2, KeyRound, Loader2, ShieldCheck, XCircle } from "lucide-react";

export default function DashboardPage() {
  const [apiKey, setApiKey] = useState("");
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [testing, setTesting] = useState(false);

  async function testGemini() {
    setTesting(true);
    setStatus(null);
    try {
      const response = await fetch("/api/settings/gemini-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      });
      const data = await response.json();
      setStatus({ ok: Boolean(data.ok), text: data.ok ? data.message : data.error });
    } catch {
      setStatus({ ok: false, text: "Connection test failed." });
    } finally {
      setTesting(false);
    }
  }

  return (
    <main className="dashboard-page">
      <section className="dashboard-header">
        <div>
          <p className="eyebrow">LaaWa Control Center</p>
          <h1>Dashboard</h1>
          <p className="muted">Configure your AI engine and verify integrations before going live.</p>
        </div>
        <div className="status-pill"><span /> System ready</div>
      </section>

      <section className="stats-grid">
        <div className="stat-card"><span>WhatsApp</span><strong>Not connected</strong><small>Connect after the worker is configured</small></div>
        <div className="stat-card"><span>AI engine</span><strong>Gemini</strong><small>Bring your own API key</small></div>
        <div className="stat-card"><span>Conversations</span><strong>0</strong><small>Real tracking will appear here</small></div>
        <div className="stat-card"><span>Leads</span><strong>0</strong><small>Captured from WhatsApp</small></div>
      </section>

      <section className="panel">
        <div className="panel-title">
          <div className="icon-box"><KeyRound size={20} /></div>
          <div><h2>Gemini API</h2><p>Use your own Google AI Studio key. LaaWa tests it directly from the server.</p></div>
        </div>

        <label htmlFor="gemini-key">API key</label>
        <div className="key-row">
          <input id="gemini-key" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="AIza..." autoComplete="off" />
          <button onClick={testGemini} disabled={!apiKey.trim() || testing}>
            {testing ? <><Loader2 size={17} className="spin" /> Testing...</> : "Test key"}
          </button>
        </div>

        {status && <div className={`test-result ${status.ok ? "success" : "error"}`}>
          {status.ok ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
          <span>{status.text}</span>
        </div>}

        <div className="security-note"><ShieldCheck size={17} /><span>The key is sent to LaaWa over HTTPS and is never displayed back to the browser after the test.</span></div>
      </section>
    </main>
  );
}
