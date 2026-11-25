import Link from "next/link";
import { listRefunds, processRefundAction, syncRefundAction, deleteRefundAction } from "@/services/admin/payments";
import { Header, Table, Badge, Pager, Filters } from "@/components/admin/ui";
import DeleteButton from "@/components/admin/DeleteButton";
import QuickForm from "@/components/admin/QuickForm";
import { money, dt, pageNum, pageSizeNum } from "@/lib/format";

export default async function RefundsPage({ searchParams }) {
  const sp = await searchParams;
  const { rows, total, page, pageSize } = await listRefunds({ q: sp.q, status: sp.status, page: pageNum(sp.page), pageSize: pageSizeNum(sp.pageSize) });
  return (
    <>
      <Header title="Refunds" sub="A refund becomes Successful only when Paystack confirms it (webhook or Sync). It can never be marked successful by hand." />
      <Filters q={sp.q} status={sp.status} statuses={["pending", "processing", "successful", "failed"]} />
      <Table rows={rows} empty="No refunds match these filters." cols={[
        { head: "Reference", cell: (r) => <b>{r.refund_reference}</b> },
        { head: "Payment", cell: (r) => <Link href={`/admin/payments/${r.payment_id}`}>{r.payment_reference}</Link> },
        { head: "Reservation", cell: (r) => <Link href={`/admin/reservations/${r.reservation_id}`}>{r.reservation_code}</Link> },
        { head: "Amount", right: true, cell: (r) => money(r.amount, r.currency) },
        { head: "Status", cell: (r) => <Badge v={r.status} /> },
        { head: "Provider ref", cell: (r) => r.provider_refund_id ?? "—" },
        { head: "Reason", cell: (r) => r.reason ?? "—" },
        { head: "Requested", cell: (r) => dt(r.created_at) },
        { head: "Actions", cell: (r) => (
          <div className="adm-inline">
            {["pending", "failed"].includes(r.status) && (
              <QuickForm action={processRefundAction}><input type="hidden" name="id" value={r.id} />
                <button className="adm-btn sm" data-confirm="Send this refund to Paystack?" data-confirm-detail="Money will leave your Paystack balance and go back to the customer.">{r.status === "failed" ? "Retry with Paystack" : "Send to Paystack"}</button></QuickForm>
            )}
            {r.status === "processing" && (
              <QuickForm action={syncRefundAction}><input type="hidden" name="id" value={r.id} /><button className="adm-btn ghost sm">Sync status</button></QuickForm>
            )}
            {r.status === "pending" && <DeleteButton action={deleteRefundAction} args={[r.id]} title="Delete this refund request?" text="Only requests not yet sent to Paystack can be deleted." />}
          </div>) },
      ]} />
      <Pager base="/admin/payments/refunds" page={page} pageSize={pageSize} total={total} params={sp} />
    </>
  );
}
