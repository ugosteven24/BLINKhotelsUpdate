import { notFound } from "next/navigation";
import { getCoupon, listHotelOptions } from "@/services/admin/coupons";
import { Header } from "@/components/admin/ui";
import CouponForm from "../../CouponForm";

export default async function EditCoupon({ params }) {
  const { id } = await params;
  const [coupon, hotels] = await Promise.all([getCoupon(Number(id)), listHotelOptions()]);
  if (!coupon) notFound();
  return (<><Header title={`Edit ${coupon.code}`} sub={`Used ${coupon.used_count} time${coupon.used_count === 1 ? "" : "s"}`} /><div className="adm-card"><CouponForm coupon={coupon} hotels={hotels} /></div></>);
}
