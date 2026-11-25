import { bookingReport } from "@/services/admin/reports";
import { Stat, Table, Badge, Bars } from "@/components/admin/ui";
import { money, num } from "@/lib/format";
import ReportHeader from "../ReportHeader";

export default async function Page({ searchParams }) {
  const sp = await searchParams;
  const r = await bookingReport(sp);
  return (
    <>
      <ReportHeader title="Booking Reports" sub="Reservations created in the selected period." from={r.from} to={r.to} />
      <div className="adm-grid">
        <Stat title="Reservations" value={num(r.summary.total)} />
        <Stat title="Average stay (nights)" value={Number(r.summary.avg_nights).toFixed(1)} />
        <Stat title="Average booking value" value={money(r.summary.avg_value)} />
      </div>
      <div className="adm-card"><h2>Reservations per day</h2><Bars data={r.daily.map((x) => ({ label: x.day.slice(5), value: Number(x.bookings) }))} /></div>
      <h2>By status</h2>
      <Table rows={r.byStatus} empty="No reservations in this period." cols={[
        { head: "Status", cell: (x) => <Badge v={x.status} /> }, { head: "Count", right: true, cell: (x) => num(x.count) }, { head: "Value", right: true, cell: (x) => money(x.amount) },
      ]} />
    </>
  );
}
