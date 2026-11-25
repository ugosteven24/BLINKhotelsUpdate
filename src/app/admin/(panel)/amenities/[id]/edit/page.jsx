import { notFound } from "next/navigation";
import { getAmenity } from "@/services/admin/amenities";
import { Header } from "@/components/admin/ui";
import AmenityForm from "../../AmenityForm";

export default async function EditAmenity({ params }) {
  const { id } = await params;
  const a = await getAmenity(Number(id));
  if (!a) notFound();
  return (<><Header title={`Edit ${a.name}`} /><div className="adm-card"><AmenityForm amenity={a} /></div></>);
}
