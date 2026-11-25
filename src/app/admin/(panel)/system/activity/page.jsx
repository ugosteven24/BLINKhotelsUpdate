import { getAdminActivity } from "@/services/admin/system";
import { Header, Table, Pager, Filters } from "@/components/admin/ui";
import { dt, label, num, paginate } from "@/lib/format";

export default async function Page({ searchParams }) {
  const sp = await searchParams;
  const { admins, recent } = await getAdminActivity(sp);
  const pg = paginate(recent, sp, 10);
  return (
    <>
      <Header title="Admin Activity" sub="What each administrator has done in the last 30 days." />
      <Filters q={sp.q ?? ""} />
      <Table rows={admins} empty="No administrators match." cols={[
        { head: "Admin", cell: (a) => <><b>{a.name}</b><br />{a.email}</> }, { head: "Role", cell: (a) => a.role_name },
        { head: "Actions (30 days)", right: true, cell: (a) => num(a.actions_30d) }, { head: "Last action", cell: (a) => dt(a.last_action) }, { head: "Last login", cell: (a) => dt(a.last_login_at) },
      ]} /><br />
      <h2>Recent actions</h2>
      <Table rows={pg.rows} empty="No admin activity found." cols={[
        { head: "When", cell: (a) => dt(a.created_at) }, { head: "Admin", cell: (a) => a.actor_email },
        { head: "Action", cell: (a) => label(a.action) }, { head: "Target", cell: (a) => a.entity_type ? `${label(a.entity_type)} #${a.entity_id ?? "—"}` : "—" }, { head: "IP", cell: (a) => a.ip_address ?? "—" },
      ]} />
      <Pager base="/admin/system/activity" page={pg.page} pageSize={pg.pageSize} total={pg.total} params={sp} />
    </>
  );
}
