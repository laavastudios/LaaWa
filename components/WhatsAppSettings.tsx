"use client";

import { useEffect, useState } from "react";

type State = {
  status: string;
  connected: boolean;
  qr: string | null;
  pairingCode: string | null;
  phone: string | null;
  name: string | null;
  error: string | null;
};

const initial: State = { status: "offline", connected: false, qr: null, pairingCode: null, phone: null, name: null, error: null };

export default function WhatsAppSettings() {
  const [state, setState] = useState<State>(initial);
  const [mode, setMode] = useState<"qr" | "phone">("qr");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function refresh() {
    try {
      const status = await fetch("/api/whatsapp/status", { cache: "no-store" });
      const data = await status.json();
      if (!status.ok) throw new Error(data.error || "WhatsApp worker unavailable.");
      setState(data);

      if (data.qr) {
        const qr = await fetch("/api/whatsapp/qr", { cache: "no-store" });
        const qrData = await qr.json();
        if (qrData.qr) setState((current) => ({ ...current, qr: qrData.qr }));
      }
    } catch (e) {
      setState((current) => ({ ...current, status: "offline", connected: false }));
      setError(e instanceof Error ? e.message : "WhatsApp worker unavailable.");
    }
  }

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 2500);
    return () => window.clearInterval(timer);
  }, []);

  async function generateCode() {
    if (!phone.trim()) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/whatsapp/pairing-code", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phoneNumber: phone.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not generate pairing code.");
      setState((current) => ({ ...current, status: "pairing", pairingCode: data.code, qr: null, phone: phone.replace(/\D/g, "") }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate pairing code.");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/whatsapp/logout", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not disconnect WhatsApp.");
      setState(initial);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not disconnect WhatsApp.");
    } finally {
      setBusy(false);
    }
  }

  const statusLabel = state.connected ? "Connected" : state.status === "qr" ? "Waiting for QR scan" : state.status === "pairing" ? "Waiting for phone confirmation" : state.status === "offline" ? "Worker offline" : "Connecting";

  return (
    <section className="panel glass whatsapp-settings">
      <div className="panel-head">
        <div>
          <div className="eyebrow">WHATSAPP WEB</div>
          <h2>Connect WhatsApp</h2>
          <p className="small muted" style={{ marginTop: 6 }}>Link your real WhatsApp account. Your session is saved by the worker so you do not need to scan every time.</p>
        </div>
        <span className={state.connected ? "badge good" : "badge"}>{statusLabel}</span>
      </div>

      {state.connected ? (
        <div className="wa-connected">
          <div className="wa-check">✓</div>
          <div>
            <strong>{state.name || "WhatsApp account"}</strong>
            <div className="small muted">{state.phone ? `+${state.phone}` : "Connected account"}</div>
          </div>
          <button className="danger" onClick={disconnect} disabled={busy}>{busy ? "Disconnecting…" : "Disconnect"}</button>
        </div>
      ) : (
        <>
          <div className="wa-tabs">
            <button className={mode === "qr" ? "active" : ""} onClick={() => { setMode("qr"); setError(""); }}>Scan QR code</button>
            <button className={mode === "phone" ? "active" : ""} onClick={() => { setMode("phone"); setError(""); }}>Use phone number</button>
          </div>

          {mode === "qr" ? (
            <div className="wa-connect-card">
              {state.qr ? <img className="wa-qr" src={state.qr} alt="WhatsApp pairing QR code" /> : <div className="wa-qr-placeholder"><div className="spinner" /><strong>Preparing secure QR…</strong><span className="small muted">Keep this page open.</span></div>}
              <div className="wa-steps"><strong>On your phone</strong><span>1. Open WhatsApp</span><span>2. Go to Linked Devices</span><span>3. Tap Link a Device</span><span>4. Scan this QR code</span></div>
            </div>
          ) : (
            <div className="wa-connect-card wa-phone-card">
              <div className="field"><label>Mobile number</label><input className="setting-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="919876543210" inputMode="tel" autoComplete="tel" /></div>
              <button className="primary compact" onClick={generateCode} disabled={busy || !phone.trim()}>{busy ? "Generating…" : "Generate 8-character code"}</button>
              {state.pairingCode && <div className="pairing-code"><span className="small muted">Enter this code in WhatsApp → Linked Devices</span><strong>{state.pairingCode}</strong></div>}
              <div className="wa-steps"><strong>On your phone</strong><span>1. Open WhatsApp</span><span>2. Go to Linked Devices</span><span>3. Choose Link with phone number instead</span><span>4. Enter the 8-character code above</span></div>
            </div>
          )}
        </>
      )}

      {error && <div className="error">{error}</div>}
      {state.error && !error && <div className="error">{state.error}</div>}

      <div className="security-note"><strong>Real connection</strong><span>This uses WhatsApp Web device linking through the persistent LaaWa WhatsApp worker. It is not a fake dashboard status.</span></div>
    </section>
  );
}
