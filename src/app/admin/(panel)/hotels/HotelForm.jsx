import ActionForm, { Field } from "@/components/admin/ActionForm";
import SelectField from "@/components/admin/Select";
import { createHotelAction, updateHotelAction } from "@/services/admin/hotels";

const CATEGORIES = ["hotel", "guest_house", "resort", "apartment", "hostel", "other"].map((v) => ({ value: v, label: v.replace("_", " ").replace(/^\w/, (c) => c.toUpperCase()) }));

export default function HotelForm({ hotel, owners, amenities, amenityIds = [] }) {
  const editing = !!hotel;
  return (
    <ActionForm action={editing ? updateHotelAction : createHotelAction} submit={editing ? "Save hotel" : "Create hotel"}>
      {editing && <input type="hidden" name="id" value={hotel.id} />}
      <Field name="hotel_name" labelText="Hotel name" defaultValue={hotel?.hotel_name} required />
      <SelectField name="owner_id" labelText="Owner" defaultValue={hotel?.owner_id} placeholder="Choose an owner" required
        options={owners.map((o) => ({ value: o.id, label: o.label }))}
        hint="Only active users with the Hotel Owner role are listed." />
      <SelectField name="category" labelText="Type" defaultValue={hotel?.category ?? "hotel"} options={CATEGORIES} />
      <Field name="star_rating" labelText="Star rating" type="number" step="0.5" min="0" max="5" defaultValue={hotel?.star_rating ?? ""} />
      <Field name="email" labelText="Hotel email" type="email" defaultValue={hotel?.email ?? ""} />
      <Field name="phone" labelText="Hotel phone" defaultValue={hotel?.phone ?? ""} />
      <Field name="website" labelText="Website" type="url" defaultValue={hotel?.website ?? ""} full />
      <Field name="address_line1" labelText="Address line 1" defaultValue={hotel?.address_line1} required />
      <Field name="address_line2" labelText="Address line 2" defaultValue={hotel?.address_line2 ?? ""} />
      <Field name="city" labelText="City" defaultValue={hotel?.city} required />
      <Field name="state" labelText="State" defaultValue={hotel?.state} required />
      <Field name="country" labelText="Country" defaultValue={hotel?.country ?? "Nigeria"} required />
      <Field name="check_in_time" labelText="Check-in time" type="time" defaultValue={hotel?.check_in_time?.slice(0, 5) ?? "14:00"} required />
      <Field name="check_out_time" labelText="Check-out time" type="time" defaultValue={hotel?.check_out_time?.slice(0, 5) ?? "12:00"} required />
      <Field name="commission_rate" labelText="Commission rate (%)" type="number" step="0.01" min="0" max="100" defaultValue={hotel?.commission_rate ?? 10} required hint="Applies to new reservations only." />
      {!editing && (
        <SelectField name="approval_status" labelText="Initial status" defaultValue="pending"
          options={[{ value: "draft", label: "Draft" }, { value: "pending", label: "Pending review" }, { value: "approved", label: "Approved (live now)" }]} />
      )}
      <Field as="textarea" full name="description" labelText="Description" defaultValue={hotel?.description ?? ""} />
      <Field as="textarea" full name="cancellation_policy" labelText="Cancellation policy" defaultValue={hotel?.cancellation_policy ?? ""} />
      <div className="adm-field full">
        <label>Amenities</label>
        <div className="adm-inline" style={{ gap: "8px 22px" }}>
          {amenities.map((a) => (
            <label key={a.id} className="adm-inline" style={{ fontWeight: 500 }}>
              <input type="checkbox" name="amenities" value={a.id} defaultChecked={amenityIds.includes(a.id)} /> {a.name}
            </label>
          ))}
          {!amenities.length && <small>No amenities yet. Add some under Amenities.</small>}
        </div>
      </div>
      <div className="adm-field full"><label className="adm-inline"><input type="checkbox" name="is_featured" defaultChecked={!!hotel?.is_featured} /> Featured on the marketplace</label></div>
    </ActionForm>
  );
}
