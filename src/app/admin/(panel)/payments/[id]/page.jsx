import Link from "next/link";
import { notFound } from "next/navigation";
import { getPayment, requestRefundAction } from "@/services/admin/payments";
import { Header, Table, Badge } from "@/components/admin/ui";
import { money, dt } from "@/lib/format";

export default async function PaymentDetail({ params }) {
  const { id } = await params;
  const data = await getPayment(Number(id));
  if (!data) notFound();
  const { payment: p, refunds, refundable } = data;
  const canRefund = ["successful", "partially_refunded"].includes(p.status) && refundable > 0;
  return (
    <>
      <Header title={p.payment_reference} sub={`Provider: ${p.provider}`}><Badge v={p.status} /></Header>
      <div className="adm-card">
        <dl className="adm-dl">
          <dt>Reservation</dt><dd><Link href={`/admin/reservations/${p.reservation_id}`}>{p.reservation_code}</Link></dd>
          <dt>Amount</dt><dd>{money(p.amount, p.currency)}</dd>
          <dt>Provider transaction</dt><dd>{p.provider_transaction_id ?? "—"}</dd>
          <dt>Paid at</dt><dd>{dt(p.paid_at)}</dd>
          <dt>Failure reason</dt><dd>{p.failure_reason ?? "—"}</dd>
          <dt>Provider response</dt><dd><div className="adm-code">{p.provider_response ? JSON.stringify(typeof p.provider_response === "string" ? JSON.parse(p.provider_response) : p.provider_response, null, 2) : "—"}</div></dd>
        </dl>
      </div>
      <h2>Refunds</h2>
      <Table rows={refunds} empty="No refunds for this payment." cols={[
        { head: "Reference", cell: (r) => r.refund_reference }, { head: "Amount", right: true, cell: (r) => money(r.amount) },
        { head: "Status", cell: (r) => <Badge v={r.status} /> }, { head: "Reason", cell: (r) => r.reason ?? "—" }, { head: "Requested", cell: (r) => dt(r.created_at) },
      ]} />
      {canRefund && (
        <div className="adm-card" style={{ marginTop: 18 }}>
          <h2>Request a refund</h2>
          <p className="adm-sub">Up to {money(refundable, p.currency)} can still be refunded.</p>
          <form action={requestRefundAction}>
            <input type="hidden" name="payment_id" value={p.id} />
            <div className="adm-form">
              <div className="adm-field"><label htmlFor="amount">Amount</label><input id="amount" name="amount" type="number" step="0.01" min="0.01" max={refundable} defaultValue={refundable} required /></div>
              <div className="adm-field"><label htmlFor="reason">Reason</label><input id="reason" name="reason" required maxLength={500} /></div>
            </div>
            <p><button className="adm-btn" data-confirm="Create this refund request?">Request refund</button></p>
          </form>
        </div>
      )}
    </>
  );
}
