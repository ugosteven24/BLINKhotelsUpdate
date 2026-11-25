import Link from "next/link";
import { listHotels, deleteHotelAction } from "@/services/admin/hotels";
import { Header, Table, Badge, Pager, Filters } from "@/components/admin/ui";
import RowActions from "@/components/admin/RowActions";
import { d, label, pageNum, pageSizeNum } from "@/lib/format";

export default async function HotelsPage({ searchParams }) {
  const sp = await searchParams;
  const { rows, total, page, pageSize } = await listHotels({ q: sp.q, status: sp.status, page: pageNum(sp.page), pageSize: pageSizeNum(sp.pageSize) });
  return (
    <>
      <Header title="Hotels" sub="Review new listings and manage existing ones.">
        <Link className="adm-btn" href="/admin/hotels/new">Add hotel</Link>
      </Header>
      <Filters q={sp.q} status={sp.status} statuses={["pending", "approved", "rejected", "suspended", "draft"]} />
      <Table rows={rows} empty="No hotels match these filters." cols={[
        { head: "Hotel", cell: (h) => <Link href={`/admin/hotels/${h.id}`}><b>{h.hotel_name}</b>{h.is_featured ? " ★" : ""}</Link> },
        { head: "Location", cell: (h) => `${h.city}, ${h.state}` },
        { head: "Type", cell: (h) => label(h.category) },
        { head: "Owner", cell: (h) => h.owner_name },
        { head: "Commission", right: true, cell: (h) => `${h.commission_rate}%` },
        { head: "Status", cell: (h) => <Badge v={h.approval_status} /> },
        { head: "Submitted", cell: (h) => d(h.created_at) },
        { head: "Actions", cell: (h) => (
          <RowActions view={`/admin/hotels/${h.id}`} edit={`/admin/hotels/${h.id}/edit`}
            del={{ action: deleteHotelAction, args: [h.id], title: `Delete ${h.hotel_name}?`, text: "Its rooms and room types are deleted too. Hotels with reservations can't be deleted; suspend them instead." }} />) },
      ]} />
      <Pager base="/admin/hotels" page={page} pageSize={pageSize} total={total} params={sp} />
    </>
  );
}
