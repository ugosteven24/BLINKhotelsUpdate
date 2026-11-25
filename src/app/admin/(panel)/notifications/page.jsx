"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Search,
  Eye,
  Pencil,
  Trash2,
  X,
  Bell,
  LoaderCircle,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  User,
  Calendar,
} from "lucide-react";

import {
  getNotifications,
  updateNotification,
  deleteNotification,
} from "@/services/notification.service";

const initialForm = {
  id: "",
  title: "",
  message: "",
  category: "general",
  type: "info",
  icon: "notifications",
  actionUrl: "",
};

const inputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

function formatDate(value) {
  if (!value) return "Unknown date";

  const date = new Date(value.replace(" ", "T") + "Z");

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString();
}

function TypeBadge({ type }) {
  const styles = {
    info: "bg-blue-50 text-blue-700",
    success: "bg-green-50 text-green-700",
    warning: "bg-amber-50 text-amber-700",
    error: "bg-red-50 text-red-700",
    general: "bg-gray-100 text-gray-700",
  };

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${
        styles[type] || styles.general
      }`}
    >
      {type}
    </span>
  );
}

export default function NotificationList() {
  const [notifications, setNotifications] = useState([]);
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [viewing, setViewing] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [deletingNotification, setDeletingNotification] =
    useState(null);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await getNotifications();
      setNotifications(result);
    } catch (err) {
      setError(err.message || "Unable to load notifications.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  function openEdit(notification) {
    setForm({
      id: notification.id,
      title: notification.title,
      message: notification.message,
      category: notification.category,
      type: notification.type,
      icon: notification.icon,
      actionUrl: notification.actionUrl,
    });

    setViewing(null);
    setEditing(true);
    setError("");
    setSuccess("");
  }

  function closeEdit() {
    setEditing(false);
    setForm(initialForm);
  }

  async function handleUpdate(e) {
    e.preventDefault();

    setError("");
    setSuccess("");

    if (!form.title.trim() || !form.message.trim()) {
      setError("Title and message are required.");
      return;
    }

    setSaving(true);

    try {
      await updateNotification(form);

      setSuccess("Notification updated successfully.");
      closeEdit();
      await loadNotifications();
    } catch (err) {
      setError(err.message || "Unable to update notification.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deletingNotification) return;

    setDeleting(true);
    setError("");
    setSuccess("");

    try {
      await deleteNotification(deletingNotification.id);

      setSuccess("Notification deleted successfully.");
      setDeletingNotification(null);
      setViewing(null);

      await loadNotifications();
    } catch (err) {
      setError(err.message || "Unable to delete notification.");
    } finally {
      setDeleting(false);
    }
  }

  const filteredNotifications = notifications.filter((item) => {
    const searchText = search.toLowerCase();

    return [
      item.title,
      item.message,
      item.category,
      item.type,
      item.email,
      item.firstName,
      item.lastName,
    ]
      .join(" ")
      .toLowerCase()
      .includes(searchText);
  });

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-lg font-bold text-gray-900">
            Sent notifications
          </h2>

          <p className="text-sm text-gray-500">
            View, edit and manage notifications sent to users.
          </p>
        </div>

        <button
          type="button"
          onClick={loadNotifications}
          disabled={loading}
          className="flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw
            size={16}
            className={loading ? "animate-spin" : ""}
          />
          Refresh
        </button>
      </div>

      {/* Messages */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          <CheckCircle size={18} />
          {success}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search
          size={18}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        />

        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search notifications, messages or recipients..."
          className="w-full rounded-lg border border-gray-300 py-3 pl-10 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
      </div>

      {/* Count */}
      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>
          {filteredNotifications.length} notification
          {filteredNotifications.length !== 1 ? "s" : ""}
        </span>

        <span>Latest 100 records</span>
      </div>

      {/* List */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">

        {loading ? (
          <div className="flex min-h-48 items-center justify-center gap-3 text-sm text-gray-500">
            <LoaderCircle className="animate-spin" size={20} />
            Loading notifications...
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="flex min-h-52 flex-col items-center justify-center p-6 text-center">
            <Bell size={35} className="mb-3 text-gray-300" />

            <h3 className="font-semibold text-gray-800">
              No notifications found
            </h3>

            <p className="mt-1 text-sm text-gray-500">
              Notifications you send will appear here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">

            {filteredNotifications.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 gap-3">

                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                    <Bell size={19} />
                  </div>

                  <div className="min-w-0">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <h3 className="truncate font-semibold text-gray-900">
                        {item.title}
                      </h3>

                      <TypeBadge type={item.type} />
                    </div>

                    <p className="line-clamp-2 text-sm text-gray-500">
                      {item.message}
                    </p>

                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <User size={13} />
                        {item.firstName
                          ? `${item.firstName} ${item.lastName}`
                          : "Unknown user"}
                      </span>

                      <span className="flex items-center gap-1">
                        <Calendar size={13} />
                        {formatDate(item.createdAt)}
                      </span>

                      <span className="capitalize">
                        {item.category}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex shrink-0 items-center gap-2">

                  <button
                    type="button"
                    title="View notification"
                    onClick={() => setViewing(item)}
                    className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-50 hover:text-blue-600"
                  >
                    <Eye size={17} />
                  </button>

                  <button
                    type="button"
                    title="Edit notification"
                    onClick={() => openEdit(item)}
                    className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-blue-50 hover:text-blue-600"
                  >
                    <Pencil size={17} />
                  </button>

                  <button
                    type="button"
                    title="Delete notification"
                    onClick={() => setDeletingNotification(item)}
                    className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 size={17} />
                  </button>

                </div>
              </div>
            ))}

          </div>
        )}
      </div>

      {/* VIEW MODAL */}
      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
          <div className="my-auto w-full max-w-lg rounded-xl bg-white shadow-xl">

            <div className="flex items-center justify-between border-b border-gray-100 p-5">
              <h3 className="font-bold text-gray-900">
                Notification details
              </h3>

              <button
                type="button"
                onClick={() => setViewing(null)}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
              >
                <X size={19} />
              </button>
            </div>

            <div className="space-y-5 p-5">

              <div>
                <p className="mb-1 text-xs font-medium uppercase text-gray-400">
                  Title
                </p>

                <h2 className="text-lg font-bold text-gray-900">
                  {viewing.title}
                </h2>
              </div>

              <div>
                <p className="mb-1 text-xs font-medium uppercase text-gray-400">
                  Message
                </p>

                <p className="whitespace-pre-wrap text-sm leading-6 text-gray-700">
                  {viewing.message}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="mb-1 text-xs text-gray-400">Category</p>
                  <p className="text-sm capitalize text-gray-800">
                    {viewing.category}
                  </p>
                </div>

                <div>
                  <p className="mb-1 text-xs text-gray-400">Type</p>
                  <TypeBadge type={viewing.type} />
                </div>

                <div>
                  <p className="mb-1 text-xs text-gray-400">Recipient</p>
                  <p className="text-sm text-gray-800">
                    {viewing.firstName
                      ? `${viewing.firstName} ${viewing.lastName}`
                      : "Unknown user"}
                  </p>
                  <p className="break-all text-xs text-gray-500">
                    {viewing.email}
                  </p>
                </div>

                <div>
                  <p className="mb-1 text-xs text-gray-400">Read status</p>
                  <p className="text-sm text-gray-800">
                    {viewing.isRead ? "Read" : "Unread"}
                  </p>
                </div>

                <div>
                  <p className="mb-1 text-xs text-gray-400">Date created</p>
                  <p className="text-sm text-gray-800">
                    {formatDate(viewing.createdAt)}
                  </p>
                </div>

                <div>
                  <p className="mb-1 text-xs text-gray-400">Icon</p>
                  <p className="text-sm text-gray-800">
                    {viewing.icon}
                  </p>
                </div>
              </div>

              {viewing.actionUrl && (
                <div>
                  <p className="mb-1 text-xs text-gray-400">Action URL</p>
                  <p className="break-all text-sm text-blue-600">
                    {viewing.actionUrl}
                  </p>
                </div>
              )}

            </div>

            <div className="flex justify-end gap-2 border-t border-gray-100 p-4">
              <button
                type="button"
                onClick={() => openEdit(viewing)}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
              >
                <Pencil size={16} />
                Edit
              </button>
            </div>

          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
          <div className="my-auto w-full max-w-lg rounded-xl bg-white shadow-xl">

            <div className="flex items-center justify-between border-b border-gray-100 p-5">
              <h3 className="font-bold text-gray-900">
                Edit notification
              </h3>

              <button
                type="button"
                onClick={closeEdit}
                disabled={saving}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
              >
                <X size={19} />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-4 p-5">

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Title
                </label>

                <input
                  required
                  maxLength={255}
                  value={form.title}
                  onChange={(e) =>
                    setForm({ ...form, title: e.target.value })
                  }
                  className={inputClass}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Message
                </label>

                <textarea
                  required
                  rows={5}
                  maxLength={10000}
                  value={form.message}
                  onChange={(e) =>
                    setForm({ ...form, message: e.target.value })
                  }
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Category
                  </label>

                  <select
                    value={form.category}
                    onChange={(e) =>
                      setForm({ ...form, category: e.target.value })
                    }
                    className={inputClass}
                  >
                    <option value="general">General</option>
                    <option value="account">Account</option>
                    <option value="booking">Booking</option>
                    <option value="payment">Payment</option>
                    <option value="promotion">Promotion</option>
                    <option value="security">Security</option>
                    <option value="system">System</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Type
                  </label>

                  <select
                    value={form.type}
                    onChange={(e) =>
                      setForm({ ...form, type: e.target.value })
                    }
                    className={inputClass}
                  >
                    <option value="info">Information</option>
                    <option value="success">Success</option>
                    <option value="warning">Warning</option>
                    <option value="error">Error</option>
                    <option value="general">General</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Icon
                </label>

                <input
                  maxLength={60}
                  value={form.icon}
                  onChange={(e) =>
                    setForm({ ...form, icon: e.target.value })
                  }
                  className={inputClass}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Action URL
                </label>

                <input
                  maxLength={1024}
                  value={form.actionUrl}
                  onChange={(e) =>
                    setForm({ ...form, actionUrl: e.target.value })
                  }
                  className={inputClass}
                  placeholder="/dashboard/bookings"
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
                <button
                  type="button"
                  onClick={closeEdit}
                  disabled={saving}
                  className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving && (
                    <LoaderCircle size={16} className="animate-spin" />
                  )}
                  Save changes
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION */}
      {deletingNotification && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">

            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
              <Trash2 size={22} />
            </div>

            <h3 className="text-lg font-bold text-gray-900">
              Delete notification?
            </h3>

            <p className="mt-2 text-sm leading-6 text-gray-500">
              Are you sure you want to delete{" "}
              <strong className="text-gray-800">
                {deletingNotification.title}
              </strong>
              ? This action cannot be undone.
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeletingNotification(null)}
                className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={deleting}
                onClick={handleDelete}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting && (
                  <LoaderCircle size={16} className="animate-spin" />
                )}
                Delete
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}