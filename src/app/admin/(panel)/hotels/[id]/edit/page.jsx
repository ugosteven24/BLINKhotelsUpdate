import { notFound } from "next/navigation";
import { getHotelForEdit, listOwnerOptions, listAmenityOptions } from "@/services/admin/hotels";
import { Header } from "@/components/admin/ui";
import HotelForm from "../../HotelForm";

export default async function EditHotel({ params }) {
  const { id } = await params;
  const [data, owners, amenities] = await Promise.all([getHotelForEdit(Number(id)), listOwnerOptions(), listAmenityOptions()]);
  if (!data) notFound();
  const { hotel, amenityIds } = data;
  // Keep the current owner selectable even if they're no longer an active owner.
  const ownerList = owners.some((o) => o.id === hotel.owner_id) ? owners : [{ id: hotel.owner_id, label: `Current owner (#${hotel.owner_id})` }, ...owners];
  return (
    <>
      <Header title={`Edit ${hotel.hotel_name}`} sub="Approval status is changed from the hotel page using Review." />
      <div className="adm-card"><HotelForm hotel={hotel} owners={ownerList} amenities={amenities} amenityIds={amenityIds} /></div>
    </>
  );
}
