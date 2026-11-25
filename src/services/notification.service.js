"use server";

// In-app notifications for the signed-in user, and administrator broadcasts.

import { query, run, withTransaction } from "@/lib/db/connection";
import { ADMIN_ROLES, requireRole, requireUser } from "@/lib/auth/session";
import { iso, sanitizeDoc } from "@/lib/doc";
import { ServiceError, newId } from "@/lib/service-utils";
import { cleanString } from "@/lib/validation";
import { logActivity } from "@/lib/notify";

const mapNotification = (r) => ({
  id: r.id,
  category: r.category,
  title: r.title,
  message: r.message ?? "",
  icon: r.icon,
  type: r.type,
  read: !!r.is_read,
  actionUrl: r.action_url,
  createdAt: iso(r.created_at),
});

// The old page used a realtime listener; call this on load and on an interval.
export async function listMyNotifications() {
  const user = await requireUser();
  const rows = await query(
    "SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 200",
    [user.id]
  );
  return rows.map(mapNotification);
}

export async function markNotificationRead(id) {
  const user = await requireUser();
  await query("UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?", [id, user.id]);
  return { ok: true };
}

export async function markAllNotificationsRead() {
  const user = await requireUser();
  await query("UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0", [user.id]);
  return { ok: true };
}

const AUDIENCES = {
  "All Users": null,
  Guests: ["client"],
  "Hotel Owners": ["hotel_owner"],
  Staff: ["staff"],
  Admins: ["admin", "superadmin"],
};

