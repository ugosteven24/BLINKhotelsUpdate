import { listAuditLogs } from "@/services/admin/system";
import { Header, Table, Pager, Filters } from "@/components/admin/ui";
import { dt, label, pageNum, pageSizeNum } from "@/lib/format";

const show = (v) => (v == null ? null : <div className="adm-code">{typeof v === "string" ? v : JSON.stringify(v)}</div>);

export default async function Page({ searchParams }) {
  const sp = await searchParams;
  const { rows, total, page, pageSize } = await listAuditLogs({ q: sp.q, entity: sp.entity, page: pageNum(sp.page), pageSize: pageSizeNum(sp.pageSize) });
  return (
    <>
      <Header title="Audit Logs" sub="Every change made through the admin, with before and after values." />
      <Filters q={sp.q} />
      <Table rows={rows} empty="No audit entries match." cols={[
        { head: "When", cell: (a) => dt(a.created_at) },
        { head: "Who", cell: (a) => a.actor_email ?? "System" },
        { head: "Action", cell: (a) => <b>{label(a.action)}</b> },
        { head: "Target", cell: (a) => a.entity_type ? `${label(a.entity_type)} #${a.entity_id ?? "—"}` : "—" },
        { head: "Before", cell: (a) => show(a.old_values) ?? "—" },
        { head: "After", cell: (a) => show(a.new_values) ?? "—" },
        { head: "IP", cell: (a) => a.ip_address ?? "—" },
      ]} />
      <Pager base="/admin/system/audit-logs" page={page} pageSize={pageSize} total={total} params={sp} />
    </>
  );
}
