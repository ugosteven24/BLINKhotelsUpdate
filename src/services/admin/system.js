"use server";

import { revalidatePath } from "next/cache";
import { query, queryOne, execute } from "@/lib/db";
import { requireAdmin, audit, pg, } from "@/lib/guard";


// platform_settings is a key/value table: setting_key is unique and setting_value holds JSON.
// The three seeded keys keep their original shapes ({"rate":10}, {"currency":"NGN"}, {"minutes":15});
// the rest follow the same idea, one named field per key.
const SETTINGS = {
  site_name:                { field: "value",    type: "text",    note: "Name shown in the site header and emails" },
  default_currency:         { field: "currency", type: "text",    note: "Default marketplace currency" },
  default_commission_rate:  { field: "rate",     type: "number",  note: "Default marketplace commission percentage" },
  tax_rate:                 { field: "rate",     type: "number",  note: "Tax percentage added to reservations" },
  reservation_hold_minutes: { field: "minutes",  type: "number",  note: "Unpaid reservation hold duration" },
  approval_window_hours:    { field: "hours",    type: "number",  note: "How long a hotel has to approve a paid reservation" },
  maintenance_mode:         { field: "enabled",  type: "boolean", note: "Shows a maintenance page on the public site" },
  support_email:            { field: "value",    type: "text",    note: "Support contact email" },
  support_phone:            { field: "value",    type: "text",    note: "Support contact phone" },
  whatsapp_number:          { field: "value",    type: "text",    note: "Support WhatsApp number" },
  support_hours:            { field: "value",    type: "text",    note: "Support opening hours" },
  help_center_url:          { field: "value",    type: "text",    note: "Link to the help center" },
};

function decode(key, raw) {
  const def = SETTINGS[key];
  if (raw == null || raw === "") return "";
  let v = raw;
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    v = parsed && typeof parsed === "object" ? parsed[def.field] ?? "" : parsed;
  } catch { /* plain text value written by hand: use as is */ }
  return v === null || v === undefined ? "" : String(v);
}

const encode = (key, text) => {
  const def = SETTINGS[key];
  const value = def.type === "number" ? Number(text) : def.type === "boolean" ? text === "true" : text;
  return JSON.stringify({ [def.field]: value });
};

async function getSettings(keys) {
  const rows = await query("SELECT setting_key, setting_value FROM platform_settings WHERE setting_key IN (?)", [keys]);
  const found = Object.fromEntries(rows.map((r) => [r.setting_key, r.setting_value]));
  return Object.fromEntries(keys.map((k) => [k, decode(k, found[k])]));
}

async function saveSettings(fd, keys, validate) {
  const s = await requireAdmin();
  const next = {};
  for (const k of keys) next[k] = String(fd.get(k) ?? "").trim();
  const bad = validate?.(next);
  if (bad) return { error: bad };
  const old = await getSettings(keys);
  for (const k of keys)
    await execute(
      `INSERT INTO platform_settings (setting_key, setting_value, description, updated_by) VALUES (?,?,?,?)
       ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value), updated_by=VALUES(updated_by)`,
      [k, encode(k, k === "default_currency" ? next[k].toUpperCase() : next[k]), SETTINGS[k].note, s.userId]);
  await audit(s.userId, "settings.updated", "settings", null, old, next);
  revalidatePath("/admin/system");
  return { success: "Settings saved." };
}

const PLATFORM_KEYS = ["site_name", "default_currency", "default_commission_rate", "tax_rate", "reservation_hold_minutes", "approval_window_hours", "maintenance_mode"];
const SUPPORT_KEYS = ["support_email", "support_phone", "whatsapp_number", "support_hours", "help_center_url"];

export async function getPlatformSettings() { await requireAdmin(); return getSettings(PLATFORM_KEYS); }
export async function getSupportSettings() { await requireAdmin(); return getSettings(SUPPORT_KEYS); }

