import Link from "next/link";
import { notFound } from "next/navigation";
import { getReservation, cancelReservationAction, deleteReservationAction } from "@/services/admin/reservations";
import DeleteButton from "@/components/admin/DeleteButton";
import { Header, Table, Badge } from "@/components/admin/ui";
import { money, d, dt, label } from "@/lib/format";

export default async function ReservationDetail({ params }) {
  const { id } = await params;
  const data = await getReservation(Number(id));
  if (!data) notFound();
  const { reservation: r, rooms, payments, history } = data;
  const cancellable = !["cancelled", "completed", "expired", "rejected"].includes(r.status);
  return (
    <>
      <Header title={r.reservation_code} sub={`${r.hotel_name} · ${d(r.check_in)} to ${d(r.check_out)} (${r.total_nights} nights)`}><Badge v={r.status} />
        <Link className="adm-btn ghost" href={`/admin/reservations/${r.id}/edit`}>Edit</Link>
        {["pending_payment", "expired", "cancelled", "rejected"].includes(r.status) && (
          <DeleteButton action={deleteReservationAction} args={[r.id]} redirectTo="/admin/reservations" className="adm-btn danger"
            title={`Delete ${r.reservation_code}?`} text="This removes the reservation and its unpaid payment attempts. It can't be undone." />
        )}
      </Header>
      <div className="adm-two">
        <div className="adm-card">
          <h2>Guest and stay</h2>
          <dl className="adm-dl">
            <dt>Guest</dt><dd><Link href={`/admin/users/${r.user_id}`}>{r.guest}</Link> · {r.guest_email}{r.guest_phone ? ` · ${r.guest_phone}` : ""}</dd>
            <dt>Party</dt><dd>{r.adults} adults, {r.children} children</dd>
            <dt>Special requests</dt><dd>{r.special_requests || "—"}</dd>
            <dt>Payment deadline</dt><dd>{dt(r.payment_deadline)}</dd>
            <dt>Approval deadline</dt><dd>{dt(r.approval_deadline)}</dd>
            {r.rejection_reason && (<><dt>Reason</dt><dd>{r.rejection_reason}</dd></>)}
          </dl>
        </div>
        <div className="adm-card">
          <h2>Money</h2>
          <dl className="adm-dl">
            <dt>Subtotal</dt><dd>{money(r.subtotal, r.currency)}</dd>
            <dt>Taxes</dt><dd>{money(r.taxes, r.currency)}</dd>
            <dt>Fees</dt><dd>{money(r.fees, r.currency)}</dd>
            <dt>Discount</dt><dd>−{money(r.discount, r.currency)}</dd>
            <dt><b>Total</b></dt><dd><b>{money(r.total_amount, r.currency)}</b></dd>
            <dt>Commission ({r.commission_rate_snapshot}%)</dt><dd>{money(r.commission_amount, r.currency)}</dd>
            <dt>Hotel receives</dt><dd>{money(r.hotel_amount, r.currency)}</dd>
          </dl>
        </div>
      </div>
      <h2>Rooms</h2>
      <Table rows={rooms} cols={[
        { head: "Room", cell: (x) => x.room_number }, { head: "Type", cell: (x) => x.room_type },
        { head: "Nightly rate", right: true, cell: (x) => money(x.nightly_rate) }, { head: "Total", right: true, cell: (x) => money(x.total_price) },
      ]} /><br />
      <h2>Payments</h2>
      <Table rows={payments} empty="No payment attempts." cols={[
        { head: "Reference", cell: (p) => <Link href={`/admin/payments/${p.id}`}>{p.payment_reference}</Link> },
        { head: "Amount", right: true, cell: (p) => money(p.amount) }, { head: "Status", cell: (p) => <Badge v={p.status} /> }, { head: "Paid", cell: (p) => dt(p.paid_at) },
      ]} /><br />
      <h2>Status history</h2>
      <Table rows={history} empty="No changes recorded." cols={[
        { head: "When", cell: (h) => dt(h.created_at) },
        { head: "Change", cell: (h) => `${label(h.old_status)} → ${label(h.new_status)}` },
        { head: "By", cell: (h) => h.changed_by ?? "System" }, { head: "Reason", cell: (h) => h.reason ?? "—" },
      ]} />
      {cancellable && (
        <div className="adm-card" style={{ marginTop: 18 }}>
          <h2>Cancel this reservation</h2>
          <p className="adm-sub">Cancelling does not refund the guest. Request a refund from the payment if one is due.</p>
          <form action={cancelReservationAction}>
            <input type="hidden" name="id" value={r.id} />
            <div className="adm-field" style={{ marginBottom: 10 }}><label htmlFor="reason">Reason</label><textarea id="reason" name="reason" rows={2} required /></div>
            <button className="adm-btn danger" data-confirm="Cancel this reservation? This can't be undone.">Cancel reservation</button>
          </form>
        </div>
      )}
    </>
  );
}
