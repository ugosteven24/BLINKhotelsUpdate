import Link from "next/link";
import { getDashboard } from "@/services/admin/dashboard";
import { Header, Stat, Table, Badge, Bars } from "@/components/admin/ui";
import { money, num, dt, label } from "@/lib/format";

export default async function Dashboard() {
  const { totals: t, pending: p, status, series, regGrowth, byState, topHotels, recent, recentHotels, recentPayments, recentActivity, payouts } = await getDashboard();
  return (
    <>
      <Header title="Dashboard" sub="What needs your attention and how the marketplace is doing. Every figure is calculated from live data." />

      <div className="adm-grid">
        <Stat title="Hotels awaiting approval" value={num(p.hotels)} alert={p.hotels > 0} href="/admin/hotels?status=pending" />
        <Stat title="Reservations pending approval" value={num(p.reservations)} alert={p.reservations > 0} href="/admin/reservations?status=pending_approval" />
        <Stat title="Open refunds" value={num(p.refunds)} alert={p.refunds > 0} href="/admin/payments/refunds?status=pending" />
        <Stat title="Payouts to review" value={num(p.payouts)} alert={p.payouts > 0} href="/admin/payouts?status=requested" />
        <Stat title="Bank accounts to verify" value={num(p.bank_accounts)} alert={p.bank_accounts > 0} href="/admin/bank-accounts?status=pending" />
        <Stat title="Failed webhooks" value={num(p.failed_webhooks)} alert={p.failed_webhooks > 0} href="/admin/webhooks?status=failed" />
      </div>

      <h2>Hotels & people</h2>
      <div className="adm-grid">
        <Stat title="Hotels (all)" value={num(t.hotels)} />
        <Stat title="Approved" value={num(t.active_hotels)} />
        <Stat title="Pending" value={num(t.pending_hotels)} />
        <Stat title="Rejected" value={num(t.rejected_hotels)} />
        <Stat title="Suspended" value={num(t.suspended_hotels)} />
        <Stat title="Customers" value={num(t.customers)} />
        <Stat title="Hotel owners" value={num(t.owners)} />
        <Stat title="Hotel staff" value={num(t.staff)} />
      </div>

      <h2>Reservations & money</h2>
      <div className="adm-grid">
        <Stat title="Reservations (all time)" value={num(t.reservations)} />
        <Stat title="Awaiting payment" value={num(t.res_pending_payment)} />
        <Stat title="Approved" value={num(t.res_approved)} />
        <Stat title="Cancelled" value={num(t.res_cancelled)} />
        <Stat title="Successful payments" value={`${num(t.payments_count)} · ${money(t.gross_paid)}`} />
        <Stat title="Gross booking value" value={money(t.booking_value)} />
        <Stat title="Platform commission" value={money(t.commission)} />
        <Stat title="Owed to hotels (payable now)" value={money(payouts.available)} />
        <Stat title="Payouts in progress" value={money(payouts.in_progress)} />
        <Stat title="Paid out to hotels" value={money(payouts.paid)} />
      </div>

      <div className="adm-two">
        <div className="adm-card"><h2>Payments received, last 30 days</h2><Bars fmt={money} data={series.map((s) => ({ label: String(s.day).slice(5), value: Number(s.collected) }))} /></div>
        <div className="adm-card"><h2>Reservations created, last 30 days</h2><Bars data={series.map((s) => ({ label: String(s.day).slice(5), value: Number(s.bookings) }))} /></div>
      </div>
      <div className="adm-two">
        <div className="adm-card"><h2>Hotel registrations by month</h2><Bars data={regGrowth.map((r) => ({ label: r.month.slice(2), value: Number(r.n) }))} /></div>
        <div className="adm-card"><h2>Reservation status</h2>
          <Table rows={status} empty="No reservations yet." cols={[{ head: "Status", cell: (s) => <Badge v={s.status} /> }, { head: "Count", right: true, cell: (s) => num(s.n) }]} /></div>
      </div>
      <div className="adm-two">
        <div className="adm-card"><h2>Top-performing hotels</h2>
          <Table rows={topHotels} empty="No confirmed bookings yet." cols={[
            { head: "Hotel", cell: (h) => <Link href={`/admin/hotels/${h.id}`}>{h.hotel_name}</Link> }, { head: "Bookings", right: true, cell: (h) => num(h.bookings) }, { head: "Value", right: true, cell: (h) => money(h.value) }]} /></div>
        <div className="adm-card"><h2>Hotels by state</h2>
          <Table rows={byState} empty="No hotels yet." cols={[{ head: "State", cell: (s) => s.state }, { head: "Hotels", right: true, cell: (s) => num(s.n) }]} /></div>
      </div>

      <h2>Latest reservations</h2>
      <Table rows={recent} empty="No reservations yet." cols={[
        { head: "Code", cell: (r) => <Link href={`/admin/reservations/${r.id}`}>{r.reservation_code}</Link> }, { head: "Guest", cell: (r) => r.guest }, { head: "Hotel", cell: (r) => r.hotel_name },
        { head: "Status", cell: (r) => <Badge v={r.status} /> }, { head: "Total", right: true, cell: (r) => money(r.total_amount, r.currency) }, { head: "Created", cell: (r) => dt(r.created_at) }]} />
      <div className="adm-two">
        <div><h2>Recently registered hotels</h2>
          <Table rows={recentHotels} empty="No hotels yet." cols={[
            { head: "Hotel", cell: (h) => <Link href={`/admin/hotels/${h.id}`}>{h.hotel_name}</Link> }, { head: "Location", cell: (h) => `${h.city}, ${h.state}` }, { head: "Status", cell: (h) => <Badge v={h.approval_status} /> }]} /></div>
        <div><h2>Recent payments</h2>
          <Table rows={recentPayments} empty="No payments yet." cols={[
            { head: "Reference", cell: (x) => <Link href={`/admin/payments/${x.id}`}>{x.payment_reference}</Link> }, { head: "Amount", right: true, cell: (x) => money(x.amount, x.currency) }, { head: "Status", cell: (x) => <Badge v={x.status} /> }]} /></div>
      </div>
      <h2>Recent administrative activity</h2>
      <Table rows={recentActivity} empty="No activity recorded yet." cols={[
        { head: "When", cell: (a) => dt(a.created_at) }, { head: "Admin", cell: (a) => a.actor ?? "System" }, { head: "Action", cell: (a) => label(a.action) }, { head: "Entity", cell: (a) => `${a.entity_type ?? "—"} ${a.entity_id ?? ""}` }]} />
    </>
  );
}
