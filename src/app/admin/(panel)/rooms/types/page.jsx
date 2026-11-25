import Link from "next/link";
import { listRoomTypesAdmin } from "@/services/admin/rooms-overview";
import { listHotelOptions } from "@/services/admin/coupons";
import { Header, Table, Badge, Pager, Filters } from "@/components/admin/ui";
import { money, pageNum, pageSizeNum } from "@/lib/format";

export default async function RoomTypesPage({ searchParams }) {
  const sp = await searchParams;
  const [{ rows, total, page, pageSize }, hotels] = await Promise.all([
    listRoomTypesAdmin({ q: sp.q, hotel: sp.hotel, status: sp.status, page: pageNum(sp.page), pageSize: pageSizeNum(sp.pageSize) }), listHotelOptions(),
  ]);
  return (
    <>
      <Header title="Room types & rates" sub="A room type (e.g. Deluxe) groups physical rooms. Seasonal rate rules override the base price for specific nights."><Link className="adm-btn ghost" href="/admin/rooms">Physical rooms</Link>
        <Link className="adm-btn" href={sp.hotel ? `/admin/rooms/types/new?hotel=${encodeURIComponent(sp.hotel)}` : "/admin/rooms/types/new"}>Add room type</Link></Header>
      <Filters q={sp.q} status={sp.status} statuses={["active", "inactive"]} extra={
        <select name="hotel" defaultValue={sp.hotel ?? ""} aria-label="Hotel"><option value="">All hotels</option>{hotels.map((h) => <option key={h.id} value={h.id}>{h.hotel_name}</option>)}</select>} />
      <Table rows={rows} empty="No room types." cols={[
        { head: "Room type", cell: (t) => <b>{t.name}</b> }, { head: "Hotel", cell: (t) => t.hotel_name },
        { head: "Capacity", cell: (t) => `${t.max_adults} adults${t.max_children ? ` + ${t.max_children} children` : ""}` },
        { head: "Base price", right: true, cell: (t) => money(t.base_price, t.currency) },
        { head: "Rooms", right: true, cell: (t) => t.rooms }, { head: "Upcoming rate rules", right: true, cell: (t) => t.active_rules },
        { head: "Status", cell: (t) => <Badge v={t.status} /> },
        { head: "Actions", cell: (t) => (
          <div className="adm-inline">
            <Link className="adm-btn ghost sm" href={`/admin/rooms/types/${t.id}`}>Rates</Link>
            <Link className="adm-btn ghost sm" href={`/admin/hotels/${t.hotel_id}/room-types/${t.id}`}>Manage</Link>
          </div>) },
      ]} />
      <Pager base="/admin/rooms/types" page={page} pageSize={pageSize} total={total} params={sp} />
    </>
  );
}
