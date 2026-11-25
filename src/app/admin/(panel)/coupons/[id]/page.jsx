import Link from "next/link";
import { notFound } from "next/navigation";
import { getCouponDetail, deleteCouponAction } from "@/services/admin/coupons";
import { Header, Table, Badge } from "@/components/admin/ui";
import DeleteButton from "@/components/admin/DeleteButton";
import { money, dt } from "@/lib/format";

export default async function CouponView({ params }) {
  const { id } = await params;
  const data = await getCouponDetail(Number(id));
  if (!data) notFound();
  const { coupon: c, redemptions } = data;
  return (
    <>
      <Header title={c.code} sub={c.title}>
        <Badge v={c.effective_status} />
        <Link className="adm-btn ghost" href={`/admin/coupons/${c.id}/edit`}>Edit</Link>
        <DeleteButton action={deleteCouponAction} args={[c.id]} redirectTo="/admin/coupons" className="adm-btn danger"
          title={`Delete ${c.code}?`} text="A coupon that has been used is deactivated instead, so redemption history is kept." />
      </Header>
      <div className="adm-card">
        <dl className="adm-dl">
          <dt>Discount</dt><dd>{c.discount_type === "percentage" ? `${c.discount_value}%` : money(c.discount_value)}{c.max_discount_amount ? `, up to ${money(c.max_discount_amount)}` : ""}</dd>
          <dt>Minimum booking</dt><dd>{money(c.min_booking_amount)}</dd>
          <dt>Applies to</dt><dd>{c.hotel_name ?? "All hotels"}</dd>
          <dt>Usage</dt><dd>{c.used_count}{c.usage_limit ? ` of ${c.usage_limit}` : " (no limit)"} · {c.per_user_limit} per guest</dd>
          <dt>Valid</dt><dd>{dt(c.starts_at)} to {dt(c.expires_at)}</dd>
          <dt>Description</dt><dd>{c.description || "—"}</dd>
        </dl>
      </div>
      <h2>Redemptions</h2>
      <Table rows={redemptions} empty="Nobody has used this coupon yet." cols={[
        { head: "When", cell: (r) => dt(r.created_at) },
        { head: "Guest", cell: (r) => <Link href={`/admin/users/${r.user_id}`}>{r.guest}</Link> },
        { head: "Reservation", cell: (r) => <Link href={`/admin/reservations/${r.reservation_id}`}>{r.reservation_code}</Link> },
        { head: "Discount", right: true, cell: (r) => money(r.discount_amount) },
      ]} />
    </>
  );
}
