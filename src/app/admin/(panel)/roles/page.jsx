import { getRolesOverview } from "@/services/admin/security";
import { Header, Table, Stat } from "@/components/admin/ui";
import { num, label } from "@/lib/format";

export default async function RolesPage() {
  const { roles, permissions, activeSuperadmins } = await getRolesOverview();
  return (
    <>
      <Header title="Roles & permissions" sub="Roles are fixed platform definitions. Superadmin always has full access and cannot be edited here. Staff permissions are granted per hotel." />
      <div className="adm-grid"><Stat title="Active superadmins" value={num(activeSuperadmins)} alert={activeSuperadmins < 2} /></div>
      {activeSuperadmins < 2 && <p className="adm-sub">Only one active superadmin exists. Add a second so the platform is never locked out.</p>}
      <h2>Roles</h2>
      <Table rows={roles} cols={[
        { head: "Role", cell: (r) => <b>{r.role_name}</b> }, { head: "Key", cell: (r) => <code>{r.role_key}</code> },
        { head: "Description", cell: (r) => r.description ?? "—" },
        { head: "Users", right: true, cell: (r) => num(r.users) }, { head: "Active", right: true, cell: (r) => num(r.active_users) },
        { head: "Access", cell: (r) => r.role_key === "superadmin" ? "Full platform access (protected)" : r.role_key === "hotel_staff" ? "Per-hotel permissions below" : r.role_key === "hotel_owner" ? "Own hotels" : "Own bookings" },
      ]} />
      <h2>Permission definitions</h2>
      <Table rows={permissions} empty="No permissions defined." cols={[
        { head: "Permission", cell: (p) => <b>{p.permission_name}</b> }, { head: "Key", cell: (p) => <code>{p.permission_key}</code> },
        { head: "Description", cell: (p) => p.description ?? "—" }, { head: "Granted to staff", right: true, cell: (p) => num(p.grants) },
      ]} />
    </>
  );
}
