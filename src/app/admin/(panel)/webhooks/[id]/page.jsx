import Link from "next/link";
import { notFound } from "next/navigation";
import { getWebhookEvent } from "@/services/admin/webhooks";
import { Header, Badge } from "@/components/admin/ui";
import { dt } from "@/lib/format";

export default async function WebhookDetail({ params }) {
  const { id } = await params;
  const e = await getWebhookEvent(Number(id));
  if (!e) notFound();
  return (
    <>
      <Header title={e.event_type} sub={`${e.provider} · ${e.provider_event_id}`}><Badge v={e.processing_status} /></Header>
      <div className="adm-card">
        <dl className="adm-dl">
          <dt>Payment reference</dt><dd>{e.payment_reference ?? "—"}</dd>
          <dt>Received</dt><dd>{dt(e.received_at)}</dd><dt>Processed</dt><dd>{dt(e.processed_at)}</dd>
          <dt>Processing error</dt><dd>{e.processing_error ?? "—"}</dd>
        </dl>
      </div>
      <div className="adm-card">
        <h2>Payload</h2>
        <p className="adm-sub">Customer, card, bank and key-like fields are masked before display.</p>
        <div className="adm-code" style={{ maxWidth: "none" }}>{e.payloadText}</div>
      </div>
      <p><Link className="adm-btn ghost" href="/admin/webhooks">Back to events</Link></p>
    </>
  );
}
