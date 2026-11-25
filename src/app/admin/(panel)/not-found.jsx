import Link from "next/link";

export default function PanelNotFound() {
  return (
    <div className="adm-card">
      <h2>We couldn't find that</h2>
      <p className="adm-sub">It may have been deleted, or the link is wrong.</p>
      <p><Link className="adm-btn" href="/admin">Back to dashboard</Link></p>
    </div>
  );
}
