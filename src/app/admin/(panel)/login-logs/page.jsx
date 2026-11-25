import { listLoginLogs } from "@/services/admin/security";
import { Header, Table, Badge, Pager, Filters } from "@/components/admin/ui";
import { dt, pageNum, pageSizeNum } from "@/lib/format";

export default async function LoginLogsPage({ searchParams }) {
  const sp = await searchParams;
  const { rows, total, page, pageSize } = await listLoginLogs({ q: sp.q, result: sp.result, from: sp.from, to: sp.to, page: pageNum(sp.page), pageSize: pageSizeNum(sp.pageSize) });
  return (
    <>
      <Header title="Login logs" sub="Every sign-in attempt, successful or not." />
      <Filters q={sp.q} dates values={sp} extra={
        <select name="result" defaultValue={sp.result ?? ""} aria-label="Result"><option value="">All results</option><option value="success">Successful</option><option value="failed">Failed</option></select>} />
      <Table rows={rows} empty="No login attempts recorded." cols={[
        { head: "When", cell: (l) => dt(l.created_at) },
        { head: "Email", cell: (l) => l.email ?? "—" },
        { head: "User", cell: (l) => l.user_name ?? "—" },
        { head: "Result", cell: (l) => <Badge v={l.success ? "successful" : "failed"} /> },
        { head: "IP address", cell: (l) => l.ip_address ?? "—" },
        { head: "Device", cell: (l) => <small>{(l.user_agent ?? "—").slice(0, 70)}</small> },
      ]} />
      <Pager base="/admin/login-logs" page={page} pageSize={pageSize} total={total} params={sp} />
    </>
  );
}
