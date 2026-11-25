"use client";

import { useState, useMemo } from "react";
import ActionForm, { Field } from "@/components/admin/ActionForm";
import SelectField from "@/components/admin/Select";
import { saveRoomAction } from "@/services/admin/rooms";

// Hotel -> room type are dependent: only the chosen hotel's room types are offered.
export default function NewRoomForm({ hotels, types, defaultHotel = "", defaultType = "" }) {
  const [hotel, setHotel] = useState(String(defaultHotel));
  const options = useMemo(() => types.filter((t) => String(t.hotel_id) === hotel), [types, hotel]);
  const initialType = options.some((t) => String(t.id) === String(defaultType)) ? String(defaultType) : "";

  return (
    <ActionForm action={saveRoomAction} submit="Add room">
      <input type="hidden" name="return_to" value="rooms" />
      <div className="adm-field">
        <label htmlFor="hotel_id">Hotel</label>
        <select id="hotel_id" name="hotel_id" value={hotel} onChange={(e) => setHotel(e.target.value)} required>
          <option value="">Select a hotel</option>
          {hotels.map((h) => <option key={h.id} value={h.id}>{h.hotel_name}</option>)}
        </select>
      </div>
      {/* key resets the dropdown whenever the hotel changes */}
      <div className="adm-field" key={hotel}>
        <label htmlFor="room_type_id">Room type</label>
        <select id="room_type_id" name="room_type_id" defaultValue={initialType} required disabled={!hotel}>
          <option value="">{hotel ? "Select a room type" : "Choose a hotel first"}</option>
          {options.map((t) => <option key={t.id} value={t.id}>{t.name}{t.status === "inactive" ? " (inactive)" : ""}</option>)}
        </select>
      </div>
      <Field name="room_number" labelText="Room number" placeholder="e.g. 101" required maxLength={50} />
      <Field name="floor_number" labelText="Floor" placeholder="Optional" maxLength={30} />
      <SelectField name="operational_status" labelText="Status" defaultValue="active"
        options={[{ value: "active", label: "Active" }, { value: "maintenance", label: "Maintenance" }, { value: "out_of_service", label: "Out of service" }]} />
      <Field as="textarea" full name="notes" labelText="Notes" maxLength={500} />
    </ActionForm>
  );
}
