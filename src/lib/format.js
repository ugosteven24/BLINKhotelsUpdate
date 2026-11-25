export const money = (n, cur = "NGN") =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(Number(n ?? 0));
export const num = (n) => new Intl.NumberFormat("en-NG").format(Number(n ?? 0));
export const dt = (s) =>
  s ? new Date(s.replace(" ", "T")).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
export const d = (s) =>
  s ? new Date(s.replace(" ", "T")).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";
export const label = (s) => (s ? s.replace(/[_.]/g, " ").replace(/^\w/, (c) => c.toUpperCase()) : "—");
export const pageNum = (v) => Math.max(1, Number(v) || 1);

export const PAGE_SIZES = [10, 20, 50, 100];
export const pageSizeNum = (v, def = 20) => {
  const n = Number(v);
  return PAGE_SIZES.includes(n) ? n : def;
};
// For report tables whose rows are already in memory.
export const paginate = (rows, sp = {}, def = 20) => {
  const pageSize = pageSizeNum(sp.pageSize, def);
  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(pageNum(sp.page), pages);
  return { rows: rows.slice((page - 1) * pageSize, page * pageSize), total, page, pageSize };
};
