import { paymentReport } from "@/services/admin/reports";
import { Table, Stat, Badge, Bars } from "@/components/admin/ui";
import { money, num } from "@/lib/format";
import ReportHeader from "../ReportHeader";

export default async function Page({ searchParams }) {
  const r = await paymentReport(await searchParams);
  const attempts = r.byStatus.reduce((a, x) => a + Number(x.count), 0);
  const ok = r.byStatus.find((x) => x.status === "successful")?.count ?? 0;
  return (
    <>
      <ReportHeader title="Payment Reports" sub="Payment attempts, success rate and refunds paid out." from={r.from} to={r.to} />
      <div className="adm-grid">
        <Stat title="Payment attempts" value={num(attempts)} />
        <Stat title="Success rate" value={attempts ? `${((Number(ok) / attempts) * 100).toFixed(1)}%` : "—"} />
        <Stat title="Refunds paid" value={`${num(r.refunds.count)} · ${money(r.refunds.amount)}`} />
      </div>
      <div className="adm-card"><h2>Money received per day</h2><Bars fmt={money} data={r.daily.map((x) => ({ label: x.day.slice(5), value: Number(x.amount) }))} /></div>
      <h2>By status</h2>
      <Table rows={r.byStatus} empty="No payments in this period." cols={[
        { head: "Status", cell: (x) => <Badge v={x.status} /> }, { head: "Count", right: true, cell: (x) => num(x.count) }, { head: "Amount", right: true, cell: (x) => money(x.amount) },
      ]} />
    </>
  );
}
