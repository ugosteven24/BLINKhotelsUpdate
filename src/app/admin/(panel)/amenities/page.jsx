import Link from "next/link";
import { listAmenities, deleteAmenityAction } from "@/services/admin/amenities";
import { Header, Table, Pager, Filters } from "@/components/admin/ui";
import RowActions from "@/components/admin/RowActions";
import { label, pageNum, pageSizeNum } from "@/lib/format";

export default async function AmenitiesPage({ searchParams }) {
  const sp = await searchParams;
  const { rows, total, page, pageSize } = await listAmenities({ q: sp.q, page: pageNum(sp.page), pageSize: pageSizeNum(sp.pageSize) });
  return (
    <>
      <Header title="Amenities" sub="The features hotels and rooms can list, such as Wi-Fi or a pool.">
        <Link className="adm-btn" href="/admin/amenities/new">Add amenity</Link>
      </Header>
      <Filters q={sp.q} />
      <Table rows={rows} empty="No amenities yet." cols={[
        { head: "Name", cell: (a) => <b>{a.name}</b> },
        { head: "Applies to", cell: (a) => label(a.amenity_type) },
        { head: "Icon key", cell: (a) => a.icon_key ?? "—" },
        { head: "Hotels using it", right: true, cell: (a) => a.hotels },
        { head: "Actions", cell: (a) => (
          <RowActions edit={`/admin/amenities/${a.id}/edit`}
            del={{ action: deleteAmenityAction, args: [a.id], title: `Delete ${a.name}?`, text: `It will be removed from ${a.hotels} hotel${a.hotels === 1 ? "" : "s"} and any room types using it.` }} />) },
      ]} />
      <Pager base="/admin/amenities" page={page} pageSize={pageSize} total={total} params={sp} />
    </>
  );
}
