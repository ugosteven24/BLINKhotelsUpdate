import { notFound } from "next/navigation";
import { getRoomType } from "@/services/admin/rooms";
import { listRoomAmenityOptions } from "@/services/admin/rooms-overview";
import { Header } from "@/components/admin/ui";
import RoomTypeForm from "../../RoomTypeForm";

export default async function EditRoomType({ params }) {
  const { id, rtId } = await params;
  const [data, amenities] = await Promise.all([getRoomType(Number(id), Number(rtId)), listRoomAmenityOptions()]);
  if (!data) notFound();
  return (<><Header title={`Edit ${data.roomType.name}`} sub={data.roomType.hotel_name} /><div className="adm-card"><RoomTypeForm hotelId={id} roomType={data.roomType} amenities={amenities} amenityIds={data.amenityIds} /></div></>);
}
