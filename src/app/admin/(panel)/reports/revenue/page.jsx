import { revenueReport } from "@/services/admin/reports";
import { Stat, Bars } from "@/components/admin/ui";
import { money } from "@/lib/format";
import ReportHeader from "../ReportHeader";

export default async function Page({ searchParams }) {
  const r = await revenueReport(await searchParams);
  const t = r.totals;
  return (
    <>
      <ReportHeader title="Revenue Reports" sub="Approved, checked-in and completed reservations only." from={r.from} to={r.to} />
      <div className="adm-grid">
        <Stat title="Gross booking value" value={money(t.gross)} />
        <Stat title="Platform commission" value={money(t.commission)} />
        <Stat title="Owed to hotels" value={money(t.hotel_share)} />
        <Stat title="Taxes collected" value={money(t.taxes)} />
        <Stat title="Fees" value={money(t.fees)} />
        <Stat title="Discounts given" value={money(t.discounts)} />
      </div>
      <div className="adm-two">
        <div className="adm-card"><h2>Gross per day</h2><Bars fmt={money} data={r.daily.map((x) => ({ label: x.day.slice(5), value: Number(x.gross) }))} /></div>
        <div className="adm-card"><h2>Commission per day</h2><Bars fmt={money} data={r.daily.map((x) => ({ label: x.day.slice(5), value: Number(x.commission) }))} /></div>
      </div>
    </>
  );
}
