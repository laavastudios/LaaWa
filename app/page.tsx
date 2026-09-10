"use client";

import { useEffect, useState } from "react";

type Section = "Overview" | "Inbox" | "Customers" | "Leads" | "Appointments" | "Automation" | "WhatsApp" | "AI" | "Analytics" | "Settings";
const nav: Section[] = ["Overview", "Inbox", "Customers", "Leads", "Appointments", "Automation", "WhatsApp", "AI", "Analytics", "Settings"];

type GeminiState = { configured: boolean; source: "dashboard" | "environment" | null; maskedKey: string | null };

export default function Home() {
  const [section, setSection] = useState<Section>("Overview");
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [gemini, setGemini] = useState<GeminiState>({ configured: false, source: null, maskedKey: null });
  const [geminiKey, setGeminiKey] = useState("");
  const [geminiBusy, setGeminiBusy] = useState(false);
  const [geminiMessage, setGeminiMessage] = useState("");
  const [geminiError, setGeminiError] = useState("");

  async function loadGemini() {
    const r = await fetch("/api/settings/gemini", { cache: "no-store" });
    if (r.ok) setGemini(await r.json());
  }

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((data) => {
      setAuthenticated(Boolean(data.authenticated));
      if (data.authenticated) loadGemini();
    }).catch(() => setAuthenticated(false));
  }, []);

  async function login(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError("");
    const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) });
    const data = await response.json();
    if (!response.ok) setError(data.error || "Login failed."); else { setAuthenticated(true); loadGemini(); }
    setLoading(false);
  }

  async function logout() {
    await fetch("/api/auth/login", { method: "DELETE" });
    setAuthenticated(false); setPassword("");
  }

  async function saveGemini() {
    if (!geminiKey.trim()) return;
    setGeminiBusy(true); setGeminiMessage(""); setGeminiError("");
    const response = await fetch("/api/settings/gemini", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ apiKey: geminiKey.trim() }) });
    const data = await response.json();
    if (response.ok) { setGemini({ configured: true, source: "dashboard", maskedKey: data.maskedKey }); setGeminiKey(""); setGeminiMessage("✓ API key works and is securely saved."); }
    else setGeminiError(data.error || "The Gemini API key could not be verified.");
    setGeminiBusy(false);
  }

  async function removeGemini() {
    setGeminiBusy(true); setGeminiMessage(""); setGeminiError("");
    const response = await fetch("/api/settings/gemini", { method: "DELETE" });
    if (response.ok) { setGemini({ configured: false, source: null, maskedKey: null }); setGeminiMessage("Gemini dashboard key removed."); }
    else setGeminiError("Could not remove the dashboard key.");
    setGeminiBusy(false);
  }

  if (authenticated === null) return <main className="login laawa-shell"><div className="muted">Loading LaaWa…</div></main>;
  if (!authenticated) return (
    <main className="login laawa-shell grid-bg"><section className="login-card glass">
      <div className="brand"><div className="logo">L</div><span>LaaWa</span></div>
      <p className="muted" style={{ marginTop: 10 }}>AI business command center</p>
      <form onSubmit={login}>
        <div className="field"><label>Username</label><input autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Owner username" /></div>
        <div className="field"><label>Password</label><input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" /></div>
        {error && <div className="error">{error}</div>}
        <button className="primary" disabled={loading}>{loading ? "Signing in…" : "Enter LaaWa"}</button>
      </form>
    </section></main>
  );

  return <main className="app laawa-shell">
    <aside className="sidebar">
      <div className="brand"><div className="logo">L</div><span>LaaWa</span></div>
      <div className="nav">{nav.map((item) => <button key={item} className={section === item ? "active" : ""} onClick={() => setSection(item)}>{item}</button>)}</div>
      <div style={{ marginTop: "auto" }}>
        <div className="glass engine-card">
          <div className="small muted">AI ENGINE</div>
          <div className="engine-status"><span className={gemini.configured ? "dot" : "dot off"} /> {gemini.configured ? "Gemini configured" : "Gemini not configured"}</div>
          <div className="small muted">{gemini.source === "dashboard" ? "Dashboard key" : gemini.source === "environment" ? "Environment key" : "Add a key in Settings"}</div>
        </div>
        <button onClick={logout} className="signout">Sign out</button>
      </div>
    </aside>

    <section className="main">
      <header className="top"><div className="title"><h1>{section}</h1><p>{section === "Overview" ? "Live system state — no demo numbers." : `Manage ${section.toLowerCase()} from LaaWa.`}</p></div><div className="status"><span className="dot off" /> WhatsApp status: not connected</div></header>

      {section === "Overview" && <>
        <div className="cards">
          {["Conversations", "New leads", "Appointments", "AI handled"].map((label) => <div className="card glass" key={label}><div className="label">{label}</div><div className="value">0</div><div className="small muted">No live data connected yet</div></div>)}
        </div>
        <div className="grid">
          <section className="panel glass"><div className="panel-head"><h2>Live activity</h2><span className="small muted">Real events only</span></div><div className="empty"><strong>No activity yet</strong><span>Connect WhatsApp to start receiving real events.</span></div></section>
          <section className="panel glass"><div className="panel-head"><h2>System setup</h2></div><div className="quick"><button onClick={() => setSection("Settings")}>Configure Gemini API →</button><button onClick={() => setSection("WhatsApp")}>Connect WhatsApp →</button><button onClick={() => setSection("AI")}>Configure AI agent →</button><button onClick={() => setSection("Automation")}>Create automation →</button></div></section>
        </div>
      </>}

      {section === "Settings" && <section className="panel glass settings-panel">
        <div className="panel-head"><div><h2>AI provider</h2><p className="small muted" style={{ marginTop: 6 }}>Use your own Google Gemini API key. LaaWa verifies it against the Gemini API before saving.</p></div><span className={gemini.configured ? "badge good" : "badge"}>{gemini.configured ? "Configured" : "Not configured"}</span></div>
        <div className="settings-block">
          <label className="setting-label">Google Gemini API key</label>
          {gemini.configured && <div className="saved-key"><span>{gemini.maskedKey}</span><span className="small muted">{gemini.source === "dashboard" ? "Saved securely in this browser session" : "Environment fallback"}</span></div>}
          <input className="setting-input" type="password" value={geminiKey} onChange={(e) => setGeminiKey(e.target.value)} placeholder={gemini.configured ? "Enter a new key to replace the current one" : "Paste your Gemini API key"} autoComplete="off" />
          <div className="button-row"><button className="primary compact" onClick={saveGemini} disabled={geminiBusy || !geminiKey.trim()}>{geminiBusy ? "Checking…" : gemini.configured ? "Check & replace key" : "Check key & save"}</button>{gemini.configured && <button className="danger" onClick={removeGemini} disabled={geminiBusy}>Remove saved key</button>}</div>
          {geminiMessage && <div className="success">{geminiMessage}</div>}{geminiError && <div className="error">{geminiError}</div>}
        </div>
        <div className="security-note"><strong>How this works</strong><span>Your key is sent only to the server, tested with a real Gemini generation request, then encrypted before being stored in an HTTP-only cookie. It is never rendered back as plaintext.</span></div>
      </section>}

      {section !== "Overview" && section !== "Settings" && <section className="panel glass workspace"><h2>{section} workspace</h2><div className="empty"><strong>Waiting for real integration data</strong><span>No fake records are shown. This module will populate when its underlying integration is connected.</span></div></section>}
    </section>
  </main>;
}
