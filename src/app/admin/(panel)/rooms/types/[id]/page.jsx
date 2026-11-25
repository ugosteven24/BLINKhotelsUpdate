import Link from "next/link";
import { notFound } from "next/navigation";
import { getRoomTypeRates, saveRateRuleAction, deleteRateRuleAction } from "@/services/admin/rooms-overview";
import { Header, Table } from "@/components/admin/ui";
import QuickForm from "@/components/admin/QuickForm";
import DeleteButton from "@/components/admin/DeleteButton";
import { money, d } from "@/lib/format";

export default async function RateRules({ params }) {
  const { id } = await params;
  const data = await getRoomTypeRates(Number(id));
  if (!data) notFound();
  const { type, rules } = data;
  return (
    <>
      <Header title={`${type.name} · rates`} sub={`${type.hotel_name} · base price ${money(type.base_price, type.currency)} per night`}>
        <Link className="adm-btn ghost" href="/admin/rooms/types">Back</Link>
      </Header>
      <p className="adm-sub">A rule prices every night from the start date up to (not including) the end date. If rules overlap, the higher priority wins. Existing reservations keep the price they were booked at.</p>
      <Table rows={rules} empty="No special rates - the base price always applies." cols={[
        { head: "From", cell: (r) => d(r.start_date) }, { head: "Until (excl.)", cell: (r) => d(r.end_date) },
        { head: "Nightly rate", right: true, cell: (r) => money(r.nightly_rate, r.currency) }, { head: "Priority", right: true, cell: (r) => r.priority },
        { head: "", cell: (r) => <DeleteButton action={deleteRateRuleAction} args={[r.id]} title="Remove this rate rule?" text="Future bookings will use the next rule or the base price." confirmText="Yes, remove" /> },
      ]} />
      <div className="adm-card" style={{ marginTop: 18 }}>
        <h2>Add a rate rule</h2>
        <QuickForm action={saveRateRuleAction} className="adm-form">
          <input type="hidden" name="room_type_id" value={type.id} />
          <div className="adm-field"><label htmlFor="start_date">Start date</label><input id="start_date" name="start_date" type="date" required /></div>
          <div className="adm-field"><label htmlFor="end_date">End date (excl.)</label><input id="end_date" name="end_date" type="date" required /></div>
          <div className="adm-field"><label htmlFor="nightly_rate">Nightly rate ({type.currency})</label><input id="nightly_rate" name="nightly_rate" type="number" step="0.01" min="0" required /></div>
          <div className="adm-field"><label htmlFor="priority">Priority</label><input id="priority" name="priority" type="number" min="0" max="1000" defaultValue="0" /></div>
          <p><button className="adm-btn" data-confirm="Add this rate rule?">Add rule</button></p>
        </QuickForm>
      </div>
    </>
  );
}
