import Link from "next/link";
import { notFound } from "next/navigation";
import { getHotel, hotelDecisionAction, updateHotelCommercialAction, deleteHotelAction } from "@/services/admin/hotels";
import { deleteRoomTypeAction } from "@/services/admin/rooms";
import DeleteButton from "@/components/admin/DeleteButton";
import RowActions from "@/components/admin/RowActions";
import { Header, Table, Badge, Stat } from "@/components/admin/ui";
import { money, num, label, dt } from "@/lib/format";

export default async function HotelDetail({ params }) {
  const { id } = await params;
  const data = await getHotel(Number(id));
  if (!data) notFound();
  const { hotel: h, roomTypes, amenities, stats, counts } = data;
  const status = h.approval_status;
  return (
    <>
      <Header title={h.hotel_name} sub={`${h.address_line1}, ${h.city}, ${h.state}`}>
        <Badge v={status} />
        <Link className="adm-btn ghost" href={`/admin/hotels/${h.id}/images`}>Photos ({counts.images})</Link>
        <Link className="adm-btn ghost" href={`/admin/hotels/${h.id}/staff`}>Staff ({counts.staff})</Link>
        <Link className="adm-btn ghost" href={`/admin/hotels/${h.id}/edit`}>Edit</Link>
        <DeleteButton action={deleteHotelAction} args={[h.id]} redirectTo="/admin/hotels" className="adm-btn danger"
          title={`Delete ${h.hotel_name}?`} text="Its rooms and room types are deleted too. Hotels with reservations can't be deleted; suspend them instead." />
      </Header>
      <div className="adm-grid">
        <Stat title="Confirmed reservations" value={num(stats.reservations)} />
        <Stat title="Revenue" value={money(stats.revenue)} />
        <Stat title="Commission" value={money(stats.commission)} />
      </div>
      <div className="adm-two">
        <div className="adm-card">
          <h2>Listing</h2>
          {h.cover_image && (/* eslint-disable-next-line @next/next/no-img-element */
            <img className="adm-hero" src={h.cover_image} alt={`${h.hotel_name} cover`} />)}
          <dl className="adm-dl">
            <dt>Owner</dt><dd><Link href={`/admin/users/${h.owner_id}`}>{h.owner_name}</Link> · {h.owner_email}</dd>
            <dt>Type</dt><dd>{label(h.category)}{h.star_rating ? ` · ${h.star_rating} stars` : ""}</dd>
            <dt>Contact</dt><dd>{[h.email, h.phone, h.website].filter(Boolean).join(" · ") || "—"}</dd>
            <dt>Check-in / out</dt><dd>{h.check_in_time?.slice(0, 5)} / {h.check_out_time?.slice(0, 5)}</dd>
            <dt>Amenities</dt><dd>{amenities.map((a) => a.name).join(", ") || "—"}</dd>
            <dt>Cancellation</dt><dd>{h.cancellation_policy || "—"}</dd>
            <dt>Description</dt><dd>{h.description || "—"}</dd>
            {h.rejection_reason && (<><dt>Last reason</dt><dd>{h.rejection_reason}</dd></>)}
            <dt>Last reviewed</dt><dd>{dt(h.approved_at)}</dd>
          </dl>
        </div>
        <div>
          <div className="adm-card">
            <h2>Review</h2>
            <form action={hotelDecisionAction}>
              <input type="hidden" name="id" value={h.id} />
              <div className="adm-field"><label htmlFor="reason">Reason</label>
                <textarea id="reason" name="reason" rows={2} placeholder="Required to reject or suspend" /></div>
              <p className="adm-inline">
                {(status === "pending" || status === "draft" || status === "rejected") && <button className="adm-btn sm" name="decision" value="approve">Approve</button>}
                {status === "pending" && <button className="adm-btn danger sm" name="decision" value="reject" data-confirm="Reject this hotel?">Reject</button>}
                {status === "approved" && <button className="adm-btn danger sm" name="decision" value="suspend" data-confirm="Suspend this hotel? It will disappear from search.">Suspend</button>}
                {status === "suspended" && <button className="adm-btn sm" name="decision" value="reinstate">Reinstate</button>}
              </p>
            </form>
          </div>
          <div className="adm-card">
            <h2>Commercial terms</h2>
            <form action={updateHotelCommercialAction}>
              <input type="hidden" name="id" value={h.id} />
              <div className="adm-field"><label htmlFor="commission_rate">Commission rate (%)</label>
                <input id="commission_rate" name="commission_rate" type="number" step="0.01" min="0" max="100" defaultValue={h.commission_rate} />
                <small>Applies to new reservations only.</small></div>
              <p><label className="adm-inline"><input type="checkbox" name="is_featured" defaultChecked={!!h.is_featured} /> Featured on the marketplace</label></p>
              <button className="adm-btn sm">Save terms</button>
            </form>
          </div>
        </div>
      </div>
      <div className="adm-head" style={{ border: 0, paddingBottom: 0, marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Room types</h2>
        <Link className="adm-btn sm" href={`/admin/hotels/${h.id}/room-types/new`}>Add room type</Link>
      </div>
      <Table rows={roomTypes} empty="No room types yet. Add one so guests can book." cols={[
        { head: "Name", cell: (r) => <Link href={`/admin/hotels/${h.id}/room-types/${r.id}`}><b>{r.name}</b></Link> },
        { head: "Rooms", right: true, cell: (r) => r.rooms },
        { head: "Base price", right: true, cell: (r) => money(r.base_price, r.currency) },
        { head: "Status", cell: (r) => <Badge v={r.status} /> },
        { head: "Actions", cell: (r) => (
          <RowActions view={`/admin/hotels/${h.id}/room-types/${r.id}`} edit={`/admin/hotels/${h.id}/room-types/${r.id}/edit`}
            del={{ action: deleteRoomTypeAction, args: [r.id], title: `Delete ${r.name}?`, text: "Delete its rooms first. Room types guests have booked can't be deleted." }} />) },
      ]} />
    </>
  );
}
