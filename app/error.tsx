"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("LaaWa application error", error);
  }, [error]);

  return (
    <main className="login laawa-shell grid-bg">
      <section className="login-card glass">
        <div className="brand"><span>LaaWa</span></div>
        <div className="eyebrow">SYSTEM RECOVERY</div>
        <h1>Something went wrong.</h1>
        <p className="muted">The workspace hit an unexpected error. Your data and WhatsApp session were not intentionally changed.</p>
        <button className="primary" onClick={() => reset()}>Try again</button>
      </section>
    </main>
  );
}
