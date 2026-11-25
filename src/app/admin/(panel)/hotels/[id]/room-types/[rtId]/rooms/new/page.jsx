import { Header } from "@/components/admin/ui";
import RoomForm from "../../RoomForm";

export default async function NewRoom({ params }) {
  const { id, rtId } = await params;
  return (<><Header title="Add room" /><div className="adm-card"><RoomForm hotelId={id} roomTypeId={rtId} /></div></>);
}
