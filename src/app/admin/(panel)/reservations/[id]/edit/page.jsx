import { notFound } from "next/navigation";
import { getReservation, updateReservationAction } from "@/services/admin/reservations";
import ActionForm, { Field } from "@/components/admin/ActionForm";
import { Header } from "@/components/admin/ui";

export default async function EditReservation({ params }) {
  const { id } = await params;
  const data = await getReservation(Number(id));
  if (!data) notFound();
  const r = data.reservation;
  return (
    <>
      <Header title={`Edit ${r.reservation_code}`} sub="Dates, rooms and prices can't be edited because they control availability and money. Cancel and rebook instead." />
      <div className="adm-card">
        <ActionForm action={updateReservationAction} submit="Save reservation">
          <input type="hidden" name="id" value={r.id} />
          <Field name="adults" labelText="Adults" type="number" min="1" defaultValue={r.adults} required />
          <Field name="children" labelText="Children" type="number" min="0" defaultValue={r.children} />
          <Field as="textarea" full name="special_requests" labelText="Special requests" defaultValue={r.special_requests ?? ""} />
        </ActionForm>
      </div>
    </>
  );
}
