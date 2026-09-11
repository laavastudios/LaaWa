"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("LaaWa application error", error); }, [error]);
  return <main className="runtime-shell"><div className="runtime-orb runtime-orb-a"/><div className="runtime-orb runtime-orb-b"/><section className="runtime-card glass"><div className="runtime-mark"><AlertTriangle size={24}/></div><div className="eyebrow">LAAWA / RECOVERY</div><h1>Something interrupted the workspace.</h1><p>The application reached an unexpected runtime boundary. Your stored workspace data is unchanged.</p><button className="primary runtime-action" onClick={() => reset()}><RefreshCw size={16}/> Try again</button><span className="runtime-hint">If this persists, inspect deployment logs and database connectivity.</span></section></main>;
}
