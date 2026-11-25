import { getMyProfile, updateProfileAction } from "@/services/admin/auth";
import ActionForm, { Field } from "@/components/admin/ActionForm";
import { Header } from "@/components/admin/ui";
import { dt } from "@/lib/format";

export default async function Page() {
  const u = await getMyProfile();
  return (
    <>
      <Header title="My Profile" sub={`${u.role_name} · Last sign-in ${dt(u.last_login_at)}`} />
      <div className="adm-card">
        <ActionForm action={updateProfileAction}>
          <Field name="first_name" labelText="First name" defaultValue={u.first_name} required />
          <Field name="last_name" labelText="Last name" defaultValue={u.last_name} required />
          <Field name="phone" labelText="Phone" defaultValue={u.phone ?? ""} />
          <Field name="email_ro" labelText="Email" defaultValue={u.email} disabled hint="Contact a super admin to change your email." />
        </ActionForm>
      </div>
    </>
  );
}
