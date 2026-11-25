import Link from "next/link";
import DeleteButton from "./DeleteButton";

// View / Edit / Delete buttons for a table row. Pass only the ones that apply.
// del = { action, args, title, text, confirmText }
export default function RowActions({ view, edit, del, children }) {
  return (
    <div className="adm-inline">
      {view && <Link className="adm-btn ghost sm" href={view}>View</Link>}
      {edit && <Link className="adm-btn ghost sm" href={edit}>Edit</Link>}
      {children}
      {del && <DeleteButton {...del} />}
    </div>
  );
}
