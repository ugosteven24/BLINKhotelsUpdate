import Link from "next/link";
import { listPayouts, payoutCandidates, payoutOverview, createPayoutAction } from "@/services/admin/payouts";
import { Header, Stat, Table, Badge, Pager, Filters } from "@/components/admin/ui";
import QuickForm from "@/components/admin/QuickForm";
import { money, dt, pageNum, pageSizeNum } from "@/lib/format";

const STATUSES = ["requested", "under_review", "approved", "processing", "paid", "rejected", "failed"];

export default async function PayoutsPage({ searchParams }) {
  const sp = await searchParams;
  const [{ rows, total, page, pageSize }, candidates, o] = await Promise.all([
    listPayouts({ q: sp.q, status: sp.status, page: pageNum(sp.page), pageSize: pageSizeNum(sp.pageSize) }),
    payoutCandidates(),
    payoutOverview(),
  ]);
  return (
    <>
      <Header title="Payouts" sub="Hotel earnings = completed, paid reservations, minus refunds, using the commission fixed at booking time. A reservation can only ever be in one live payout." />
      <div className="adm-grid">
        <Stat title="Payable to hotels now" value={money(o.available)} />
        <Stat title="In progress" value={money(o.in_progress)} />
        <Stat title="Paid out" value={money(o.paid)} />
      </div>

      <h2>Ready for payout</h2>
      <Table rows={candidates} empty="No hotel has completed, unpaid earnings right now." cols={[
        { head: "Hotel", cell: (h) => <b>{h.hotel_name}</b> },
        { head: "Reservations", right: true, cell: (h) => h.reservations },
        { head: "Net payable", right: true, cell: (h) => money(h.available, h.currency) },
        { head: "Create payout", cell: (h) => h.accounts.length === 0
          ? <small>No verified bank account. <Link href="/admin/bank-accounts?status=pending">Verify one</Link></small>
          : (
            <QuickForm action={createPayoutAction}>
              <input type="hidden" name="hotel_id" value={h.hotel_id} />
              <select name="bank_account_id" aria-label="Bank account">{h.accounts.map((a) => <option key={a.id} value={a.id}>{a.bank_name} ••••{a.account_number_last4}</option>)}</select>
              <button className="adm-btn sm" data-confirm={`Create a payout of ${money(h.available, h.currency)} for ${h.hotel_name}?`}>Create payout</button>
            </QuickForm>) },
      ]} />

      <h2>All payouts</h2>
      <Filters q={sp.q} status={sp.status} statuses={STATUSES} />
      <Table rows={rows} empty="No payouts yet." cols={[
        { head: "Reference", cell: (p) => <Link href={`/admin/payouts/${p.id}`}><b>{p.payout_reference}</b></Link> },
        { head: "Hotel", cell: (p) => p.hotel_name },
        { head: "Bank", cell: (p) => `${p.bank_name} ••••${p.account_number_last4}` },
        { head: "Gross", right: true, cell: (p) => money(p.gross_amount, p.currency) },
        { head: "Commission", right: true, cell: (p) => money(p.commission_amount, p.currency) },
        { head: "Net", right: true, cell: (p) => <b>{money(p.net_amount, p.currency)}</b> },
        { head: "Status", cell: (p) => <Badge v={p.status} /> },
        { head: "Created", cell: (p) => dt(p.created_at) },
        { head: "", cell: (p) => <Link className="adm-btn ghost sm" href={`/admin/payouts/${p.id}`}>Review</Link> },
      ]} />
      <Pager base="/admin/payouts" page={page} pageSize={pageSize} total={total} params={sp} />
    </>
  );
}
