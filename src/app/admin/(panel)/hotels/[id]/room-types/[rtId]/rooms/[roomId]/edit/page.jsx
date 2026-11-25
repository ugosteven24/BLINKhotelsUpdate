import { notFound } from "next/navigation";
import { getRoom } from "@/services/admin/rooms";
import { Header } from "@/components/admin/ui";
import RoomForm from "../../../RoomForm";

export default async function EditRoom({ params }) {
  const { id, rtId, roomId } = await params;
  const room = await getRoom(Number(roomId));
  if (!room || String(room.hotel_id) !== id) notFound();
  return (<><Header title={`Edit room ${room.room_number}`} /><div className="adm-card"><RoomForm hotelId={id} roomTypeId={rtId} room={room} /></div></>);
}
