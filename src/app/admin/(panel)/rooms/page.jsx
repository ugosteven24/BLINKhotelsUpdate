import Link from "next/link";
import { listRoomsAdmin, listRoomTypeOptions } from "@/services/admin/rooms-overview";
import { listHotelOptions } from "@/services/admin/coupons";
import { Header, Table, Badge, Pager, Filters } from "@/components/admin/ui";
import { pageNum, pageSizeNum } from "@/lib/format";

const today = (r) => (r.operational_status !== "active" ? r.operational_status : Number(r.blocked_today) ? "blocked" : Number(r.booked_today) ? "booked" : "available");
const TONE = { available: "ok", booked: "info", blocked: "bad", maintenance: "warn", out_of_service: "bad" };

export default async function RoomsPage({ searchParams }) {
  const sp = await searchParams;
  const [{ rows, total, page, pageSize }, hotels, types] = await Promise.all([
    listRoomsAdmin({ q: sp.q, hotel: sp.hotel, type: sp.type, status: sp.status, page: pageNum(sp.page), pageSize: pageSizeNum(sp.pageSize) }),
    listHotelOptions(), listRoomTypeOptions(sp.hotel),
  ]);
  return (
    <>
      <Header title="Rooms" sub="Physical rooms (Room 101), not room types (Deluxe). 'Today' is computed from live reservations and blocks - it is information, not a booking guarantee.">
        <Link className="adm-btn ghost" href="/admin/rooms/types">Room types & rates</Link>
        <Link className="adm-btn" href={sp.hotel ? `/admin/rooms/new?hotel=${encodeURIComponent(sp.hotel)}` : "/admin/rooms/new"}>Add room</Link>
      </Header>
      <Filters q={sp.q} status={sp.status} statuses={["active", "maintenance", "out_of_service"]} extra={<>
        <select name="hotel" defaultValue={sp.hotel ?? ""} aria-label="Hotel"><option value="">All hotels</option>{hotels.map((h) => <option key={h.id} value={h.id}>{h.hotel_name}</option>)}</select>
        <select name="type" defaultValue={sp.type ?? ""} aria-label="Room type"><option value="">All room types</option>{types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></>} />
      <Table rows={rows} empty="No rooms match these filters." cols={[
        { head: "Room", cell: (r) => <Link href={`/admin/rooms/${r.id}`}><b>{r.room_number}</b></Link> },
        { head: "Hotel", cell: (r) => r.hotel_name }, { head: "Room type", cell: (r) => r.type_name }, { head: "Floor", cell: (r) => r.floor_number ?? "—" },
        { head: "Operational", cell: (r) => <Badge v={r.operational_status} /> },
        { head: "Today", cell: (r) => <span className={`adm-badge ${TONE[today(r)] ?? ""}`}>{today(r).replace("_", " ")}</span> },
        { head: "Actions", cell: (r) => (
          <div className="adm-inline">
            <Link className="adm-btn ghost sm" href={`/admin/rooms/${r.id}`}>Blocks</Link>
            <Link className="adm-btn ghost sm" href={`/admin/hotels/${r.hotel_id}/room-types/${r.room_type_id}/rooms/${r.id}/edit`}>Edit</Link>
          </div>) },
      ]} />
      <Pager base="/admin/rooms" page={page} pageSize={pageSize} total={total} params={sp} />
    </>
  );
}
