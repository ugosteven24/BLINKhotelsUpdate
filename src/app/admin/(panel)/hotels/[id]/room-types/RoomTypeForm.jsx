import ActionForm, { Field } from "@/components/admin/ActionForm";
import SelectField from "@/components/admin/Select";
import { saveRoomTypeAction } from "@/services/admin/rooms";

// Pass `hotels` (and optionally `hotelId` as the preselected one) to let the admin choose the hotel; otherwise hotelId is fixed.
export default function RoomTypeForm({ hotelId, roomType, hotels, amenities = [], amenityIds = [] }) {
  return (
    <ActionForm action={saveRoomTypeAction} submit={roomType ? "Save room type" : "Create room type"}>
      {hotels ? (
        <SelectField name="hotel_id" labelText="Hotel" defaultValue={hotelId ?? ""} required placeholder="Select a hotel"
          options={hotels.map((h) => ({ value: h.id, label: h.hotel_name }))} />
      ) : (
        <input type="hidden" name="hotel_id" value={hotelId} />
      )}
      {roomType && <input type="hidden" name="id" value={roomType.id} />}
      <Field name="name" labelText="Name" defaultValue={roomType?.name} required hint="e.g. Deluxe King" />
      <Field name="bed_configuration" labelText="Beds" defaultValue={roomType?.bed_configuration ?? ""} hint="e.g. 1 king bed" />
      <Field name="base_price" labelText="Base price per night" type="number" step="0.01" min="0" defaultValue={roomType?.base_price} required />
      <Field name="currency" labelText="Currency" maxLength={3} defaultValue={roomType?.currency ?? "NGN"} required />
      <Field name="max_adults" labelText="Max adults" type="number" min="1" defaultValue={roomType?.max_adults ?? 2} required />
      <Field name="max_children" labelText="Max children" type="number" min="0" defaultValue={roomType?.max_children ?? 0} />
      <Field name="room_size_sqm" labelText="Room size (m²)" type="number" step="0.01" min="0" defaultValue={roomType?.room_size_sqm ?? ""} />
      <SelectField name="status" labelText="Status" defaultValue={roomType?.status ?? "active"} options={[{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} />
      <Field as="textarea" full name="description" labelText="Description" defaultValue={roomType?.description ?? ""} />
      <div className="adm-field full">
        <label>Room amenities</label>
        <div className="adm-inline" style={{ gap: "8px 22px" }}>
          {amenities.map((a) => (
            <label key={a.id} className="adm-inline" style={{ fontWeight: 500 }}>
              <input type="checkbox" name="amenities" value={a.id} defaultChecked={amenityIds.includes(a.id)} /> {a.name}
            </label>
          ))}
          {!amenities.length && <small>No room amenities yet. Add some under Amenities (type "Room" or "Both").</small>}
        </div>
      </div>
    </ActionForm>
  );
}
