"use server";

import { query, queryOne } from "@/lib/db";
import { requireAdmin } from "@/lib/guard";
import { payoutOverview } from "./payouts";

const COUNTED = "('approved','checked_in','completed')";
const PAID = "('successful','partially_refunded','refunded')";

// Everything below is aggregated from live tables - nothing is hardcoded.
// Definitions: "gross booking value" = total_amount of approved/checked-in/completed reservations;
// "payments received" = verified payments (paid_at set); "commission" = the snapshot stored on each reservation.
export async function getDashboard() {
  await requireAdmin();
  const [totals, pending, status, series, regGrowth, byState, topHotels, recent, recentHotels, recentPayments, recentActivity, payouts] = await Promise.all([
    queryOne(`
      SELECT
        (SELECT COUNT(*) FROM hotels) AS hotels,
        (SELECT COUNT(*) FROM hotels WHERE approval_status='approved') AS active_hotels,
        (SELECT COUNT(*) FROM hotels WHERE approval_status='pending') AS pending_hotels,
        (SELECT COUNT(*) FROM hotels WHERE approval_status='rejected') AS rejected_hotels,
        (SELECT COUNT(*) FROM hotels WHERE approval_status='suspended') AS suspended_hotels,
        (SELECT COUNT(*) FROM users u JOIN roles r ON r.id=u.role_id WHERE r.role_key='customer') AS customers,
        (SELECT COUNT(*) FROM users u JOIN roles r ON r.id=u.role_id WHERE r.role_key='hotel_owner') AS owners,
        (SELECT COUNT(*) FROM users u JOIN roles r ON r.id=u.role_id WHERE r.role_key='hotel_staff') AS staff,
        (SELECT COUNT(*) FROM reservations) AS reservations,
        (SELECT COUNT(*) FROM reservations WHERE status='pending_approval') AS res_pending_approval,
        (SELECT COUNT(*) FROM reservations WHERE status='pending_payment') AS res_pending_payment,
        (SELECT COUNT(*) FROM reservations WHERE status='approved') AS res_approved,
        (SELECT COUNT(*) FROM reservations WHERE status='cancelled') AS res_cancelled,
        (SELECT COUNT(*) FROM payments WHERE status IN ${PAID}) AS payments_count,
        (SELECT COALESCE(SUM(amount),0) FROM payments WHERE status IN ${PAID}) AS gross_paid,
        (SELECT COALESCE(SUM(total_amount),0) FROM reservations WHERE status IN ${COUNTED}) AS booking_value,
        (SELECT COALESCE(SUM(commission_amount),0) FROM reservations WHERE status IN ${COUNTED}) AS commission`),
    queryOne(`
      SELECT
        (SELECT COUNT(*) FROM hotels WHERE approval_status='pending') AS hotels,
        (SELECT COUNT(*) FROM reservations WHERE status='pending_approval') AS reservations,
        (SELECT COUNT(*) FROM refunds WHERE status IN ('pending','processing')) AS refunds,
        (SELECT COUNT(*) FROM payouts WHERE status IN ('requested','under_review')) AS payouts,
        (SELECT COUNT(*) FROM hotel_bank_accounts WHERE verification_status='pending') AS bank_accounts,
        (SELECT COUNT(*) FROM payment_webhook_events WHERE processing_status='failed') AS failed_webhooks`),
    query(`SELECT status, COUNT(*) AS n FROM reservations GROUP BY status ORDER BY n DESC`),
    query(`
      SELECT d.day, COALESCE(b.bookings,0) AS bookings, COALESCE(p.collected,0) AS collected FROM (
        SELECT DATE(created_at) AS day FROM reservations WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)
        UNION SELECT DATE(paid_at) FROM payments WHERE paid_at >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)) d
      LEFT JOIN (SELECT DATE(created_at) AS day, COUNT(*) AS bookings FROM reservations GROUP BY DATE(created_at)) b ON b.day=d.day
      LEFT JOIN (SELECT DATE(paid_at) AS day, SUM(amount) AS collected FROM payments WHERE status IN ${PAID} GROUP BY DATE(paid_at)) p ON p.day=d.day
      WHERE d.day IS NOT NULL ORDER BY d.day`),
    query(`SELECT DATE_FORMAT(created_at,'%Y-%m') AS month, COUNT(*) AS n FROM hotels
            WHERE created_at >= DATE_SUB(DATE_FORMAT(CURDATE(),'%Y-%m-01'), INTERVAL 11 MONTH) GROUP BY month ORDER BY month`),
    query(`SELECT state, COUNT(*) AS n FROM hotels GROUP BY state ORDER BY n DESC LIMIT 8`),
    query(`SELECT h.id, h.hotel_name, COUNT(*) AS bookings, SUM(r.total_amount) AS value FROM reservations r JOIN hotels h ON h.id=r.hotel_id
            WHERE r.status IN ${COUNTED} GROUP BY h.id, h.hotel_name ORDER BY value DESC LIMIT 5`),
    query(`SELECT r.id, r.reservation_code, r.status, r.total_amount, r.currency, r.created_at, h.hotel_name, CONCAT(u.first_name,' ',u.last_name) AS guest
             FROM reservations r JOIN hotels h ON h.id=r.hotel_id JOIN users u ON u.id=r.user_id ORDER BY r.created_at DESC LIMIT 8`),
    query(`SELECT id, hotel_name, city, state, approval_status, created_at FROM hotels ORDER BY created_at DESC LIMIT 6`),
    query(`SELECT p.id, p.payment_reference, p.amount, p.currency, p.status, p.created_at FROM payments p ORDER BY p.created_at DESC LIMIT 6`),
    query(`SELECT a.action, a.entity_type, a.entity_id, a.created_at, CONCAT(u.first_name,' ',u.last_name) AS actor
             FROM audit_logs a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.created_at DESC LIMIT 8`),
    payoutOverview(),
  ]);
  return { totals, pending, status, series, regGrowth, byState, topHotels, recent, recentHotels, recentPayments, recentActivity, payouts };
}
