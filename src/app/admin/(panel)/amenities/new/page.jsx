import { Header } from "@/components/admin/ui";
import AmenityForm from "../AmenityForm";

export default function NewAmenity() {
  return (<><Header title="Add amenity" /><div className="adm-card"><AmenityForm /></div></>);
}