export async function savePlatformSettingsAction(_, fd) {
  if (fd.get("maintenance_mode") !== "true") fd.set("maintenance_mode", "false");
  return saveSettings(fd, PLATFORM_KEYS, (v) => {
    if (!v.site_name) return "Enter a site name.";
    if (!/^[A-Za-z]{3}$/.test(v.default_currency)) return "Currency must be a 3-letter code, e.g. NGN.";
    const c = Number(v.default_commission_rate); if (v.default_commission_rate === "" || !(c >= 0 && c <= 100)) return "Commission must be between 0 and 100.";
    const t = Number(v.tax_rate || 0); if (!(t >= 0 && t <= 100)) return "Tax rate must be between 0 and 100.";
    if (!v.tax_rate) v.tax_rate = "0";
    if (!(Number(v.reservation_hold_minutes) > 0) || !(Number(v.approval_window_hours) > 0)) return "Hold and approval windows must be above 0.";
    return null;
  });
}

export async function saveSupportSettingsAction(_, fd) {
  return saveSettings(fd, SUPPORT_KEYS,
    (v) => (v.support_email && !/^\S+@\S+\.\S+$/.test(v.support_email) ? "Enter a valid support email." : null));
}

export async function listAuditLogs(p) {
  await requireAdmin();
  const { limit, offset, page, pageSize } = pg(p);
  const where = [];
  const args = [];
  if (p.q) { where.push("(a.action LIKE ? OR u.email LIKE ? OR a.entity_type LIKE ?)"); args.push(`%${p.q}%`, `%${p.q}%`, `%${p.q}%`); }
  if (p.entity) { where.push("a.entity_type=?"); args.push(p.entity); }
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const base = `FROM audit_logs a LEFT JOIN users u ON u.id=a.user_id ${w}`;
  const rows = await query(
    `SELECT a.id, a.action, a.entity_type, a.entity_id, a.old_values, a.new_values, a.ip_address, a.created_at,
            u.email AS actor_email, CONCAT(u.first_name,' ',u.last_name) AS actor_name ${base}
      ORDER BY a.created_at DESC LIMIT ? OFFSET ?`, [...args, limit, offset]);
  const total = (await queryOne(`SELECT COUNT(*) AS c ${base}`, args)).c;
  return { rows, total, page, pageSize };
}

// Admin Activity: per-admin rollup + recent actions by admins only.
export async function getAdminActivity(p = {}) {
  await requireAdmin();
  const like = `%${String(p.q ?? "").trim()}%`;
  const adminWhere = p.q ? "WHERE (u.first_name LIKE ? OR u.last_name LIKE ? OR CONCAT(u.first_name,' ',u.last_name) LIKE ? OR u.email LIKE ?)" : "";
  const recentWhere = p.q ? "WHERE (u.email LIKE ? OR a.action LIKE ? OR a.entity_type LIKE ? OR a.ip_address LIKE ?)" : "";
  const [admins, recent] = await Promise.all([
    query(
      `SELECT u.id, CONCAT(u.first_name,' ',u.last_name) AS name, u.email, r.role_name, u.last_login_at,
              COUNT(a.id) AS actions_30d, MAX(a.created_at) AS last_action
         FROM users u JOIN roles r ON r.id=u.role_id AND r.role_key='superadmin'
         LEFT JOIN audit_logs a ON a.user_id=u.id AND a.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
         ${adminWhere}
        GROUP BY u.id ORDER BY actions_30d DESC`, p.q ? [like, like, like, like] : []),
    query(
      `SELECT a.id, a.action, a.entity_type, a.entity_id, a.created_at, a.ip_address, u.email AS actor_email
         FROM audit_logs a JOIN users u ON u.id=a.user_id JOIN roles r ON r.id=u.role_id AND r.role_key='superadmin'
        ${recentWhere}
        ORDER BY a.created_at DESC LIMIT 300`, p.q ? [like, like, like, like] : []),
  ]);
  return { admins, recent };
}
