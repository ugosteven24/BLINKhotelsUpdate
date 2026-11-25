import Link from "next/link";
import { listUsers, listRoles, deleteUserAction } from "@/services/admin/users";
import { Header, Table, Badge, Pager, Filters } from "@/components/admin/ui";
import RowActions from "@/components/admin/RowActions";
import { dt, pageNum, pageSizeNum } from "@/lib/format";

export default async function UsersPage({ searchParams }) {
  const sp = await searchParams;
  const [{ rows, total, page, pageSize }, roles] = await Promise.all([
    listUsers({ q: sp.q, status: sp.status, role: sp.role, page: pageNum(sp.page), pageSize: pageSizeNum(sp.pageSize) }), listRoles(),
  ]);
  return (
    <>
      <Header title="Users" sub="Customers, hotel owners, staff and admins.">
        <Link className="adm-btn" href="/admin/users/new">Add user</Link>
      </Header>
      <Filters q={sp.q} status={sp.status} statuses={["active", "inactive", "suspended", "pending_verification"]}
        extra={<select name="role" defaultValue={sp.role ?? ""} aria-label="Role"><option value="">All roles</option>{roles.map((r) => <option key={r.id} value={r.role_key}>{r.role_name}</option>)}</select>} />
      <Table rows={rows} empty="No users match these filters." cols={[
        { head: "Name", cell: (u) => <Link href={`/admin/users/${u.id}`}><b>{u.first_name} {u.last_name}</b></Link> },
        { head: "Email", cell: (u) => u.email },
        { head: "Phone", cell: (u) => u.phone ?? "—" },
        { head: "Role", cell: (u) => u.role_name ?? "—" },
        { head: "Status", cell: (u) => <Badge v={u.status} /> },
        { head: "Last login", cell: (u) => dt(u.last_login_at) },
        { head: "Actions", cell: (u) => (
          <RowActions view={`/admin/users/${u.id}`} edit={`/admin/users/${u.id}/edit`}
            del={{ action: deleteUserAction, args: [u.id], title: `Delete ${u.first_name} ${u.last_name}?`, text: "This can't be undone. Users with bookings or hotels can't be deleted." }} />) },
      ]} />
      <Pager base="/admin/users" page={page} pageSize={pageSize} total={total} params={sp} />
    </>
  );
}
