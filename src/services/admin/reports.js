"use server";

import { query, queryOne } from "@/lib/db";
import { requireAdmin } from "@/lib/guard";


const range = (p) => {
  const to = p.to || new Date().toISOString().slice(0, 10);
  const from = p.from || new Date(Date.now() - 29 * 864e5).toISOString().slice(0, 10);
  return { from, to };
};
const REVENUE = "('approved','checked_in','completed')";

export async function bookingReport(p) {
  await requireAdmin();
  const { from, to } = range(p);
  const [summary, byStatus, daily] = await Promise.all([
    queryOne(
      `SELECT COUNT(*) AS total, COALESCE(AVG(total_nights),0) AS avg_nights, COALESCE(AVG(total_amount),0) AS avg_value
         FROM reservations WHERE DATE(created_at) BETWEEN ? AND ?`, [from, to]),
    query(
      `SELECT status, COUNT(*) AS count, COALESCE(SUM(total_amount),0) AS amount
         FROM reservations WHERE DATE(created_at) BETWEEN ? AND ? GROUP BY status ORDER BY count DESC`, [from, to]),
    query(
      `SELECT DATE(created_at) AS day, COUNT(*) AS bookings FROM reservations
        WHERE DATE(created_at) BETWEEN ? AND ? GROUP BY DATE(created_at) ORDER BY day`, [from, to]),
  ]);
  return { from, to, summary, byStatus, daily };
}

export async function hotelPerformanceReport(p) {
  await requireAdmin();
  const { from, to } = range(p);
  const like = `%${String(p.q ?? "").trim()}%`;
  const search = p.q ? "AND (h.hotel_name LIKE ? OR h.city LIKE ? OR h.state LIKE ?)" : "";
  const rows = await query(
    `SELECT h.id, h.hotel_name, h.city, h.commission_rate,
            COUNT(r.id) AS bookings,
            COALESCE(SUM(CASE WHEN r.status IN ${REVENUE} THEN r.total_amount END),0) AS revenue,
            COALESCE(SUM(CASE WHEN r.status IN ${REVENUE} THEN r.commission_amount END),0) AS commission,
            ROUND(100 * SUM(r.status IN ('rejected','expired','cancelled')) / NULLIF(COUNT(r.id),0), 1) AS drop_rate,
            (SELECT COUNT(*) FROM rooms rm WHERE rm.hotel_id=h.id AND rm.operational_status='active') AS active_rooms
       FROM hotels h
       LEFT JOIN reservations r ON r.hotel_id=h.id AND DATE(r.created_at) BETWEEN ? AND ?
      WHERE h.approval_status='approved' ${search}
      GROUP BY h.id ORDER BY revenue DESC LIMIT 1000`, [from, to, ...(p.q ? [like, like, like] : [])]);
  return { from, to, rows };
}

export async function revenueReport(p) {
  await requireAdmin();
  const { from, to } = range(p);
  const [totals, daily] = await Promise.all([
    queryOne(
      `SELECT COALESCE(SUM(total_amount),0) AS gross, COALESCE(SUM(taxes),0) AS taxes, COALESCE(SUM(fees),0) AS fees,
              COALESCE(SUM(discount),0) AS discounts, COALESCE(SUM(commission_amount),0) AS commission, COALESCE(SUM(hotel_amount),0) AS hotel_share
         FROM reservations WHERE status IN ${REVENUE} AND DATE(created_at) BETWEEN ? AND ?`, [from, to]),
    query(
      `SELECT DATE(created_at) AS day, SUM(total_amount) AS gross, SUM(commission_amount) AS commission
         FROM reservations WHERE status IN ${REVENUE} AND DATE(created_at) BETWEEN ? AND ?
        GROUP BY DATE(created_at) ORDER BY day`, [from, to]),
  ]);
  return { from, to, totals, daily };
}

export async function commissionReport(p) {
  await requireAdmin();
  const { from, to } = range(p);
  const like = `%${String(p.q ?? "").trim()}%`;
  const search = p.q ? "AND h.hotel_name LIKE ?" : "";
  const rows = await query(
    `SELECT h.id, h.hotel_name, r.commission_rate_snapshot AS rate, COUNT(*) AS bookings,
            SUM(r.total_amount) AS gross, SUM(r.commission_amount) AS commission, SUM(r.hotel_amount) AS payout
       FROM reservations r JOIN hotels h ON h.id=r.hotel_id
      WHERE r.status IN ${REVENUE} AND DATE(r.created_at) BETWEEN ? AND ? ${search}
      GROUP BY h.id, r.commission_rate_snapshot ORDER BY commission DESC`, [from, to, ...(p.q ? [like] : [])]);
  return { from, to, rows };
}

export async function customerReport(p) {
  await requireAdmin();
  const { from, to } = range(p);
  const like = `%${String(p.q ?? "").trim()}%`;
  const search = p.q ? "AND (CONCAT(u.first_name,' ',u.last_name) LIKE ? OR u.email LIKE ?)" : "";
  const [summary, top] = await Promise.all([
    queryOne(
      `SELECT (SELECT COUNT(*) FROM users u JOIN roles r ON r.id=u.role_id WHERE r.role_key='customer' AND DATE(u.created_at) BETWEEN ? AND ?) AS new_customers,
              (SELECT COUNT(DISTINCT user_id) FROM reservations WHERE DATE(created_at) BETWEEN ? AND ?) AS booking_customers,
              (SELECT COUNT(*) FROM (SELECT user_id FROM reservations WHERE status IN ${REVENUE} GROUP BY user_id HAVING COUNT(*) > 1) x) AS repeat_customers`,
      [from, to, from, to]),
    query(
      `SELECT u.id, CONCAT(u.first_name,' ',u.last_name) AS name, u.email, COUNT(r.id) AS bookings, SUM(r.total_amount) AS spend
         FROM reservations r JOIN users u ON u.id=r.user_id
        WHERE r.status IN ${REVENUE} AND DATE(r.created_at) BETWEEN ? AND ? ${search}
        GROUP BY u.id ORDER BY spend DESC LIMIT 500`, [from, to, ...(p.q ? [like, like] : [])]),
  ]);
  return { from, to, summary, top };
}

export async function paymentReport(p) {
  await requireAdmin();
  const { from, to } = range(p);
  const [byStatus, refunds, daily] = await Promise.all([
    query(
      `SELECT status, COUNT(*) AS count, COALESCE(SUM(amount),0) AS amount FROM payments
        WHERE DATE(created_at) BETWEEN ? AND ? GROUP BY status ORDER BY count DESC`, [from, to]),
    queryOne(
      `SELECT COUNT(*) AS count, COALESCE(SUM(amount),0) AS amount FROM refunds
        WHERE status='successful' AND DATE(created_at) BETWEEN ? AND ?`, [from, to]),
    query(
      `SELECT DATE(paid_at) AS day, SUM(amount) AS amount FROM payments
        WHERE status IN ('successful','partially_refunded','refunded') AND DATE(paid_at) BETWEEN ? AND ?
        GROUP BY DATE(paid_at) ORDER BY day`, [from, to]),
  ]);
  return { from, to, byStatus, refunds, daily };
}
