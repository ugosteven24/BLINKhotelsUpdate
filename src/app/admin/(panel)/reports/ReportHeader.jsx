import { Header, Filters } from "@/components/admin/ui";

// Pass `search` (and the current `q`) on reports that list rows worth searching.
export default function ReportHeader({ title, sub, from, to, search, q }) {
  return (<><Header title={title} sub={sub} /><Filters {...(search ? { q: q ?? "" } : {})} dates values={{ from, to }} /></>);
}
