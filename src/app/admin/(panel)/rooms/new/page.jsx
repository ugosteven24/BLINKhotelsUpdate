import Link from "next/link";
import { listRoomFormOptions } from "@/services/admin/rooms-overview";
import { Header } from "@/components/admin/ui";
import NewRoomForm from "./NewRoomForm";

export default async function NewRoomPage({ searchParams }) {
  const sp = await searchParams;
  const { hotels, types } = await listRoomFormOptions();
  return (
    <>
      <Header title="Add room" sub="A physical room (e.g. Room 101) that belongs to one hotel and one room type.">
        <Link className="adm-btn ghost" href="/admin/rooms">Back to rooms</Link>
      </Header>
      {hotels.length === 0 ? (
        <div className="adm-card">
          <p>No hotel has a room type yet. Create a room type first, then you can add rooms to it.</p>
          <p><Link className="adm-btn" href="/admin/rooms/types/new">Add a room type</Link></p>
        </div>
      ) : (
        <div className="adm-card">
          <NewRoomForm hotels={hotels} types={types} defaultHotel={sp.hotel ?? ""} defaultType={sp.type ?? ""} />
        </div>
      )}
    </>
  );
}
