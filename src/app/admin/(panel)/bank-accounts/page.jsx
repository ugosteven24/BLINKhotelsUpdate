import Link from "next/link";
import { listBankAccounts, decideBankAccountAction } from "@/services/admin/bank-accounts";
import { Header, Table, Badge, Pager, Filters } from "@/components/admin/ui";
import QuickForm from "@/components/admin/QuickForm";
import { dt, pageNum, pageSizeNum } from "@/lib/format";

export default async function BankAccountsPage({ searchParams }) {
  const sp = await searchParams;
  const { rows, total, page, pageSize } = await listBankAccounts({ q: sp.q, status: sp.status, page: pageNum(sp.page), pageSize: pageSizeNum(sp.pageSize) });
  return (
    <>
      <Header title="Bank accounts" sub="Payouts can only go to a verified account. Full account numbers are encrypted and never shown." />
      <Filters q={sp.q} status={sp.status} statuses={["pending", "verified", "failed"]} />
      <Table rows={rows} empty="No bank accounts match." cols={[
        { head: "Hotel", cell: (b) => <Link href={`/admin/hotels/${b.hotel_id}`}>{b.hotel_name}</Link> },
        { head: "Account holder", cell: (b) => b.account_name },
        { head: "Bank", cell: (b) => `${b.bank_name}${b.is_default ? " · default" : ""}` },
        { head: "Account", cell: (b) => `••••${b.account_number_last4}` },
        { head: "Status", cell: (b) => <Badge v={b.verification_status} /> },
        { head: "Verified by", cell: (b) => b.verified_by_name ? `${b.verified_by_name} · ${dt(b.verified_at)}` : "—" },
        { head: "Actions", cell: (b) => (
          <QuickForm action={decideBankAccountAction}>
            <input type="hidden" name="id" value={b.id} />
            {b.verification_status !== "verified" && <button className="adm-btn sm" name="decision" value="verified" data-confirm="Verify this bank account?" data-confirm-detail="Confirm the account name matches the hotel's registered business first.">Verify</button>}
            {b.verification_status !== "failed" && <button className="adm-btn danger sm" name="decision" value="failed" data-confirm="Reject this bank account?">Reject</button>}
          </QuickForm>) },
      ]} />
      <Pager base="/admin/bank-accounts" page={page} pageSize={pageSize} total={total} params={sp} />
    </>
  );
}
