import Link from "next/link";
import { listCoupons, toggleCouponAction, deleteCouponAction } from "@/services/admin/coupons";
import { Header, Table, Badge, Pager, Filters } from "@/components/admin/ui";
import RowActions from "@/components/admin/RowActions";
import { money, d, pageNum, pageSizeNum } from "@/lib/format";

export default async function CouponsPage({ searchParams }) {
  const sp = await searchParams;
  const { rows, total, page, pageSize } = await listCoupons({ q: sp.q, status: sp.status, page: pageNum(sp.page), pageSize: pageSizeNum(sp.pageSize) });
  return (
    <>
      <Header title="Promotions & Coupons" sub="Discount codes guests can apply at checkout."><Link className="adm-btn" href="/admin/coupons/new">Create coupon</Link></Header>
      <Filters q={sp.q} status={sp.status} statuses={["active", "inactive", "expired"]} />
      <Table rows={rows} empty="No coupons yet. Create one to run a promotion." cols={[
        { head: "Code", cell: (c) => <Link href={`/admin/coupons/${c.id}`}><b>{c.code}</b></Link> },
        { head: "Title", cell: (c) => c.title },
        { head: "Discount", cell: (c) => c.discount_type === "percentage" ? `${c.discount_value}%` : money(c.discount_value) },
        { head: "Scope", cell: (c) => c.hotel_name ?? "All hotels" },
        { head: "Used", right: true, cell: (c) => `${c.used_count}${c.usage_limit ? ` / ${c.usage_limit}` : ""}` },
        { head: "Valid", cell: (c) => `${d(c.starts_at)} – ${d(c.expires_at)}` },
        { head: "Status", cell: (c) => <Badge v={c.effective_status} /> },
        { head: "Actions", cell: (c) => (
          <RowActions view={`/admin/coupons/${c.id}`} edit={`/admin/coupons/${c.id}/edit`}
            del={{ action: deleteCouponAction, args: [c.id], title: `Delete ${c.code}?`, text: "A coupon that has been used is deactivated instead, so redemption history is kept." }}>
            <form action={toggleCouponAction}><input type="hidden" name="id" value={c.id} /><button className="adm-btn ghost sm">{c.status === "active" ? "Deactivate" : "Activate"}</button></form>
          </RowActions>) },
      ]} />
      <Pager base="/admin/coupons" page={page} pageSize={pageSize} total={total} params={sp} />
    </>
  );
}
