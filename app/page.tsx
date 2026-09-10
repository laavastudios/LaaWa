"use client";

import { useEffect, useState } from "react";

type Section = "Overview" | "Inbox" | "Customers" | "Leads" | "Appointments" | "Automation" | "WhatsApp" | "AI" | "Analytics" | "Settings";

const nav: Section[] = ["Overview", "Inbox", "Customers", "Leads", "Appointments", "Automation", "WhatsApp", "AI", "Analytics", "Settings"];

const activities = [
  ["RS", "Rahul Sharma", "Asked about tomorrow's 5 PM slot", "2m"],
  ["AK", "Aisha Khan", "Appointment confirmed", "8m"],
  ["MV", "Mohit Verma", "AI follow-up sent", "19m"],
  ["PS", "Priya Singh", "Human handoff requested", "31m"],
];

export default function Home() {
  const [section, setSection] = useState<Section>("Overview");
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((data) => setAuthenticated(Boolean(data.authenticated))).catch(() => setAuthenticated(false));
  }, []);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) });
    const data = await response.json();
    if (!response.ok) setError(data.error || "Login failed.");
    else setAuthenticated(true);
    setLoading(false);
  }

  async function logout() {
    await fetch("/api/auth/login", { method: "DELETE" });
    setAuthenticated(false);
    setPassword("");
  }

  if (authenticated === null) return <main className="login laawa-shell"><div className="muted">Loading LaaWa…</div></main>;

  if (!authenticated) return (
    <main className="login laawa-shell grid-bg">
      <section className="login-card glass">
        <div className="brand"><div className="logo">L</div><span>LaaWa</span></div>
        <p className="muted" style={{ marginTop: 10 }}>AI business command center</p>
        <form onSubmit={login}>
          <div className="field"><label>Username</label><input autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Owner username" /></div>
          <div className="field"><label>Password</label><input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" /></div>
          {error && <div className="error">{error}</div>}
          <button className="primary" disabled={loading}>{loading ? "Signing in…" : "Enter LaaWa"}</button>
        </form>
      </section>
    </main>
  );

  return (
    <main className="app laawa-shell">
      <aside className="sidebar">
        <div className="brand"><div className="logo">L</div><span>LaaWa</span></div>
        <div className="nav">
          {nav.map((item) => <button key={item} className={section === item ? "active" : ""} onClick={() => setSection(item)}>{item}</button>)}
        </div>
        <div style={{ marginTop: "auto" }}>
          <div className="glass" style={{ padding: 14, borderRadius: 14 }}>
            <div className="small muted">AI ENGINE</div>
            <div style={{ marginTop: 6, fontWeight: 700 }}>Gemini connected</div>
            <div className="small muted" style={{ marginTop: 4 }}>Server-side key</div>
          </div>
          <button onClick={logout} style={{ width:"100%", marginTop:10, padding:10, border:0, background:"transparent", color:"#8d98a8", textAlign:"left" }}>Sign out</button>
        </div>
      </aside>

      <section className="main">
        <header className="top">
          <div className="title"><h1>{section}</h1><p>{section === "Overview" ? "Your business at a glance." : `Manage ${section.toLowerCase()} from LaaWa.`}</p></div>
          <div className="status"><span className="dot" /> WhatsApp worker online</div>
        </header>

        {section === "Overview" ? <>
          <div className="cards">
            {[["Conversations","1,284","+18.4%"],["New leads","186","+12.1%"],["Appointments","94","+8.7%"],["AI handled","91.6%","+4.2%"]].map(([label,value,delta]) => <div className="card glass" key={label}><div className="label">{label}</div><div className="value">{value}</div><div className="delta">{delta} this month</div></div>)}
          </div>
          <div className="grid">
            <section className="panel glass">
              <div className="panel-head"><h2>Live activity</h2><span className="small muted">Today</span></div>
              <div className="activity">{activities.map(([initials,name,message,time]) => <div className="activity-row" key={name}><div className="avatar">{initials}</div><div style={{flex:1}}><div style={{fontWeight:650,fontSize:13}}>{name}</div><div className="small muted" style={{marginTop:3}}>{message}</div></div><div className="small muted">{time}</div></div>)}</div>
            </section>
            <section className="panel glass">
              <div className="panel-head"><h2>Quick actions</h2></div>
              <div className="quick">
                <button onClick={() => setSection("WhatsApp")}>Connect WhatsApp →</button>
                <button onClick={() => setSection("AI")}>Configure AI agent →</button>
                <button onClick={() => setSection("Automation")}>Create automation →</button>
                <button onClick={() => setSection("Analytics")}>View full analytics →</button>
              </div>
            </section>
          </div>
        </> : <section className="panel glass" style={{ minHeight: 420 }}><h2>{section} workspace</h2><p className="muted" style={{ marginTop: 10 }}>This module is being connected to the production data layer. The dashboard shell, authentication, deployment foundation and AI integration are already structured for the next build stage.</p></section>}
      </section>
    </main>
  );
}
