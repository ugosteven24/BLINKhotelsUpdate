import Link from "next/link";
import { listPayments } from "@/services/admin/payments";
import { listHotelOptions } from "@/services/admin/coupons";
import { Header, Table, Badge, Pager, Filters } from "@/components/admin/ui";
import { money, dt, pageNum, pageSizeNum } from "@/lib/format";

export default async function PaymentsPage({ searchParams }) {
  const sp = await searchParams;
  const [{ rows, total, page, pageSize }, hotels] = await Promise.all([
    listPayments({ q: sp.q, status: sp.status, hotel: sp.hotel, from: sp.from, to: sp.to, page: pageNum(sp.page), pageSize: pageSizeNum(sp.pageSize) }),
    listHotelOptions(),
  ]);
  return (
    <>
      <Header title="Payments" sub="Payments are created and confirmed by Paystack. They cannot be marked successful by hand."><Link className="adm-btn ghost" href="/admin/payments/refunds">View refunds</Link></Header>
      <Filters q={sp.q} status={sp.status} statuses={["initiated", "pending", "successful", "failed", "abandoned", "refunded", "partially_refunded"]} dates values={sp}
        extra={<select name="hotel" defaultValue={sp.hotel ?? ""} aria-label="Hotel"><option value="">All hotels</option>{hotels.map((h) => <option key={h.id} value={h.id}>{h.hotel_name}</option>)}</select>} />
      <Table rows={rows} empty="No payments match these filters." cols={[
        { head: "Reference", cell: (p) => <Link href={`/admin/payments/${p.id}`}><b>{p.payment_reference}</b></Link> },
        { head: "Reservation", cell: (p) => <Link href={`/admin/reservations/${p.reservation_id}`}>{p.reservation_code}</Link> },
        { head: "Customer", cell: (p) => p.guest },
        { head: "Hotel", cell: (p) => p.hotel_name },
        { head: "Amount", right: true, cell: (p) => money(p.amount, p.currency) },
        { head: "Provider", cell: (p) => <>{p.provider}<br /><small>{p.provider_transaction_id ?? "—"}</small></> },
        { head: "Status", cell: (p) => <Badge v={p.status} /> },
        { head: "Paid", cell: (p) => dt(p.paid_at) },
        { head: "Created", cell: (p) => dt(p.created_at) },
      ]} />
      <Pager base="/admin/payments" page={page} pageSize={pageSize} total={total} params={sp} />
    </>
  );
}
