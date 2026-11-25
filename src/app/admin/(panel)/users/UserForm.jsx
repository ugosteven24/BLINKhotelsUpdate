import ActionForm, { Field } from "@/components/admin/ActionForm";
import SelectField from "@/components/admin/Select";
import { createUserAction, updateUserAction } from "@/services/admin/users";

export default function UserForm({ user, roles, selfEdit }) {
  const editing = !!user;
  return (
    <ActionForm action={editing ? updateUserAction : createUserAction} submit={editing ? "Save user" : "Create user"}>
      {editing && <input type="hidden" name="id" value={user.id} />}
      <Field name="first_name" labelText="First name" defaultValue={user?.first_name} required />
      <Field name="last_name" labelText="Last name" defaultValue={user?.last_name} required />
      <Field name="email" labelText="Email" type="email" defaultValue={user?.email} required />
      <Field name="phone" labelText="Phone" defaultValue={user?.phone ?? ""} />
      <SelectField name="role_id" labelText="Role" defaultValue={user?.role_id} placeholder="Choose a role" required
        options={roles.map((r) => ({ value: r.id, label: r.role_name }))}
        hint={selfEdit ? "You can't change your own role." : undefined} />
      <SelectField name="status" labelText="Status" defaultValue={user?.status ?? "active"}
        options={[{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }, { value: "suspended", label: "Suspended" }, { value: "pending_verification", label: "Pending verification" }]}
        hint={selfEdit ? "You can't change your own status." : undefined} />
      <Field name="password" labelText={editing ? "New password" : "Password"} type="password" autoComplete="new-password"
        minLength={editing ? undefined : 8} required={!editing} full
        hint={editing ? "Leave empty to keep the current password." : "At least 8 characters."} />
    </ActionForm>
  );
}
