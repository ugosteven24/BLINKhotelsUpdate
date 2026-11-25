import { listOwnerOptions, listAmenityOptions } from "@/services/admin/hotels";
import { Header } from "@/components/admin/ui";
import HotelForm from "../HotelForm";

export default async function NewHotel() {
  const [owners, amenities] = await Promise.all([listOwnerOptions(), listAmenityOptions()]);
  return (
    <>
      <Header title="Add hotel" sub="Create a listing on behalf of an owner. Add room types and rooms after saving." />
      <div className="adm-card"><HotelForm owners={owners} amenities={amenities} /></div>
    </>
  );
}
