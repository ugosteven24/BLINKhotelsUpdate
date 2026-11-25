import Link from "next/link";
import { notFound } from "next/navigation";
import { getPayout, payoutTransitionAction } from "@/services/admin/payouts";
import { Header, Table, Badge } from "@/components/admin/ui";
import QuickForm from "@/components/admin/QuickForm";
import { money, dt, d, label } from "@/lib/format";

const Step = ({ id, to, children, danger, reason, detail }) => (
  <QuickForm action={payoutTransitionAction} className="adm-inline">
    <input type="hidden" name="id" value={id} /><input type="hidden" name="to" value={to} />
    {reason && <input name="reason" placeholder="Reason" required minLength={3} maxLength={500} aria-label="Reason" />}
    <button className={`adm-btn sm${danger ? " danger" : ""}`} data-confirm={`${children}?`} data-confirm-detail={detail}>{children}</button>
  </QuickForm>
);

export default async function PayoutDetail({ params }) {
  const { id } = await params;
  const data = await getPayout(Number(id));
  if (!data) notFound();
  const { payout: p, items, history } = data;
  const st = p.status;
  return (
    <>
      <Header title={p.payout_reference} sub={p.hotel_name}><Badge v={st} /></Header>
      <div className="adm-two">
        <div className="adm-card">
          <h2>Amounts</h2>
          <dl className="adm-dl">
            <dt>Gross booking value</dt><dd>{money(p.gross_amount, p.currency)}</dd>
            <dt>Platform commission</dt><dd>− {money(p.commission_amount, p.currency)}</dd>
            <dt>Refund adjustments</dt><dd>{money(p.refund_adjustments, p.currency)}</dd>
            <dt>Other adjustments</dt><dd>{money(p.other_adjustments, p.currency)}</dd>
            <dt><b>Net payable</b></dt><dd><b>{money(p.net_amount, p.currency)}</b></dd>
          </dl>
        </div>
        <div className="adm-card">
          <h2>Destination</h2>
          <dl className="adm-dl">
            <dt>Bank</dt><dd>{p.bank_name}</dd><dt>Account name</dt><dd>{p.account_name}</dd>
            <dt>Account</dt><dd>••••{p.account_number_last4}</dd><dt>Verification</dt><dd><Badge v={p.verification_status} /></dd>
            <dt>Transfer reference</dt><dd>{p.provider_transfer_reference ?? "—"}</dd>
            <dt>Approved</dt><dd>{dt(p.approved_at)}</dd><dt>Paid</dt><dd>{dt(p.paid_at)}</dd>
            {p.rejection_reason && <><dt>Reason</dt><dd>{p.rejection_reason}</dd></>}
          </dl>
        </div>
      </div>

      {!["paid", "rejected", "failed"].includes(st) && (
        <div className="adm-card">
          <h2>Actions</h2>
          <div className="adm-inline" style={{ flexWrap: "wrap", gap: 12 }}>
            {st === "requested" && <Step id={p.id} to="under_review">Start review</Step>}
            {["requested", "under_review"].includes(st) && <Step id={p.id} to="approved" detail="Approving does not move money. Pay the hotel, then record the transfer below.">Approve payout</Step>}
            {["requested", "under_review"].includes(st) && <Step id={p.id} to="rejected" danger reason>Reject</Step>}
            {st === "approved" && <Step id={p.id} to="processing">Mark transfer in progress</Step>}
            {["approved", "processing"].includes(st) && <Step id={p.id} to="failed" danger reason>Mark transfer failed</Step>}
          </div>
          {["approved", "processing"].includes(st) && (
            <QuickForm action={payoutTransitionAction} className="adm-form">
              <input type="hidden" name="id" value={p.id} /><input type="hidden" name="to" value="paid" />
              <div className="adm-field"><label htmlFor="transfer_reference">Bank / provider transfer reference</label><input id="transfer_reference" name="transfer_reference" required minLength={6} maxLength={120} /></div>
              <div className="adm-field"><label><input type="checkbox" name="confirmed" /> I have confirmation that this transfer was received/cleared.</label></div>
              <p><button className="adm-btn" data-confirm="Mark this payout as PAID?" data-confirm-detail="Only do this once the transfer is confirmed. It settles these reservations.">Mark as paid</button></p>
            </QuickForm>
          )}
          <p className="adm-sub">Rejected or failed payouts release their reservations so they can be included in a later payout.</p>
        </div>
      )}

      <h2>Included reservations ({items.length})</h2>
      <Table rows={items} cols={[
        { head: "Reservation", cell: (i) => <Link href={`/admin/reservations/${i.reservation_id}`}>{i.reservation_code}</Link> },
        { head: "Stay", cell: (i) => `${d(i.check_in)} → ${d(i.check_out)}` },
        { head: "Gross", right: true, cell: (i) => money(i.gross_amount, p.currency) },
        { head: "Commission", right: true, cell: (i) => money(i.commission_amount, p.currency) },
        { head: "Adjustment", right: true, cell: (i) => money(i.adjustment_amount, p.currency) },
        { head: "Net", right: true, cell: (i) => money(i.net_amount, p.currency) },
      ]} />
      <h2>History</h2>
      <Table rows={history} empty="No recorded actions." cols={[
        { head: "When", cell: (h) => dt(h.created_at) }, { head: "Action", cell: (h) => label(h.action) }, { head: "By", cell: (h) => h.actor ?? "System" },
      ]} />
    </>
  );
}
