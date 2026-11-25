import Link from "next/link";
import { notFound } from "next/navigation";
import { getUser, listRoles, setUserStatusAction, setUserRoleAction, deleteUserAction } from "@/services/admin/users";
import DeleteButton from "@/components/admin/DeleteButton";
import { Header, Table, Badge } from "@/components/admin/ui";
import { money, dt, d } from "@/lib/format";

export default async function UserDetail({ params }) {
  const { id } = await params;
  const [data, roles] = await Promise.all([getUser(Number(id)), listRoles()]);
  if (!data) notFound();
  const { user: u, reservations, hotels, addresses, favourites, sessions, staffOf } = data;
  return (
    <>
      <Header title={`${u.first_name} ${u.last_name}`} sub={u.email}>
        <Badge v={u.status} />
        <Link className="adm-btn ghost" href={`/admin/users/${u.id}/edit`}>Edit</Link>
        <DeleteButton action={deleteUserAction} args={[u.id]} redirectTo="/admin/users" className="adm-btn danger"
          title={`Delete ${u.first_name} ${u.last_name}?`} text="This can't be undone. Users with bookings or hotels can't be deleted." />
      </Header>
      <div className="adm-two">
        <div className="adm-card">
          <h2>Details</h2>
          <dl className="adm-dl">
            <dt>Role</dt><dd>{u.role_name ?? "—"}</dd>
            <dt>Phone</dt><dd>{u.phone ?? "—"}</dd>
            <dt>Email verified</dt><dd>{dt(u.email_verified_at)}</dd>
            <dt>Phone verified</dt><dd>{dt(u.phone_verified_at)}</dd>
            <dt>Last login</dt><dd>{dt(u.last_login_at)}</dd>
            <dt>Joined</dt><dd>{dt(u.created_at)}</dd>
            <dt>Favourite hotels</dt><dd>{favourites}</dd>
            <dt>Signed-in devices</dt><dd>{sessions > 0 ? <Link href={`/admin/sessions?q=${encodeURIComponent(u.email)}`}>{sessions} active</Link> : "None"}</dd>
            {staffOf > 0 && (<><dt>Hotel staff at</dt><dd>{staffOf} hotel{staffOf === 1 ? "" : "s"}</dd></>)}
          </dl>
        </div>
        <div className="adm-card">
          <h2>Manage</h2>
          <form action={setUserStatusAction} className="adm-inline" style={{ marginBottom: 12 }}>
            <input type="hidden" name="id" value={u.id} />
            <select name="status" defaultValue={u.status === "pending_verification" ? "active" : u.status} aria-label="Status">
              <option value="active">Active</option><option value="inactive">Inactive</option><option value="suspended">Suspended</option>
            </select>
            <button className="adm-btn sm" data-confirm="Change this user's status?">Update status</button>
          </form>
          <form action={setUserRoleAction} className="adm-inline">
            <input type="hidden" name="id" value={u.id} />
            <select name="role_id" defaultValue={u.role_id ?? ""} aria-label="Role">
              {roles.map((r) => <option key={r.id} value={r.id}>{r.role_name}</option>)}
            </select>
            <button className="adm-btn sm" data-confirm="Change this user's role? This changes what they can access.">Update role</button>
          </form>
        </div>
      </div>
      {addresses.length > 0 && (<><h2>Saved addresses</h2>
        <Table rows={addresses} cols={[
          { head: "Address", cell: (a) => [a.address_line1, a.address_line2].filter(Boolean).join(", ") },
          { head: "City", cell: (a) => a.city }, { head: "State", cell: (a) => a.state ?? "—" },
          { head: "Postal code", cell: (a) => a.postal_code ?? "—" }, { head: "Country", cell: (a) => a.country },
          { head: "Default", cell: (a) => (a.is_default ? "Yes" : "") },
        ]} /><br /></>)}
      {hotels.length > 0 && (<><h2>Hotels owned</h2>
        <Table rows={hotels} cols={[
          { head: "Hotel", cell: (h) => <Link href={`/admin/hotels/${h.id}`}>{h.hotel_name}</Link> },
          { head: "City", cell: (h) => h.city }, { head: "Status", cell: (h) => <Badge v={h.approval_status} /> },
        ]} /><br /></>)}
      <h2>Recent reservations</h2>
      <Table rows={reservations} empty="This user hasn't booked yet." cols={[
        { head: "Code", cell: (r) => <Link href={`/admin/reservations/${r.id}`}>{r.reservation_code}</Link> },
        { head: "Hotel", cell: (r) => r.hotel_name },
        { head: "Stay", cell: (r) => `${d(r.check_in)} – ${d(r.check_out)}` },
        { head: "Status", cell: (r) => <Badge v={r.status} /> },
        { head: "Total", right: true, cell: (r) => money(r.total_amount) },
      ]} />
    </>
  );
}
