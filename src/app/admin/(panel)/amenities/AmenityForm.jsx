import ActionForm, { Field } from "@/components/admin/ActionForm";
import SelectField from "@/components/admin/Select";
import { saveAmenityAction } from "@/services/admin/amenities";

export default function AmenityForm({ amenity }) {
  return (
    <ActionForm action={saveAmenityAction} submit={amenity ? "Save amenity" : "Create amenity"}>
      {amenity && <input type="hidden" name="id" value={amenity.id} />}
      <Field name="name" labelText="Name" defaultValue={amenity?.name} required hint="e.g. Free Wi-Fi" />
      <SelectField name="amenity_type" labelText="Applies to" defaultValue={amenity?.amenity_type ?? "both"}
        options={[{ value: "both", label: "Hotels and rooms" }, { value: "hotel", label: "Hotels only" }, { value: "room", label: "Rooms only" }]} />
      <Field name="icon_key" labelText="Icon key" defaultValue={amenity?.icon_key ?? ""} hint="Optional name your site maps to an icon, e.g. wifi." />
    </ActionForm>
  );
}
