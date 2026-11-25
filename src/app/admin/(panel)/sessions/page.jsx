import Link from "next/link";
import { listSessions, revokeSessionAction, revokeUserSessionsAction, purgeExpiredSessionsAction } from "@/services/admin/sessions";
import { Header, Table, Badge, Pager, Filters, Stat } from "@/components/admin/ui";
import QuickForm from "@/components/admin/QuickForm";
import { dt, pageNum, pageSizeNum } from "@/lib/format";

export default async function SessionsPage({ searchParams }) {
  const sp = await searchParams;
  const { rows, total, page, pageSize, active, expired } = await listSessions({
    q: sp.q, status: sp.status, page: pageNum(sp.page), pageSize: pageSizeNum(sp.pageSize),
  });
  const showingExpired = sp.status === "expired";
  return (
    <>
      <Header title="Active sessions" sub="Devices signed in to the public site. Ending a session signs that device out. Admin panel sign-ins aren't listed (suspend the account to cut one off).">
        {expired > 0 && (
          <QuickForm action={purgeExpiredSessionsAction}>
            <button className="adm-btn ghost" data-confirm="Delete all expired sessions?">Clear {expired} expired</button>
          </QuickForm>
        )}
      </Header>
      <div className="adm-grid">
        <Stat title="Active sessions" value={active} href="/admin/sessions" />
        <Stat title="Expired (not yet cleared)" value={expired} href="/admin/sessions?status=expired" />
      </div>
      <Filters q={sp.q} status={sp.status} statuses={["active", "expired"]} />
      <Table rows={rows} empty={showingExpired ? "No expired sessions." : "No one is signed in right now."} cols={[
        { head: "User", cell: (r) => <><Link href={`/admin/users/${r.user_id}`}><b>{r.first_name} {r.last_name}</b></Link><br /><small>{r.email}</small></> },
        { head: "Role", cell: (r) => r.role_name ?? "—" },
        { head: "Account", cell: (r) => <Badge v={r.user_status} /> },
        { head: "IP address", cell: (r) => r.ip_address ?? "—" },
        { head: "Device", cell: (r) => <span title={r.user_agent ?? ""}>{(r.user_agent ?? "—").slice(0, 48)}{(r.user_agent ?? "").length > 48 ? "…" : ""}</span> },
        { head: "Signed in", cell: (r) => dt(r.created_at) },
        { head: showingExpired ? "Expired" : "Expires", cell: (r) => dt(r.expires_at) },
        { head: "Actions", cell: (r) => (
          <div className="adm-inline">
            <QuickForm action={revokeSessionAction}><input type="hidden" name="id" value={r.id} />
              <button className="adm-btn danger sm" data-confirm="End this session?">End</button></QuickForm>
            {!showingExpired && (
              <QuickForm action={revokeUserSessionsAction}><input type="hidden" name="user_id" value={r.user_id} />
                <button className="adm-btn ghost sm" data-confirm="Sign this user out of every device?">Sign out everywhere</button></QuickForm>
            )}
          </div>) },
      ]} />
      <Pager base="/admin/sessions" page={page} pageSize={pageSize} total={total} params={sp} />
    </>
  );
}
