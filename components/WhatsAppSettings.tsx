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
  const [live, setLive] = useState(false);

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
      setError("");
    } catch (e) {
      setState((current) => ({ ...current, status: "offline", connected: false }));
      setError(e instanceof Error ? e.message : "WhatsApp worker unavailable.");
    }
  }

  useEffect(() => {
    refresh();
    const source = new EventSource("/api/whatsapp/events");
    source.addEventListener("open", () => setLive(true));
    source.addEventListener("state", (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data) as Partial<State>;
        setState((current) => ({ ...current, ...payload, error: payload.error ?? current.error }));
      } catch {}
      refresh();
    });
    source.addEventListener("snapshot", () => refresh());
    source.onerror = () => setLive(false);
    const timer = window.setInterval(refresh, 6000);
    return () => { source.close(); window.clearInterval(timer); };
  }, []);

  async function generateCode() {
    const normalized = phone.replace(/\D/g, "");
    if (!normalized) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/whatsapp/pairing-code", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phoneNumber: normalized }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not generate pairing code.");
      setState((current) => ({ ...current, status: "pairing", pairingCode: data.code, qr: null, phone: normalized, error: null }));
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
      await refresh();
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
          <div className="eyebrow">WHATSAPP WEB · LIVE LINK</div>
          <h2>Connect WhatsApp</h2>
          <p className="small muted" style={{ marginTop: 6 }}>Link your real WhatsApp account. The persistent worker keeps the session until you disconnect it.</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 9px", borderRadius: 999, border: "1px solid var(--line)", background: "rgba(10,13,19,.7)", color: live ? "#4ade80" : "#fbbf24", fontSize: 10, fontWeight: 800, letterSpacing: ".08em" }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: live ? "#4ade80" : "#fbbf24", boxShadow: live ? "0 0 12px #4ade80" : "none" }} />{live ? "LIVE" : "RECONNECTING"}</span>
          <span className={state.connected ? "badge good" : "badge"}>{statusLabel}</span>
        </div>
      </div>

      {state.connected ? (
        <div className="wa-connected">
          <div className="wa-check">✓</div>
          <div>
            <strong>{state.name || "WhatsApp account"}</strong>
            <div className="small muted">{state.phone ? `+${state.phone}` : "Connected account"}</div>
            <div className="small" style={{ color: "#4ade80", marginTop: 4 }}>Session active · messages sync live</div>
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
              <div className="wa-visual-wrap">
                {state.qr ? <img className="wa-qr" src={state.qr} alt="WhatsApp pairing QR code" /> : <div className="wa-qr-placeholder"><div className="spinner" /><strong>Preparing secure QR…</strong><span className="small muted">The QR appears automatically when WhatsApp is ready.</span></div>}
                <div className="live-caption"><span /> Real-time link state</div>
              </div>
              <div className="wa-steps"><strong>Link from your phone</strong><span><b>01</b> Open WhatsApp</span><span><b>02</b> Go to Linked Devices</span><span><b>03</b> Tap Link a Device</span><span><b>04</b> Scan this QR code</span><small className="muted" style={{ marginTop: 5 }}>Keep LaaWa open until the status changes to Connected.</small></div>
            </div>
          ) : (
            <div className="wa-connect-card wa-phone-card">
              <div className="field"><label>Mobile number</label><input className="setting-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="919876543210" inputMode="tel" autoComplete="tel" /></div>
              <button className="primary compact" onClick={generateCode} disabled={busy || !phone.replace(/\D/g, "")}>{busy ? "Generating…" : "Generate pairing code"}</button>
              {state.pairingCode && <div className="pairing-code"><span className="small muted">Enter this code in WhatsApp → Linked Devices</span><strong>{state.pairingCode}</strong><span className="small muted" style={{ marginTop: 9 }}>Waiting for confirmation…</span></div>}
              <div className="wa-steps"><strong>Link from your phone</strong><span><b>01</b> Open WhatsApp</span><span><b>02</b> Go to Linked Devices</span><span><b>03</b> Choose Link with phone number instead</span><span><b>04</b> Enter the pairing code</span></div>
            </div>
          )}
        </>
      )}

      {(error || state.error) && <div className="error">{error || state.error}</div>}
      <div className="security-note"><strong>Real connection</strong><span>WhatsApp Web device linking is handled by the LaaWa worker. There is no simulated connected status in this screen.</span></div>
    </section>
  );
}
