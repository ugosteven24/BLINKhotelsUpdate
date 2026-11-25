import ActionForm, { Field } from "@/components/admin/ActionForm";
import SelectField from "@/components/admin/Select";
import { saveRoomAction } from "@/services/admin/rooms";

export default function RoomForm({ hotelId, roomTypeId, room }) {
  return (
    <ActionForm action={saveRoomAction} submit={room ? "Save room" : "Add room"}>
      <input type="hidden" name="hotel_id" value={hotelId} />
      <input type="hidden" name="room_type_id" value={roomTypeId} />
      {room && <input type="hidden" name="id" value={room.id} />}
      <Field name="room_number" labelText="Room number" defaultValue={room?.room_number} required />
      <Field name="floor_number" labelText="Floor" defaultValue={room?.floor_number ?? ""} />
      <SelectField name="operational_status" labelText="Status" defaultValue={room?.operational_status ?? "active"}
        options={[{ value: "active", label: "Active" }, { value: "maintenance", label: "Maintenance" }, { value: "out_of_service", label: "Out of service" }]} />
      <Field as="textarea" full name="notes" labelText="Notes" defaultValue={room?.notes ?? ""} />
    </ActionForm>
  );
}
