import Link from "next/link";
import { ArrowLeft, Compass, Sparkles } from "lucide-react";

export default function NotFound() {
  return <main className="runtime-shell"><div className="runtime-orb runtime-orb-a"/><div className="runtime-orb runtime-orb-b"/><section className="runtime-card glass"><div className="runtime-mark"><Compass size={24}/></div><div className="eyebrow"><Sparkles size={12}/> LAAWA / NAVIGATION</div><h1>This surface does not exist.</h1><p>The requested workspace route could not be found. Return to the command center and continue from a known surface.</p><Link className="primary runtime-action" href="/"><ArrowLeft size={16}/> Back to LaaWa</Link><span className="runtime-hint">404 · Route unavailable</span></section></main>;
}
