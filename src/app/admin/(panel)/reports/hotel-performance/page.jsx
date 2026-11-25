import Link from "next/link";
import { hotelPerformanceReport } from "@/services/admin/reports";
import { Table, Pager } from "@/components/admin/ui";
import { money, num, paginate } from "@/lib/format";
import ReportHeader from "../ReportHeader";

export default async function Page({ searchParams }) {
  const sp = await searchParams;
  const r = await hotelPerformanceReport(sp);
  const pg = paginate(r.rows ?? r.top, sp);
  return (
    <>
      <ReportHeader title="Hotel Performance" sub="Approved hotels ranked by revenue. Drop-off is the share of bookings rejected, expired or cancelled." from={r.from} to={r.to} search q={sp.q} />
      <Table rows={pg.rows} empty="No approved hotels match." cols={[
        { head: "Hotel", cell: (h) => <Link href={`/admin/hotels/${h.id}`}><b>{h.hotel_name}</b></Link> },
        { head: "City", cell: (h) => h.city },
        { head: "Active rooms", right: true, cell: (h) => num(h.active_rooms) },
        { head: "Bookings", right: true, cell: (h) => num(h.bookings) },
        { head: "Drop-off", right: true, cell: (h) => h.drop_rate == null ? "—" : `${h.drop_rate}%` },
        { head: "Revenue", right: true, cell: (h) => money(h.revenue) },
        { head: "Commission", right: true, cell: (h) => money(h.commission) },
      ]} />
      <Pager base="/admin/reports/hotel-performance" page={pg.page} pageSize={pg.pageSize} total={pg.total} params={sp} />
    </>
  );
}
