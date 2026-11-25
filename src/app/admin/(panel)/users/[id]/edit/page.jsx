import { notFound } from "next/navigation";
import { getUserForEdit, listRoles } from "@/services/admin/users";
import { readSession } from "@/lib/session";
import { Header } from "@/components/admin/ui";
import UserForm from "../../UserForm";

export default async function EditUser({ params }) {
  const { id } = await params;
  const [user, roles, me] = await Promise.all([getUserForEdit(Number(id)), listRoles(), readSession()]);
  if (!user) notFound();
  const allowed = roles; // only superadmins reach /admin, so every role may be assigned
  return (
    <>
      <Header title={`Edit ${user.first_name} ${user.last_name}`} sub={user.email} />
      <div className="adm-card"><UserForm user={user} roles={allowed} selfEdit={me?.userId === user.id} /></div>
    </>
  );
}
