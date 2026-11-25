import Link from "next/link";
import { listReservations, deleteReservationAction } from "@/services/admin/reservations";
import RowActions from "@/components/admin/RowActions";
import { Header, Table, Badge, Pager, Filters } from "@/components/admin/ui";
import { money, d, pageNum, pageSizeNum } from "@/lib/format";

const STATUSES = ["pending_payment", "pending_approval", "approved", "rejected", "cancelled", "checked_in", "completed", "expired"];

export default async function ReservationsPage({ searchParams }) {
  const sp = await searchParams;
  const { rows, total, page, pageSize } = await listReservations({ q: sp.q, status: sp.status, from: sp.from, to: sp.to, page: pageNum(sp.page), pageSize: pageSizeNum(sp.pageSize) });
  return (
    <>
      <Header title="Reservations" sub="Filter by check-in date to see arrivals in a period." />
      <Filters q={sp.q} status={sp.status} statuses={STATUSES} dates values={sp} />
      <Table rows={rows} empty="No reservations match these filters." cols={[
        { head: "Code", cell: (r) => <Link href={`/admin/reservations/${r.id}`}><b>{r.reservation_code}</b></Link> },
        { head: "Guest", cell: (r) => r.guest },
        { head: "Hotel", cell: (r) => r.hotel_name },
        { head: "Stay", cell: (r) => `${d(r.check_in)} – ${d(r.check_out)}` },
        { head: "Status", cell: (r) => <Badge v={r.status} /> },
        { head: "Total", right: true, cell: (r) => money(r.total_amount, r.currency) },
        { head: "Actions", cell: (r) => (
          <RowActions view={`/admin/reservations/${r.id}`} edit={`/admin/reservations/${r.id}/edit`}
            del={["pending_payment", "expired", "cancelled", "rejected"].includes(r.status)
              ? { action: deleteReservationAction, args: [r.id], title: `Delete ${r.reservation_code}?`, text: "This removes the reservation and its unpaid payment attempts. It can't be undone." }
              : undefined} />) },
      ]} />
      <Pager base="/admin/reservations" page={page} pageSize={pageSize} total={total} params={sp} />
    </>
  );
}
