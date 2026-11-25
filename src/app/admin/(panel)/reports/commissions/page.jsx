import Link from "next/link";
import { commissionReport } from "@/services/admin/reports";
import { Table, Stat, Pager } from "@/components/admin/ui";
import { money, num, paginate } from "@/lib/format";
import ReportHeader from "../ReportHeader";

export default async function Page({ searchParams }) {
  const sp = await searchParams;
  const r = await commissionReport(sp);
  const pg = paginate(r.rows ?? r.top, sp);
  const sum = (k) => r.rows.reduce((a, x) => a + Number(x[k] ?? 0), 0);
  return (
    <>
      <ReportHeader title="Commission Reports" sub="Uses the rate recorded on each reservation, not the hotel's current rate." from={r.from} to={r.to} search q={sp.q} />
      <div className="adm-grid"><Stat title="Total commission" value={money(sum("commission"))} /><Stat title="Total hotel payouts" value={money(sum("payout"))} /></div>
      <Table rows={pg.rows} empty="No commissionable reservations in this period." cols={[
        { head: "Hotel", cell: (x) => <Link href={`/admin/hotels/${x.id}`}>{x.hotel_name}</Link> },
        { head: "Rate", right: true, cell: (x) => `${x.rate}%` },
        { head: "Bookings", right: true, cell: (x) => num(x.bookings) },
        { head: "Gross", right: true, cell: (x) => money(x.gross) },
        { head: "Commission", right: true, cell: (x) => money(x.commission) },
        { head: "Hotel payout", right: true, cell: (x) => money(x.payout) },
      ]} />
      <Pager base="/admin/reports/commissions" page={pg.page} pageSize={pg.pageSize} total={pg.total} params={sp} />
    </>
  );
}
