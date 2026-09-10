"use client";

import { useEffect, useState } from "react";

type WhatsAppState = {
  configured: boolean;
  source: "dashboard" | "environment" | null;
  phoneNumberId: string | null;
};

export default function WhatsAppSettings() {
  const [state, setState] = useState<WhatsAppState>({ configured: false, source: null, phoneNumberId: null });
  const [accessToken, setAccessToken] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const response = await fetch("/api/settings/whatsapp", { cache: "no-store" });
    if (response.ok) setState(await response.json());
  }

  useEffect(() => { load(); }, []);

  async function connect() {
    if (!accessToken.trim() || !phoneNumberId.trim()) return;
    setBusy(true); setMessage(""); setError("");

    const response = await fetch("/api/settings/whatsapp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken: accessToken.trim(), phoneNumberId: phoneNumberId.trim() }),
    });
    const data = await response.json();

    if (response.ok) {
      setState({ configured: true, source: "dashboard", phoneNumberId: data.phoneNumberId });
      setAccessToken("");
      setPhoneNumberId("");
      setMessage(`Connected${data.verifiedName ? ` to ${data.verifiedName}` : ""}${data.displayPhoneNumber ? ` · ${data.displayPhoneNumber}` : ""}.`);
    } else {
      setError(data.error || "WhatsApp connection failed.");
    }

    setBusy(false);
  }

  async function disconnect() {
    setBusy(true); setMessage(""); setError("");
    const response = await fetch("/api/settings/whatsapp", { method: "DELETE" });
    if (response.ok) {
      setState({ configured: false, source: null, phoneNumberId: null });
      setMessage("Dashboard WhatsApp credentials removed.");
    } else {
      setError("Could not remove the saved WhatsApp credentials.");
    }
    setBusy(false);
  }

  return (
    <section className="panel glass settings-panel whatsapp-settings">
      <div className="panel-head">
        <div>
          <div className="eyebrow">WHATSAPP CLOUD API</div>
          <h2>Connect your business number</h2>
          <p className="small muted" style={{ marginTop: 6 }}>
            LaaWa checks the credentials against Meta before saving them. No fake online status is shown.
          </p>
        </div>
        <span className={state.configured ? "badge good" : "badge"}>{state.configured ? "Connected" : "Not connected"}</span>
      </div>

      {state.configured && (
        <div className="saved-key">
          <span>{state.phoneNumberId}</span>
          <span className="small muted">{state.source === "dashboard" ? "Saved securely in this browser" : "Environment configuration"}</span>
        </div>
      )}

      <div className="field">
        <label>WhatsApp access token</label>
        <input className="setting-input" type="password" value={accessToken} onChange={(e) => setAccessToken(e.target.value)} placeholder="Paste your Meta access token" autoComplete="off" />
      </div>

      <div className="field">
        <label>Phone number ID</label>
        <input className="setting-input" value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)} placeholder="WhatsApp phone number ID" autoComplete="off" />
      </div>

      <div className="button-row">
        <button className="primary compact" onClick={connect} disabled={busy || !accessToken.trim() || !phoneNumberId.trim()}>{busy ? "Checking…" : state.configured ? "Check & replace" : "Check & connect"}</button>
        {state.configured && <button className="danger" onClick={disconnect} disabled={busy}>Disconnect</button>}
      </div>

      {message && <div className="success">{message}</div>}
      {error && <div className="error">{error}</div>}

      <div className="security-note">
        <strong>What LaaWa checks</strong>
        <span>The access token is used server-side to query the selected WhatsApp phone number through Meta's Graph API. Only masked identifiers are returned to the dashboard.</span>
      </div>
    </section>
  );
}
