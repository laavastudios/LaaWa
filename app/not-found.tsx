import Link from "next/link";

export default function NotFound() {
  return (
    <main className="login laawa-shell grid-bg">
      <section className="login-card glass">
        <div className="brand"><span>LaaWa</span></div>
        <div className="eyebrow">404 / NOT FOUND</div>
        <h1>That workspace route doesn’t exist.</h1>
        <p className="muted">The page may have moved or the route is not enabled in this deployment.</p>
        <Link className="primary" href="/">Return to command center</Link>
      </section>
    </main>
  );
}
