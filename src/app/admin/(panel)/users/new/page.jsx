import { listRoles } from "@/services/admin/users";
import { readSession } from "@/lib/session";
import { Header } from "@/components/admin/ui";
import UserForm from "../UserForm";

export default async function NewUser() {
  const [roles, me] = await Promise.all([listRoles(), readSession()]);
  const allowed = roles; // only superadmins reach /admin, so every role may be assigned
  return (
    <>
      <Header title="Add user" sub="Accounts you create here are active and email-verified straight away." />
      <div className="adm-card"><UserForm roles={allowed} /></div>
    </>
  );
}
