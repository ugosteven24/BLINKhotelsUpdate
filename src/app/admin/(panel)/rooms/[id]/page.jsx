import Link from "next/link";
import { notFound } from "next/navigation";
import { getRoomDetail, createBlockAction, releaseBlockAction } from "@/services/admin/rooms-overview";
import { Header, Table, Badge } from "@/components/admin/ui";
import QuickForm from "@/components/admin/QuickForm";
import { d, label } from "@/lib/format";

export default async function RoomDetail({ params }) {
  const { id } = await params;
  const data = await getRoomDetail(Number(id));
  if (!data) notFound();
  const { room, blocks, upcoming } = data;
  return (
    <>
      <Header title={`Room ${room.room_number}`} sub={`${room.hotel_name} · ${room.type_name}`}>
        <Badge v={room.operational_status} />
        <Link className="adm-btn ghost" href={`/admin/hotels/${room.hotel_id}/room-types/${room.room_type_id}/rooms/${room.id}/edit`}>Edit room</Link>
      </Header>

      <h2>Maintenance & blocked dates</h2>
      <Table rows={blocks} empty="No blocks for this room." cols={[
        { head: "From", cell: (b) => d(b.start_date) }, { head: "Returns to service", cell: (b) => d(b.end_date) },
        { head: "Reason", cell: (b) => label(b.reason) }, { head: "Notes", cell: (b) => b.notes ?? "—" },
        { head: "Status", cell: (b) => <Badge v={b.status} /> }, { head: "By", cell: (b) => b.created_by_name ?? "—" },
        { head: "", cell: (b) => b.status === "active" && (
          <QuickForm action={releaseBlockAction}><input type="hidden" name="id" value={b.id} /><button className="adm-btn ghost sm" data-confirm="Release this block?">Release</button></QuickForm>) },
      ]} />

      <div className="adm-card" style={{ marginTop: 18 }}>
        <h2>Block dates</h2>
        <p className="adm-sub">The room cannot be booked for these nights. Dates already held by a reservation are refused.</p>
        <QuickForm action={createBlockAction} className="adm-form">
          <input type="hidden" name="room_id" value={room.id} />
          <div className="adm-field"><label htmlFor="start_date">Start date</label><input id="start_date" name="start_date" type="date" required /></div>
          <div className="adm-field"><label htmlFor="end_date">Room returns to service on</label><input id="end_date" name="end_date" type="date" required /></div>
          <div className="adm-field"><label htmlFor="reason">Reason</label>
            <select id="reason" name="reason">{["maintenance", "owner_use", "renovation", "other"].map((r) => <option key={r} value={r}>{label(r)}</option>)}</select></div>
          <div className="adm-field"><label htmlFor="notes">Notes</label><input id="notes" name="notes" maxLength={500} /></div>
          <p><button className="adm-btn" data-confirm="Block these dates?">Block dates</button></p>
        </QuickForm>
      </div>

      <h2>Upcoming and active reservations</h2>
      <Table rows={upcoming} empty="Nothing booked for this room." cols={[
        { head: "Reservation", cell: (r) => <Link href={`/admin/reservations/${r.id}`}>{r.reservation_code}</Link> },
        { head: "Stay", cell: (r) => `${d(r.check_in)} → ${d(r.check_out)}` }, { head: "Status", cell: (r) => <Badge v={r.status} /> },
      ]} />
    </>
  );
}
