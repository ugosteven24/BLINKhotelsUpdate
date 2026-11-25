
"use client";
import Link from "next/link";
import { listHotels, deleteHotelAction } from "@/services/admin/hotels";
import { Header, Table, Badge, Pager, Filters } from "@/components/admin/ui";
import RowActions from "@/components/admin/RowActions";
import { d, label, pageNum, pageSizeNum } from "@/lib/format";
import { useState, useTransition } from "react";
import {
  Bell,
  Search,
  Send,
  Users,
  User,
  CheckCircle,
  AlertCircle,
  LoaderCircle,
  X,
} from "lucide-react";

import {
  searchNotificationUsers,
  sendNotification,
} from "@/services/notification.service";

export default function NotificationManager() {
  const [recipientType, setRecipientType] = useState("specific");
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState("general");
  const [type, setType] = useState("info");
  const [icon, setIcon] = useState("notifications");
  const [actionUrl, setActionUrl] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [isSearching, startSearch] = useTransition();
  const [isSending, startSending] = useTransition();

  function handleSearch() {
    setError("");
    setSuccess("");

    if (search.trim().length < 2) {
      setError("Enter at least two characters to search.");
      return;
    }

    startSearch(async () => {
      try {
        const results = await searchNotificationUsers(search);
        setUsers(results);
      } catch (err) {
        setError(err.message || "Unable to search users.");
      }
    });
  }

  function handleSend(e) {
    e.preventDefault();

    setError("");
    setSuccess("");

    if (recipientType === "specific" && !selectedUser) {
      setError("Please select a recipient.");
      return;
    }

    if (!title.trim() || !message.trim()) {
      setError("Title and message are required.");
      return;
    }

    const formData = {
      recipientType,
      userId: selectedUser?.id || "",
      title,
      message,
      category,
      type,
      icon,
      actionUrl,
    };

    startSending(async () => {
      try {
        const result = await sendNotification(formData);

        setSuccess(
          `Notification sent successfully to ${result.recipientCount} ${
            result.recipientCount === 1 ? "user" : "users"
          }.`
        );

        setTitle("");
        setMessage("");
        setActionUrl("");
        setSelectedUser(null);
        setSearch("");
        setUsers([]);
      } catch (err) {
        setError(err.message || "Failed to send notification.");
      }
    });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">

      <div>
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
            <Bell size={24} />
          </div>

          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Notifications
            </h1>
            <p className="text-sm text-gray-500">
              Create and send notifications to platform users.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle size={18} />
          <span>{error}</span>
          <button
            type="button"
            className="ml-auto"
            onClick={() => setError("")}
          >
            <X size={17} />
          </button>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">
          <CheckCircle size={18} />
          {success}
        </div>
      )}

      <form onSubmit={handleSend} className="space-y-6">

        {/* Recipients */}
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-semibold text-gray-900">
            Select recipients
          </h2>

          <div className="grid gap-3 sm:grid-cols-2">

            <button
              type="button"
              onClick={() => {
                setRecipientType("specific");
                setSuccess("");
                setError("");
              }}
              className={`flex items-center gap-3 rounded-lg border p-4 text-left transition ${
                recipientType === "specific"
                  ? "border-blue-600 bg-blue-50"
                  : "border-gray-200 hover:bg-gray-50"
              }`}
            >
              <User className="text-blue-600" />

              <div>
                <p className="font-medium text-gray-900">
                  Specific user
                </p>
                <p className="text-xs text-gray-500">
                  Send to one registered user.
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setRecipientType("all");
                setSelectedUser(null);
                setUsers([]);
                setSuccess("");
                setError("");
              }}
              className={`flex items-center gap-3 rounded-lg border p-4 text-left transition ${
                recipientType === "all"
                  ? "border-blue-600 bg-blue-50"
                  : "border-gray-200 hover:bg-gray-50"
              }`}
            >
              <Users className="text-blue-600" />

              <div>
                <p className="font-medium text-gray-900">
                  All users
                </p>
                <p className="text-xs text-gray-500">
                  Send to every registered account.
                </p>
              </div>
            </button>

          </div>

          {recipientType === "specific" && (
            <div className="mt-5 space-y-3">

              <label className="block text-sm font-medium text-gray-700">
                Search user
              </label>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSearch();
                    }
                  }}
                  placeholder="Search by name or email"
                  className="min-w-0 flex-1 rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />

                <button
                  type="button"
                  onClick={handleSearch}
                  disabled={isSearching}
                  className="flex items-center gap-2 rounded-lg bg-gray-900 px-4 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                >
                  {isSearching ? (
                    <LoaderCircle size={17} className="animate-spin" />
                  ) : (
                    <Search size={17} />
                  )}
                  Search
                </button>
              </div>

              {users.length > 0 && (
                <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-200">

                  {users.map((user) => (
                    <button
                      type="button"
                      key={user.id}
                      onClick={() => setSelectedUser(user)}
                      className={`flex w-full items-center justify-between border-b border-gray-100 p-3 text-left last:border-0 hover:bg-gray-50 ${
                        selectedUser?.id === user.id
                          ? "bg-blue-50"
                          : ""
                      }`}
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {user.firstName} {user.lastName}
                        </p>
                        <p className="text-xs text-gray-500">
                          {user.email}
                        </p>
                        <p className="mt-1 text-xs capitalize text-gray-400">
                          {user.status}
                        </p>
                      </div>

                      {selectedUser?.id === user.id && (
                        <CheckCircle size={19} className="text-blue-600" />
                      )}
                    </button>
                  ))}

                </div>
              )}

              {users.length === 0 && search.length >= 2 && !isSearching && (
                <p className="text-sm text-gray-500">
                  No search results yet. Click Search to find users.
                </p>
              )}

              {selectedUser && (
                <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 p-3">
                  <div>
                    <p className="text-sm font-semibold text-blue-900">
                      {selectedUser.firstName} {selectedUser.lastName}
                    </p>
                    <p className="text-xs text-blue-700">
                      {selectedUser.email}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedUser(null)}
                    className="text-blue-700 hover:text-red-600"
                  >
                    <X size={18} />
                  </button>
                </div>
              )}

            </div>
          )}

          {recipientType === "all" && (
            <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              This notification will be inserted for every registered user,
              including inactive accounts. Please verify your message before
              sending.
            </div>
          )}

        </section>

        {/* Notification details */}
        <section className="space-y-5 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">

          <h2 className="font-semibold text-gray-900">
            Notification details
          </h2>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Title *
            </label>

            <input
              type="text"
              maxLength={255}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter notification title"
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Message *
            </label>

            <textarea
              rows={5}
              maxLength={10000}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write your notification message..."
              className="w-full resize-y rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />

            <p className="mt-1 text-right text-xs text-gray-400">
              {message.length}/10000
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Category
              </label>

              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
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
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Notification type
              </label>

              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
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
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Icon name
            </label>

            <input
              type="text"
              maxLength={60}
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="notifications"
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
            />

            <p className="mt-1 text-xs text-gray-400">
              Example: notifications, calendar, hotel, shield-check.
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Action URL (optional)
            </label>

            <input
              type="text"
              maxLength={1024}
              value={actionUrl}
              onChange={(e) => setActionUrl(e.target.value)}
              placeholder="/dashboard/bookings"
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
            />

            <p className="mt-1 text-xs text-gray-400">
              Where users should go when they click the notification.
            </p>
          </div>

        </section>

        {/* Submit */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={
              isSending ||
              !title.trim() ||
              !message.trim() ||
              (recipientType === "specific" && !selectedUser)
            }
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {isSending ? (
              <>
                <LoaderCircle size={18} className="animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send size={18} />
                Send notification
              </>
            )}
          </button>
        </div>

      </form>
    </div>
  );
}
