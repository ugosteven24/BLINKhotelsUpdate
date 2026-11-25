import Link from "next/link";
import { listWebhookEvents } from "@/services/admin/webhooks";
import { Header, Table, Badge, Pager, Filters } from "@/components/admin/ui";
import { dt, pageNum, pageSizeNum } from "@/lib/format";

export default async function WebhooksPage({ searchParams }) {
  const sp = await searchParams;
  const { rows, total, page, pageSize } = await listWebhookEvents({ q: sp.q, status: sp.status, page: pageNum(sp.page), pageSize: pageSizeNum(sp.pageSize) });
  return (
    <>
      <Header title="Payment webhook events" sub="Signed Paystack events. Processing is idempotent, so a repeated event is recorded once and never applied twice. Events cannot be replayed from here." />
      <Filters q={sp.q} status={sp.status} statuses={["received", "processing", "processed", "failed", "ignored"]} />
      <Table rows={rows} empty="No webhook events recorded yet." cols={[
        { head: "Event", cell: (e) => <Link href={`/admin/webhooks/${e.id}`}><b>{e.event_type}</b></Link> },
        { head: "Event ID", cell: (e) => <small>{e.provider_event_id}</small> },
        { head: "Payment reference", cell: (e) => e.payment_reference ?? "—" },
        { head: "Status", cell: (e) => <Badge v={e.processing_status} /> },
        { head: "Error", cell: (e) => e.processing_error ? <small>{e.processing_error.slice(0, 80)}</small> : "—" },
        { head: "Received", cell: (e) => dt(e.received_at) },
        { head: "Processed", cell: (e) => dt(e.processed_at) },
      ]} />
      <Pager base="/admin/webhooks" page={page} pageSize={pageSize} total={total} params={sp} />
    </>
  );
}
