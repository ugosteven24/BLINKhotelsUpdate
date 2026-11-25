import { Header } from "@/components/admin/ui";
import { listRoomAmenityOptions } from "@/services/admin/rooms-overview";
import RoomTypeForm from "../RoomTypeForm";

export default async function NewRoomType({ params }) {
  const { id } = await params;
  const amenities = await listRoomAmenityOptions();
  return (<><Header title="Add room type" /><div className="adm-card"><RoomTypeForm hotelId={id} amenities={amenities} /></div></>);
}
