"use server";

import { revalidatePath } from "next/cache";
import { query, queryOne, execute } from "@/lib/db";
import { requireAdmin, audit, pg } from "@/lib/guard";

// account_number_encrypted is never selected anywhere in the admin: only the last four digits are shown.
export async function listBankAccounts(p) {
  await requireAdmin();
  const { limit, offset, page, pageSize } = pg(p);
  const where = [];
  const args = [];
  if (p.status) { where.push("b.verification_status=?"); args.push(p.status); }
  if (p.q) { where.push("(h.hotel_name LIKE ? OR b.account_name LIKE ? OR b.bank_name LIKE ?)"); args.push(`%${p.q}%`, `%${p.q}%`, `%${p.q}%`); }
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const base = `FROM hotel_bank_accounts b JOIN hotels h ON h.id=b.hotel_id LEFT JOIN users u ON u.id=b.verified_by ${w}`;
  const rows = await query(
    `SELECT b.id, b.hotel_id, b.bank_name, b.bank_code, b.account_name, b.account_number_last4, b.is_default, b.verification_status,
            b.verified_at, h.hotel_name, CONCAT(u.first_name,' ',u.last_name) AS verified_by_name
       ${base} ORDER BY (b.verification_status='pending') DESC, b.created_at DESC LIMIT ? OFFSET ?`, [...args, limit, offset]);
  const total = (await queryOne(`SELECT COUNT(*) AS c ${base}`, args)).c;
  return { rows, total, page, pageSize };
}

export async function decideBankAccountAction(fd) {
  const s = await requireAdmin();
  const id = Number(fd.get("id"));
  const decision = String(fd.get("decision"));
  if (!["verified", "failed"].includes(decision)) return { error: "Unknown decision." };
  const old = await queryOne("SELECT verification_status, bank_name, account_number_last4 FROM hotel_bank_accounts WHERE id=?", [id]);
  if (!old) return { error: "That bank account no longer exists." };
  await execute("UPDATE hotel_bank_accounts SET verification_status=?, verified_by=?, verified_at=NOW() WHERE id=?", [decision, s.userId, id]);
  await audit(s.userId, `bank_account.${decision}`, "hotel_bank_account", id, { status: old.verification_status }, { status: decision, account: `${old.bank_name} ****${old.account_number_last4}` });
  revalidatePath("/admin/bank-accounts");
  return { success: `Bank account marked ${decision}.` };
}
