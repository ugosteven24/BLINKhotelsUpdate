import Link from "next/link";
import { notFound } from "next/navigation";
import { getHotelStaff, addStaffAction, updateStaffAction, removeStaffAction } from "@/services/admin/hotel-staff";
import { Header, Badge } from "@/components/admin/ui";
import QuickForm from "@/components/admin/QuickForm";
import DeleteButton from "@/components/admin/DeleteButton";
import { dt, label } from "@/lib/format";

const STATUSES = ["invited", "active", "suspended", "removed"];

function PermissionBoxes({ permissions, checked = [] }) {
  return (
    <div className="adm-perms">
      {permissions.map((p) => (
        <label key={p.id} className="adm-inline" style={{ fontWeight: 500 }} title={p.description ?? ""}>
          <input type="checkbox" name="permissions" value={p.id} defaultChecked={checked.includes(p.id)} /> {p.permission_name}
        </label>
      ))}
    </div>
  );
}

export default async function HotelStaffPage({ params }) {
  const { id } = await params;
  const data = await getHotelStaff(Number(id));
  if (!data) notFound();
  const { hotel, staff, permissions, candidates } = data;
  return (
    <>
      <Header title={`${hotel.hotel_name} · Staff`} sub="Employees who work for this hotel and what each of them is allowed to do.">
        <Link className="adm-btn ghost" href={`/admin/hotels/${hotel.id}`}>Back to hotel</Link>
      </Header>

      <div className="adm-card">
        <h2>Add a staff member</h2>
        {candidates.length === 0 ? (
          <p className="adm-sub">Everyone with the Hotel Staff role is already on this team. Create a new user with the <b>Hotel Staff</b> role first.
            {" "}<Link href="/admin/users/new">Add user</Link></p>
        ) : (
          <QuickForm action={addStaffAction} className="adm-form">
            <input type="hidden" name="hotel_id" value={hotel.id} />
            <div className="adm-field"><label htmlFor="user_id">Person</label>
              <select id="user_id" name="user_id" required defaultValue="">
                <option value="" disabled>Choose a user</option>
                {candidates.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
              <small>Active users with the Hotel Staff role.</small></div>
            <div className="adm-field"><label htmlFor="staff_title">Job title</label>
              <input id="staff_title" name="staff_title" maxLength={100} placeholder="e.g. Front desk manager" /></div>
            <div className="adm-field full"><label>Permissions</label><PermissionBoxes permissions={permissions} /></div>
            <p><button className="adm-btn">Add to team</button></p>
          </QuickForm>
        )}
      </div>

      <h2>Team ({staff.length})</h2>
      {staff.length === 0 ? (
        <div className="adm-tablewrap"><div className="adm-empty">No staff yet.</div></div>
      ) : staff.map((m) => (
        <div key={m.id} className="adm-card">
          <div className="adm-head" style={{ border: 0, padding: 0, marginBottom: 10 }}>
            <div>
              <h2 style={{ margin: 0 }}><Link href={`/admin/users/${m.user_id}`}>{m.first_name} {m.last_name}</Link></h2>
              <p className="adm-sub" style={{ margin: 0 }}>{m.email} · Joined {dt(m.joined_at)}</p>
            </div>
            <div className="adm-inline"><Badge v={m.status} />{m.user_status !== "active" && <span className="adm-badge bad">Account {label(m.user_status)}</span>}</div>
          </div>
          <QuickForm action={updateStaffAction} className="adm-form">
            <input type="hidden" name="id" value={m.id} />
            <div className="adm-field"><label htmlFor={`t${m.id}`}>Job title</label>
              <input id={`t${m.id}`} name="staff_title" defaultValue={m.staff_title ?? ""} maxLength={100} /></div>
            <div className="adm-field"><label htmlFor={`s${m.id}`}>Status</label>
              <select id={`s${m.id}`} name="status" defaultValue={m.status}>{STATUSES.map((st) => <option key={st} value={st}>{label(st)}</option>)}</select></div>
            <div className="adm-field full"><label>Permissions</label><PermissionBoxes permissions={permissions} checked={m.permissionIds} /></div>
            <p className="adm-inline">
              <button className="adm-btn sm" data-confirm="Save changes to this staff member?">Save</button>
            </p>
          </QuickForm>
          <DeleteButton action={removeStaffAction} args={[m.id]} title={`Remove ${m.first_name} from this hotel?`}
            text="They lose all access to this hotel. Their user account stays." confirmText="Yes, remove">Remove from team</DeleteButton>
        </div>
      ))}
    </>
  );
}
