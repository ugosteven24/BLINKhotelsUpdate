import Link from "next/link";
import { customerReport } from "@/services/admin/reports";
import { Table, Stat, Pager } from "@/components/admin/ui";
import { money, num, paginate } from "@/lib/format";
import ReportHeader from "../ReportHeader";

export default async function Page({ searchParams }) {
  const sp = await searchParams;
  const r = await customerReport(sp);
  const pg = paginate(r.top, sp);
  return (
    <>
      <ReportHeader title="Customer Reports" sub="Sign-ups, active bookers and your highest-spending guests." from={r.from} to={r.to} search q={sp.q} />
      <div className="adm-grid">
        <Stat title="New customers" value={num(r.summary.new_customers)} />
        <Stat title="Customers who booked" value={num(r.summary.booking_customers)} />
        <Stat title="Repeat customers (all time)" value={num(r.summary.repeat_customers)} />
      </div>
      <h2>Top customers by spend</h2>
      <Table rows={pg.rows} empty="No confirmed bookings in this period." cols={[
        { head: "Customer", cell: (c) => <Link href={`/admin/users/${c.id}`}><b>{c.name}</b></Link> }, { head: "Email", cell: (c) => c.email },
        { head: "Bookings", right: true, cell: (c) => num(c.bookings) }, { head: "Spend", right: true, cell: (c) => money(c.spend) },
      ]} />
      <Pager base="/admin/reports/customers" page={pg.page} pageSize={pg.pageSize} total={pg.total} params={sp} />
    </>
  );
}