// Admin "Send notification" page: one notification row per recipient.
export async function sendNotifications(form) {
  const admin = await requireRole(ADMIN_ROLES);
  const doc = sanitizeDoc(form);

  const title = cleanString(doc.title, 255);
  const message = cleanString(doc.message, 4000);
  if (!title || !message) throw new ServiceError("Title and message are required.");
  if (!Object.hasOwn(AUDIENCES, doc.audience ?? "All Users")) throw new ServiceError("Invalid audience.");

  const roles = AUDIENCES[doc.audience ?? "All Users"];
  const actionUrl = /^\/[A-Za-z0-9/_\-?=&#.]*$/.test(doc.actionUrl ?? "") ? doc.actionUrl : null; // internal paths only
  const sendNow = (doc.status ?? "Send Now") === "Send Now";

  let delivered = 0;
  await withTransaction(async (connection) => {
    if (sendNow) {
      const where = roles ? `AND role IN (${roles.map(() => "?").join(",")})` : "";
      const result = await run(
        connection,
        `INSERT INTO notifications (id, user_id, title, message, category, type, icon, action_url)
         SELECT UUID(), id, ?, ?, 'account', ?, 'notifications', ? FROM users WHERE status = 'active' ${where}`,
        [title, message, cleanString(doc.type, 40) || "General", actionUrl, ...(roles ?? [])]
      );
      delivered = result.affectedRows;
    }

    await run(connection, `INSERT INTO records (collection, id, data) VALUES ('pushNotifications', ?, ?)`, [
      newId(),
      JSON.stringify({
        title, message, audience: doc.audience ?? "All Users", type: doc.type ?? "General",
        priority: doc.priority ?? "Normal", status: doc.status ?? "Send Now",
        sentBy: admin.fullName || admin.email, recipients: delivered, deliveryRate: sendNow ? 100 : 0, clickRate: 0,
      }),
    ]);
    await logActivity(connection, admin, `Sent notification "${title}"`, "Notifications");
  });

  return { ok: true, delivered };
}


////////////////////////CLAUSE END///////////////////////////

async function authorizeAdmin() {
  return requireRole(ADMIN_ROLES);
}

// Search registered users.
export async function searchNotificationUsers(searchTerm = "") {
  await authorizeAdmin();

  const search = String(searchTerm).trim();

  if (search.length < 2) {
    return [];
  }

  const users = await query(
    `SELECT
        id,
        first_name,
        last_name,
        email,
        status
     FROM users
     WHERE first_name LIKE ?
        OR last_name LIKE ?
        OR email LIKE ?
     ORDER BY first_name ASC
     LIMIT 20`,
    [`%${search}%`, `%${search}%`, `%${search}%`]
  );

  return users.map((user) => ({
    id: String(user.id),
    firstName: user.first_name,
    lastName: user.last_name,
    email: user.email,
    status: user.status,
  }));
}

// Send notification to one user or every registered user.
export async function sendNotification(formData) {
  await authorizeAdmin();

  const recipientType = String(formData.recipientType || "");
  const userId = String(formData.userId || "").trim();

  const title = String(formData.title || "").trim();
  const message = String(formData.message || "").trim();

  const category = String(formData.category || "general").trim();
  const type = String(formData.type || "info").trim();
  const icon = String(formData.icon || "notifications").trim();
  const actionUrl = String(formData.actionUrl || "").trim();

  if (!["specific", "all"].includes(recipientType)) {
    throw new Error("Invalid recipient selection.");
  }

  if (!title || title.length > 255) {
    throw new Error("Title is required and must not exceed 255 characters.");
  }

  if (!message || message.length > 10000) {
    throw new Error("Message is required and must not exceed 10,000 characters.");
  }

  if (!category || category.length > 40) {
    throw new Error("Invalid notification category.");
  }

  if (!["info", "success", "warning", "error", "general"].includes(type)) {
    throw new Error("Invalid notification type.");
  }

  if (!icon || icon.length > 60) {
    throw new Error("Icon must not exceed 60 characters.");
  }

  if (actionUrl) {
    const isRelativePath =
      actionUrl.startsWith("/") && !actionUrl.startsWith("//");

    const isHttpsUrl = /^https:\/\/[^\s]+$/i.test(actionUrl);

    if ((!isRelativePath && !isHttpsUrl) || actionUrl.length > 1024) {
      throw new Error("Enter a valid relative path or HTTPS URL.");
    }
  }

  if (recipientType === "specific" && !/^\d+$/.test(userId)) {
    throw new Error("Please select a valid user.");
  }

  return withTransaction(async (connection) => {
    if (recipientType === "specific") {
      const result = await run(
        connection,
        `INSERT INTO notifications (
            user_id,
            title,
            message,
            category,
            type,
            icon,
            action_url
         )
         SELECT
            id, ?, ?, ?, ?, ?, ?
         FROM users
         WHERE id = ?
         LIMIT 1`,
        [
          title,
          message,
          category,
          type,
          icon,
          actionUrl || null,
          userId,
        ]
      );

      if (result.affectedRows !== 1) {
        throw new Error("The selected user does not exist.");
      }

      return {
        success: true,
        recipientCount: 1,
        message: "Notification sent successfully.",
      };
    }

    const result = await run(
      connection,
      `INSERT INTO notifications (
          user_id,
          title,
          message,
          category,
          type,
          icon,
          action_url
       )
       SELECT
          id, ?, ?, ?, ?, ?, ?
       FROM users`,
      [
        title,
        message,
        category,
        type,
        icon,
        actionUrl || null,
      ]
    );

    if (result.affectedRows === 0) {
      throw new Error("There are no registered users to notify.");
    }

    return {
      success: true,
      recipientCount: result.affectedRows,
      message: `Notification sent to ${result.affectedRows} users.`,
    };
  });
}
// Add to src/app/admin/notifications/actions.js

// VIEW NOTIFICATIONS
export async function getNotifications() {
  await authorizeAdmin();

  const rows = await query(
    `SELECT
        n.id,
        n.user_id,
        n.title,
        n.message,
        n.category,
        n.type,
        n.icon,
        n.action_url,
        n.is_read,
        DATE_FORMAT(n.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
        u.first_name,
        u.last_name,
        u.email
     FROM notifications n
     LEFT JOIN users u ON u.id = n.user_id
     ORDER BY n.created_at DESC, n.id DESC
     LIMIT 100`
  );

  return rows.map((row) => ({
    id: String(row.id),
    userId: String(row.user_id),
    title: row.title,
    message: row.message || "",
    category: row.category,
    type: row.type,
    icon: row.icon,
    actionUrl: row.action_url || "",
    isRead: Boolean(row.is_read),
    createdAt: row.created_at,
    firstName: row.first_name || "",
    lastName: row.last_name || "",
    email: row.email || "",
  }));
}


// EDIT NOTIFICATION
export async function updateNotification(formData) {
  await authorizeAdmin();

  const id = String(formData.id || "").trim();
  const title = String(formData.title || "").trim();
  const message = String(formData.message || "").trim();
  const category = String(formData.category || "").trim();
  const type = String(formData.type || "").trim();
  const icon = String(formData.icon || "").trim();
  const actionUrl = String(formData.actionUrl || "").trim();

  if (!/^\d+$/.test(id)) {
    throw new Error("Invalid notification ID.");
  }

  if (!title || title.length > 255) {
    throw new Error("Title is required and must not exceed 255 characters.");
  }

  if (!message || message.length > 10000) {
    throw new Error("Message is required and must not exceed 10,000 characters.");
  }

  if (!category || category.length > 40) {
    throw new Error("Invalid notification category.");
  }

  if (!["info", "success", "warning", "error", "general"].includes(type)) {
    throw new Error("Invalid notification type.");
  }

  if (!icon || icon.length > 60) {
    throw new Error("Icon must not exceed 60 characters.");
  }

  if (actionUrl) {
    const isRelativePath =
      actionUrl.startsWith("/") && !actionUrl.startsWith("//");

    const isHttpsUrl = /^https:\/\/[^\s]+$/i.test(actionUrl);

    if ((!isRelativePath && !isHttpsUrl) || actionUrl.length > 1024) {
      throw new Error("Enter a valid relative path or HTTPS URL.");
    }
  }

  const result = await query(
    `UPDATE notifications
     SET title = ?,
         message = ?,
         category = ?,
         type = ?,
         icon = ?,
         action_url = ?
     WHERE id = ?`,
    [
      title,
      message,
      category,
      type,
      icon,
      actionUrl || null,
      id,
    ]
  );

  if (result.affectedRows === 0) {
    const existing = await query(
      "SELECT id FROM notifications WHERE id = ? LIMIT 1",
      [id]
    );

    if (!existing.length) {
      throw new Error("Notification not found.");
    }
  }

  return {
    success: true,
    message: "Notification updated successfully.",
  };
}


// DELETE NOTIFICATION
export async function deleteNotification(id) {
  await authorizeAdmin();

  const notificationId = String(id || "").trim();

  if (!/^\d+$/.test(notificationId)) {
    throw new Error("Invalid notification ID.");
  }

  const result = await query(
    "DELETE FROM notifications WHERE id = ?",
    [notificationId]
  );

  if (result.affectedRows === 0) {
    throw new Error("Notification not found or already deleted.");
  }

  return {
    success: true,
    message: "Notification deleted successfully.",
  };
}