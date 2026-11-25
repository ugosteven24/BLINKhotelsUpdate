import { listHotelOptions } from "@/services/admin/coupons";
import { Header } from "@/components/admin/ui";
import CouponForm from "../CouponForm";

export default async function NewCoupon() {
  const hotels = await listHotelOptions();
  return (<><Header title="Create coupon" /><div className="adm-card"><CouponForm hotels={hotels} /></div></>);
}
