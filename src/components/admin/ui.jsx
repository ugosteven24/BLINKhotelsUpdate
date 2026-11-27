import Link from "next/link";
import { label } from "@/lib/format";
import LiveForm from "./LiveForm";

const TONE = {
  active: "ok", approved: "ok", successful: "ok", completed: "ok", processed: "ok", released: "ok",
  pending: "warn", pending_approval: "warn", pending_payment: "warn", processing: "warn", initiated: "warn", received: "warn", invited: "warn", draft: "warn",
  rejected: "bad", failed: "bad", suspended: "bad", cancelled: "bad", expired: "bad", abandoned: "bad", inactive: "bad",
  checked_in: "info", refunded: "info", partially_refunded: "info",
};
export const Badge = ({ v }) => (
  <span className={`adm-badge ${TONE[v ?? ""] ?? ""}`}>{label(v)}</span>
);

export const Header = ({ title, sub, children }) => (
  <>
    <div className="adm-head"><div><h1>{title}</h1>{sub && <p className="adm-sub">{sub}</p>}</div>
    <div className="adm-inline">{children}</div>
    </div>
  </>
);

export const Stat = ({ title, value, alert, href }) => {
  const inner = <div className={`adm-stat${alert ? " alert" : ""}`}><span>{title}</span><b>{value}</b></div>;
  return href ? <Link href={href}>{inner}</Link> : inner;
};


export function Table({ cols, rows, empty = "Nothing to show yet." }) {
  if (!rows.length) return <div className="adm-tablewrap"><div className="adm-empty">{empty}</div></div>;
  return (
    <div className="adm-tablewrap">
      <table>
        <thead><tr>{cols.map((c) => <th key={c.head} className={c.right ? "r" : ""}>{c.head}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{cols.map((c) => <td key={c.head} className={c.right ? "r" : ""}>{c.cell(r)}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

export function Pager({ base, page, pageSize, total, params = {} }) {
  if (!total) return null;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const href = (p, size = pageSize) => {
    const sp = new URLSearchParams();
    Object.entries({ ...params, page: String(p), pageSize: String(size) }).forEach(([k, v]) => v && sp.set(k, v));
    return `${base}?${sp}`;
  };
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  const items = [];
  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || Math.abs(i - page) <= 1) items.push(i);
    else if (items[items.length - 1] !== "gap") items.push("gap");
  }

  return (
    <nav className="adm-pager" aria-label="Pagination">
      <span className="adm-pager-info">Showing {from.toLocaleString()}–{to.toLocaleString()} of {total.toLocaleString()}</span>
      {pages > 1 && (
        <div className="adm-pages">
          {page > 1 ? <Link href={href(page - 1)} aria-label="Previous page">Previous</Link> : <span className="off">Previous</span>}
          {items.map((it, i) =>
            it === "gap" ? <span key={`g${i}`} className="gap">…</span> :
            it === page ? <span key={it} className="cur" aria-current="page">{it}</span> :
            <Link key={it} href={href(it)} aria-label={`Page ${it}`}>{it}</Link>
          )}
          {page < pages ? <Link href={href(page + 1)} aria-label="Next page">Next</Link> : <span className="off">Next</span>}
        </div>
      )}
      <div className="adm-sizes">
        <span>Rows</span>
        {[10, 20, 50, 100].map((n) => (
          n === pageSize ? <span key={n} className="cur">{n}</span> : <Link key={n} href={href(1, n)}>{n}</Link>
        ))}
      </div>
    </nav>
  );
}

// Filter bar. A plain GET form that LiveForm upgrades: results update as you type (after a short pause) and on any
// dropdown/date change; with JavaScript off it still works through the Apply button.
// The search box shows whenever a page passes the `q` prop, even when it is
// undefined (a fresh page load has no ?q= yet). Pages that don't pass `q` get no search box.
export function Filters(props) {
  const { q, status, statuses, extra, dates, values } = props;
  const hasSearch = "q" in props;
  return (
    <LiveForm>
      {hasSearch && <input type="search" name="q" defaultValue={q ?? ""} placeholder="Search" aria-label="Search" autoComplete="off" />}
      {statuses && (
        <select name="status" defaultValue={status ?? ""} aria-label="Status">
          <option value="">All statuses</option>
          {statuses.map((s) => <option key={s} value={s}>{label(s)}</option>)}
        </select>
      )}
      {extra}
      {dates && (<>
        <input type="date" name="from" defaultValue={values?.from} aria-label="From date" />
        <input type="date" name="to" defaultValue={values?.to} aria-label="To date" />
      </>)}
      <button className="adm-btn" type="submit">Apply</button>
    </LiveForm>
  );
}

export function Bars({ data, fmt }) {
  if (!data.length) return <div className="adm-empty">No data in this period.</div>;
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <>
      <div className="adm-bars" role="img" aria-label="Bar chart">
        {data.map((d, i) => <div key={i} className="adm-bar" style={{ height: `${(d.value / max) * 100}%` }} title={`${d.label}: ${fmt ? fmt(d.value) : d.value}`} />)}
      </div>
      <div className="adm-barlab">{data.map((d, i) => <span key={i}>{data.length <= 16 || i % Math.ceil(data.length / 12) === 0 ? d.label : ""}</span>)}</div>
    </>
  );
}

export const ConfirmButton = ({ children, msg, className = "adm-btn danger sm" }) => (
  <button className={className} type="submit" data-confirm={msg}>{children}</button>
);