// Internal helpers: in-app notifications and the admin activity log.
// Not a "use server" file.
import { run } from "@/lib/db/connection";
import { newId } from "@/lib/service-utils";

export async function notifyUser(connection, userId, { title, message = "", category = "booking", type = "general", icon = "notifications", actionUrl = null }) {
  await run(
    connection,
    `INSERT INTO notifications (id, user_id, title, message, category, type, icon, action_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [newId(), userId, String(title).slice(0, 255), message, category, type, icon, actionUrl]
  );
}

export async function logActivity(connection, user, action, moduleName) {
  try {
    await run(
      connection,
      `INSERT INTO records (collection, id, data) VALUES ('activityLogs', ?, ?)`,
      [
        newId(),
        JSON.stringify({
          user: user?.fullName || user?.email || "System",
          email: user?.email || "",
          action,
          module: moduleName,
          status: "Success",
        }),
      ]
    );
  } catch (error) {
    console.error("activity log failed:", error);
  }
}
