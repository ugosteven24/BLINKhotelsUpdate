import "@/components/admin/admin.css";
import Sidebar from "@/components/admin/Sidebar";
import Confirm from "@/components/admin/Confirm";
import { requireAdmin } from "@/lib/guard";

export const metadata = { title: "Admin · Hotel Marketplace" };

export default async function PanelLayout({ children }) {
  const s = await requireAdmin();
  return (
    <div className="adm">
      <Sidebar name={s.name} />
      <main className="adm-main">{children}</main>
      <Confirm />
    </div>
  );
}
