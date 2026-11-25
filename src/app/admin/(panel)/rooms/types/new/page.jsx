import Link from "next/link";
import { listAllHotelOptions, listRoomAmenityOptions } from "@/services/admin/rooms-overview";
import { Header } from "@/components/admin/ui";
import RoomTypeForm from "@/app/admin/(panel)/hotels/[id]/room-types/RoomTypeForm";

export default async function NewRoomTypePage({ searchParams }) {
  const sp = await searchParams;
  const [hotels, amenities] = await Promise.all([listAllHotelOptions(), listRoomAmenityOptions()]);
  return (
    <>
      <Header title="Add room type" sub="A room type (e.g. Deluxe King) sets the price and capacity. Add the physical rooms to it afterwards.">
        <Link className="adm-btn ghost" href="/admin/rooms/types">Back to room types</Link>
      </Header>
      {hotels.length === 0 ? (
        <div className="adm-card">
          <p>There are no hotels yet. Add a hotel first, then create its room types.</p>
          <p><Link className="adm-btn" href="/admin/hotels/new">Add a hotel</Link></p>
        </div>
      ) : (
        <div className="adm-card"><RoomTypeForm hotels={hotels} hotelId={sp.hotel ?? ""} amenities={amenities} /></div>
      )}
    </>
  );
}
