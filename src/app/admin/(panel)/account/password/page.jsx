import { changePasswordAction } from "@/services/admin/auth";
import ActionForm, { Field } from "@/components/admin/ActionForm";
import { Header } from "@/components/admin/ui";

export default function Page() {
  return (
    <>
      <Header title="Change Password" sub="Use at least 8 characters." />
      <div className="adm-card" style={{ maxWidth: 520 }}>
        <ActionForm action={changePasswordAction} submit="Change password" className="adm-form">
          <Field name="current_password" labelText="Current password" type="password" autoComplete="current-password" required full />
          <Field name="new_password" labelText="New password" type="password" autoComplete="new-password" minLength={8} required full />
          <Field name="confirm_password" labelText="Confirm new password" type="password" autoComplete="new-password" required full />
        </ActionForm>
      </div>
    </>
  );
}
