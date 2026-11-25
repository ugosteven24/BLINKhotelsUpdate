import ActionForm, { Field } from "@/components/admin/ActionForm";
import { saveCouponAction } from "@/services/admin/coupons";

const local = (s) => (s ? s.replace(" ", "T").slice(0, 16) : "");

export default function CouponForm({ coupon, hotels }) {
  return (
    <ActionForm action={saveCouponAction} submit={coupon ? "Save coupon" : "Create coupon"}>
      {coupon && <input type="hidden" name="id" value={coupon.id} />}
      <Field name="code" labelText="Code" defaultValue={coupon?.code} required hint="Guests type this at checkout. Letters, numbers, - and _." />
      <Field name="title" labelText="Title" defaultValue={coupon?.title} required />
      <div className="adm-field"><label htmlFor="discount_type">Discount type</label>
        <select id="discount_type" name="discount_type" defaultValue={coupon?.discount_type ?? "percentage"}><option value="percentage">Percentage</option><option value="fixed">Fixed amount</option></select></div>
      <Field name="discount_value" labelText="Discount value" type="number" step="0.01" min="0.01" defaultValue={coupon?.discount_value} required />
      <Field name="max_discount_amount" labelText="Maximum discount" type="number" step="0.01" defaultValue={coupon?.max_discount_amount ?? ""} hint="Optional cap for percentage coupons." />
      <Field name="min_booking_amount" labelText="Minimum booking amount" type="number" step="0.01" min="0" defaultValue={coupon?.min_booking_amount ?? 0} />
      <div className="adm-field"><label htmlFor="hotel_id">Applies to</label>
        <select id="hotel_id" name="hotel_id" defaultValue={coupon?.hotel_id ?? ""}><option value="">All hotels</option>{hotels.map((h) => <option key={h.id} value={h.id}>{h.hotel_name}</option>)}</select></div>
      <Field name="usage_limit" labelText="Total uses" type="number" min="1" defaultValue={coupon?.usage_limit ?? ""} hint="Leave empty for unlimited." />
      <Field name="per_user_limit" labelText="Uses per guest" type="number" min="1" defaultValue={coupon?.per_user_limit ?? 1} />
      <Field name="starts_at" labelText="Starts" type="datetime-local" defaultValue={local(coupon?.starts_at)} required />
      <Field name="expires_at" labelText="Ends" type="datetime-local" defaultValue={local(coupon?.expires_at)} required />
      <div className="adm-field"><label htmlFor="status">Status</label>
        <select id="status" name="status" defaultValue={coupon?.status === "inactive" ? "inactive" : "active"}><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
      <Field as="textarea" full name="description" labelText="Description" defaultValue={coupon?.description ?? ""} />
    </ActionForm>
  );
}
