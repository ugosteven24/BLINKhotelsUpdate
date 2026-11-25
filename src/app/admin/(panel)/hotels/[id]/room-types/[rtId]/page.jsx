import Link from "next/link";
import { notFound } from "next/navigation";
import { getRoomType, deleteRoomTypeAction, deleteRoomAction } from "@/services/admin/rooms";
import { Header, Table, Badge } from "@/components/admin/ui";
import DeleteButton from "@/components/admin/DeleteButton";
import RowActions from "@/components/admin/RowActions";
import { money } from "@/lib/format";

export default async function RoomTypeView({ params }) {
  const { id, rtId } = await params;
  const data = await getRoomType(Number(id), Number(rtId));
  if (!data) notFound();
  const { roomType: rt, rooms, amenities } = data;
  const base = `/admin/hotels/${id}/room-types/${rt.id}`;
  return (
    <>
      <Header title={rt.name} sub={<Link href={`/admin/hotels/${id}`}>{rt.hotel_name}</Link>}>
        <Badge v={rt.status} />
        <Link className="adm-btn ghost" href={`${base}/edit`}>Edit</Link>
        <DeleteButton action={deleteRoomTypeAction} args={[rt.id]} redirectTo={`/admin/hotels/${id}`} className="adm-btn danger"
          title={`Delete ${rt.name}?`} text="Delete its rooms first. Room types guests have booked can't be deleted." />
      </Header>
      <div className="adm-card">
        <dl className="adm-dl">
          <dt>Base price</dt><dd>{money(rt.base_price, rt.currency)} per night</dd>
          <dt>Capacity</dt><dd>{rt.max_adults} adults, {rt.max_children ?? 0} children</dd>
          <dt>Beds</dt><dd>{rt.bed_configuration || "—"}</dd>
          <dt>Size</dt><dd>{rt.room_size_sqm ? `${rt.room_size_sqm} m²` : "—"}</dd>
          <dt>Amenities</dt><dd>{amenities.map((a) => a.name).join(", ") || "—"}</dd>
          <dt>Description</dt><dd>{rt.description || "—"}</dd>
        </dl>
      </div>
      <div className="adm-head" style={{ border: 0, paddingBottom: 0, marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Rooms ({rooms.length})</h2>
        <Link className="adm-btn sm" href={`${base}/rooms/new`}>Add room</Link>
      </div>
      <Table rows={rooms} empty="No rooms yet. Add the physical rooms guests can be assigned." cols={[
        { head: "Room", cell: (r) => <b>{r.room_number}</b> },
        { head: "Floor", cell: (r) => r.floor_number ?? "—" },
        { head: "Status", cell: (r) => <Badge v={r.operational_status} /> },
        { head: "Bookings", right: true, cell: (r) => r.bookings },
        { head: "Notes", cell: (r) => r.notes ?? "—" },
        { head: "Actions", cell: (r) => (
          <RowActions edit={`${base}/rooms/${r.id}/edit`}
            del={{ action: deleteRoomAction, args: [r.id], title: `Delete room ${r.room_number}?`, text: "Rooms with booking history can't be deleted; set them to Out of service instead." }} />) },
      ]} />
    </>
  );
}
