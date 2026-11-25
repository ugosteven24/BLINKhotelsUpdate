"use client";

export default function PanelError({ error, reset }) {
  return (
    <div className="adm-card" role="alert">
      <h2>Something went wrong</h2>
      <p className="adm-sub">This page couldn't be loaded. It's usually temporary (for example a database connection hiccup).</p>
      {error?.digest && <p><small>Reference: {error.digest}</small></p>}
      <p className="adm-inline"><button className="adm-btn" onClick={() => reset()}>Try again</button>
        <a className="adm-btn ghost" href="/admin">Back to dashboard</a></p>
    </div>
  );
}
