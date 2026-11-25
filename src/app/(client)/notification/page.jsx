
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Bell,
  BellOff,
  CalendarDays,
  CircleUserRound,
  Inbox,
  LockKeyhole,
  Tag,
  CheckCheck,
  ArrowUpRight,
} from "lucide-react";

import { getCurrentUser } from "@/services/auth.service";
import {
  listMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/services/notification.service";

const categoryDefinitions = [
  { id: "all", label: "All Alerts", icon: Inbox },
  { id: "booking", label: "Booking Updates", icon: CalendarDays },
  { id: "security", label: "Account Security", icon: LockKeyhole },
  { id: "offers", label: "Personalized Offers", icon: Tag },
  { id: "account", label: "Account", icon: CircleUserRound },
];

const notificationIconMap = {
  notifications: Bell,
  notification: Bell,
  inbox: Inbox,
  calendar_today: CalendarDays,
  event: CalendarDays,
  security: LockKeyhole,
  lock: LockKeyhole,
  sell: Tag,
  local_offer: Tag,
  account_circle: CircleUserRound,
  person: CircleUserRound,
};

function getNotificationIcon(notification) {
  const iconName = String(notification.icon ?? "").toLowerCase();

  return (
    notificationIconMap[iconName] ??
    (notification.category === "booking"
      ? CalendarDays
      : notification.category === "security"
        ? LockKeyhole
        : notification.category === "offers"
          ? Tag
          : notification.category === "account"
            ? CircleUserRound
            : Bell)
  );
}

function toDate(value) {
  if (!value) return null;

  if (typeof value?.toDate === "function") {
    const converted = value.toDate();

    return converted instanceof Date &&
      !Number.isNaN(converted.getTime())
      ? converted
      : null;
  }

  const date = value instanceof Date ? value : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function formatRelativeTime(value) {
  const date = toDate(value);

  if (!date) return "Recently";

  const seconds = Math.max(
    0,
    Math.floor((Date.now() - date.getTime()) / 1000)
  );

  if (seconds < 60) return "Just now";

  const minutes = Math.floor(seconds / 60);

  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);

  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);

  if (days === 1) return "Yesterday";

  if (days < 7) return `${days} days ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year:
      date.getFullYear() !== new Date().getFullYear()
        ? "numeric"
        : undefined,
  });
}

function normalizeNotification(id, data) {
  const createdAt = toDate(data.createdAt ?? data.timestamp);

  return {
    id,
    category: data.category ?? "account",
    title: data.title ?? "Notification",
    message: data.message ?? "",
    time: formatRelativeTime(createdAt),
    createdAt,
    icon: data.icon ?? "notifications",
    type: data.type ?? "general",
    unread:
      typeof data.read === "boolean"
        ? !data.read
        : Boolean(data.unread),
    action: data.action ?? null,
    actionUrl: data.actionUrl ?? data.link ?? null,
  };
}

function isSameCalendarDay(first, second) {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

function getSafeActionUrl(value) {
  if (typeof value !== "string" || !value.trim()) return null;

  const url = value.trim();

  if (!url.startsWith("/") || url.startsWith("//")) return null;

  return url;
}

export default function NotificationsPage() {
  const [activeCategory, setActiveCategory] = useState("all");
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [userId, setUserId] = useState(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [updatingIds, setUpdatingIds] = useState([]);

  // Load notifications and refresh every 30 seconds.
  useEffect(() => {
    let active = true;
    let loadingRequest = false;

    async function loadNotifications() {
      if (loadingRequest) return;

      loadingRequest = true;

      try {
        const user = await getCurrentUser();

        if (!active) return;

        if (!user) {
          setUserId(null);
          setNotifications([]);
          setError("Please sign in to view your notifications.");
          return;
        }

        setUserId(user.id);

        const rows = await listMyNotifications();

        if (!active) return;

        const items = rows.map((item) =>
          normalizeNotification(item.id, item)
        );

        items.sort((a, b) => {
          const aTime = a.createdAt?.getTime() ?? 0;
          const bTime = b.createdAt?.getTime() ?? 0;

          return bTime - aTime;
        });

        setNotifications(items);
        setError("");
      } catch (err) {
        console.error("Failed to load notifications:", err);

        if (active) {
          setError("Unable to load notifications. Please try again.");
        }
      } finally {
        loadingRequest = false;

        if (active) {
          setLoading(false);
        }
      }
    }

    loadNotifications();

    const timer = setInterval(loadNotifications, 30000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  // Category counts.
  const categories = categoryDefinitions.map((category) => ({
    ...category,
    count:
      category.id === "all"
        ? notifications.length
        : notifications.filter(
            (item) => item.category === category.id
          ).length,
  }));

  // Filter notifications.
  const filteredNotifications = notifications.filter(
    (notification) =>
      activeCategory === "all" ||
      notification.category === activeCategory
  );

  // Group notifications by date.
  const today = new Date();

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const todayNotifications = filteredNotifications.filter(
    (item) =>
      item.createdAt &&
      isSameCalendarDay(item.createdAt, today)
  );

  const yesterdayNotifications = filteredNotifications.filter(
    (item) =>
      item.createdAt &&
      isSameCalendarDay(item.createdAt, yesterday)
  );

  const olderNotifications = filteredNotifications.filter(
    (item) =>
      !item.createdAt ||
      (!isSameCalendarDay(item.createdAt, today) &&
        !isSameCalendarDay(item.createdAt, yesterday))
  );

  const unreadCount = notifications.filter(
    (item) => item.unread
  ).length;

  // Select category.
  function selectCategory(category) {
    setActiveCategory(category);
  }

  // Mark one notification as read.
  async function markAsRead(notification) {
    if (!notification.unread || !userId) return;

    setUpdatingIds((previous) =>
      previous.includes(notification.id)
        ? previous
        : [...previous, notification.id]
    );

    try {
      await markNotificationRead(notification.id);

      setNotifications((previous) =>
        previous.map((item) =>
          item.id === notification.id
            ? { ...item, unread: false }
            : item
        )
      );

      return true;
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
      setError("Unable to update notification status.");
      return false;
    } finally {
      setUpdatingIds((previous) =>
        previous.filter((id) => id !== notification.id)
      );
    }
  }

  // Mark all notifications as read.
  async function markAllAsRead() {
    if (!userId || markingAll || unreadCount === 0) return;

    setMarkingAll(true);
    setError("");

    try {
      await markAllNotificationsRead();

      setNotifications((previous) =>
        previous.map((item) => ({
          ...item,
          unread: false,
        }))
      );
    } catch (err) {
      console.error("Failed to mark all notifications as read:", err);

      setError(
        "Unable to mark all notifications as read. Please try again."
      );
    } finally {
      setMarkingAll(false);
    }
  }

  // Handle notification click.
  async function handleNotificationClick(notification) {
    if (notification.unread) {
      const success = await markAsRead(notification);

      if (!success) return;
    }

    const actionUrl = getSafeActionUrl(notification.actionUrl);

    if (actionUrl) {
      window.location.assign(actionUrl);
    }
  }

  // Handle notification action.
  async function handleAction(notification, event) {
    event.stopPropagation();

    if (notification.unread) {
      const success = await markAsRead(notification);

      if (!success) return;
    }

    const actionUrl = getSafeActionUrl(notification.actionUrl);

    if (actionUrl) {
      window.location.assign(actionUrl);
    }
  }

  return (
    <main className="min-h-screen w-full bg-slate-50">

      <div className="mx-auto min-h-[calc(100vh-80px)] w-full max-w-[1400px] px-4 py-8 sm:px-6 lg:px-12 lg:py-12">

        {/* =====================================
            PAGE HEADER
        ===================================== */}

        <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-center">

          <div>
            <div className="mb-2 flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Notifications
              </h1>

              {unreadCount > 0 && (
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600">
                  {unreadCount} unread
                </span>
              )}
            </div>

            <p className="max-w-xl text-sm leading-6 text-slate-500">
              Stay updated on your reservations, account alerts,
              and exclusive offers.
            </p>
          </div>

          <button
            type="button"
            onClick={markAllAsRead}
            disabled={markingAll || unreadCount === 0}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-5 py-3 text-xs font-bold tracking-wide text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
          >
            <CheckCheck size={16} />

            {markingAll
              ? "UPDATING..."
              : "MARK ALL AS READ"}
          </button>

        </div>

        {/* =====================================
            ERROR MESSAGE
        ===================================== */}

        {error && (
          <div
            role="alert"
            className="mb-6 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            <Bell size={18} className="mt-0.5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {/* =====================================
            HORIZONTAL CATEGORY TABS
        ===================================== */}

        <div className="mb-8 border-b border-slate-200">

          <nav
            aria-label="Notification categories"
            className="-mb-px flex w-full items-center gap-2 overflow-x-auto scrollbar-none"
          >
            {categories.map((category) => {
              const Icon = category.icon;
              const isActive = activeCategory === category.id;

              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => selectCategory(category.id)}
                  aria-pressed={isActive}
                  className={`
                    group inline-flex shrink-0 items-center gap-2.5
                    border-b-2 px-4 py-4 text-sm font-medium
                    whitespace-nowrap transition-all duration-200
                    ${
                      isActive
                        ? "border-blue-600 text-blue-600"
                        : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800"
                    }
                  `}
                >
                  <Icon
                    size={18}
                    strokeWidth={1.8}
                    className={
                      isActive
                        ? "text-blue-600"
                        : "text-slate-400 group-hover:text-slate-600"
                    }
                  />

                  <span>{category.label}</span>

                  <span
                    className={`
                      inline-flex min-w-6 items-center justify-center
                      rounded-full px-2 py-0.5 text-[11px] font-semibold
                      ${
                        isActive
                          ? "bg-blue-50 text-blue-600"
                          : "bg-slate-100 text-slate-500"
                      }
                    `}
                  >
                    {category.count}
                  </span>
                </button>
              );
            })}
          </nav>

        </div>

        {/* =====================================
            NOTIFICATION FEED
        ===================================== */}

        <section
          className="w-full"
          aria-live="polite"
          aria-busy={loading}
        >

          {/* Loading */}
          {loading ? (
            <div className="flex min-h-[350px] flex-col items-center justify-center gap-4 text-center">

              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-50">
                <Bell
                  size={25}
                  className="animate-pulse text-blue-600"
                />
              </div>

              <div>
                <p className="font-semibold text-slate-800">
                  Loading notifications...
                </p>

                <p className="mt-1 text-sm text-slate-400">
                  Please wait while we fetch your updates.
                </p>
              </div>

            </div>
          ) : filteredNotifications.length === 0 ? (

            /* Empty State */
            <div className="flex min-h-[350px] flex-col items-center justify-center gap-4 px-4 text-center">

              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-100">
                <BellOff
                  size={35}
                  strokeWidth={1.5}
                  className="text-slate-400"
                />
              </div>

              <div>
                <h3 className="text-lg font-semibold text-slate-800">
                  No notifications
                </h3>

                <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
                  There are no notifications in this category.
                  Check back later for new updates.
                </p>
              </div>

            </div>

          ) : (

            /* Notification Groups */
            <div className="space-y-9">

              {todayNotifications.length > 0 && (
                <NotificationGroup
                  title="TODAY"
                  notifications={todayNotifications}
                  updatingIds={updatingIds}
                  onClick={handleNotificationClick}
                  onAction={handleAction}
                />
              )}

              {yesterdayNotifications.length > 0 && (
                <NotificationGroup
                  title="YESTERDAY"
                  notifications={yesterdayNotifications}
                  updatingIds={updatingIds}
                  onClick={handleNotificationClick}
                  onAction={handleAction}
                />
              )}

              {olderNotifications.length > 0 && (
                <NotificationGroup
                  title="EARLIER"
                  notifications={olderNotifications}
                  updatingIds={updatingIds}
                  onClick={handleNotificationClick}
                  onAction={handleAction}
                />
              )}

            </div>
          )}

        </section>

      </div>

      {/* =====================================
          FOOTER
      ===================================== */}

      <footer className="border-t border-slate-200 bg-white">

        <div className="mx-auto flex max-w-[1400px] flex-col justify-between gap-4 px-4 py-6 sm:flex-row sm:items-center sm:px-6 lg:px-12">

          <p className="text-xs text-slate-400">
            © {new Date().getFullYear()} HotelReserve.
            All rights reserved.
          </p>

          <div className="flex flex-wrap items-center gap-5">
            <Link
              href="/pages/about"
              className="text-xs text-slate-500 transition hover:text-blue-600"
            >
              About
            </Link>

            <Link
              href="/pages/contact"
              className="text-xs text-slate-500 transition hover:text-blue-600"
            >
              Contact
            </Link>

            <Link
              href="/pages/privacy"
              className="text-xs text-slate-500 transition hover:text-blue-600"
            >
              Privacy Policy
            </Link>
          </div>

        </div>

      </footer>

    </main>
  );
}

/* =========================================
   NOTIFICATION GROUP
========================================= */

function NotificationGroup({
  title,
  notifications,
  updatingIds,
  onClick,
  onAction,
}) {
  return (
    <div>

      <div className="mb-4 flex items-center gap-3">
        <h2 className="text-[11px] font-bold tracking-[1.5px] text-slate-400">
          {title}
        </h2>

        <div className="h-px flex-1 bg-slate-100" />

        <span className="text-xs text-slate-400">
          {notifications.length}
        </span>
      </div>

      <div className="space-y-3">
        {notifications.map((notification) => (
          <NotificationCard
            key={notification.id}
            notification={notification}
            updating={updatingIds.includes(notification.id)}
            onClick={onClick}
            onAction={onAction}
          />
        ))}
      </div>

    </div>
  );
}

/* =========================================
   NOTIFICATION CARD
========================================= */

function NotificationCard({
  notification,
  updating,
  onClick,
  onAction,
}) {
  const Icon = getNotificationIcon(notification);

  const isError = notification.type === "error";

  function handleKeyDown(event) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick(notification);
    }
  }

  return (
    <article
      className={`
        group relative overflow-hidden rounded-xl border
        bg-white transition-all duration-200
        ${
          notification.unread
            ? "border-blue-100 bg-blue-50/30 shadow-sm hover:border-blue-200 hover:shadow-md"
            : "border-slate-200 hover:border-slate-300 hover:shadow-sm"
        }
      `}
      onClick={() => onClick(notification)}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`${notification.title}. ${notification.message}`}
    >

      {/* Unread Indicator */}
      {notification.unread && (
        <div className="absolute bottom-0 left-0 top-0 w-1 bg-blue-500" />
      )}

      <div className="flex gap-4 p-4 sm:gap-5 sm:p-5">

        {/* Icon */}
        <div
          className={`
            flex h-11 w-11 shrink-0 items-center justify-center
            rounded-xl
            ${
              isError
                ? "bg-red-50 text-red-600"
                : notification.category === "booking"
                  ? "bg-emerald-50 text-emerald-600"
                  : notification.category === "security"
                    ? "bg-amber-50 text-amber-600"
                    : notification.category === "offers"
                      ? "bg-purple-50 text-purple-600"
                      : "bg-blue-50 text-blue-600"
            }
          `}
          aria-hidden="true"
        >
          <Icon size={21} strokeWidth={1.8} />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">

          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">

            <h3
              className={`text-sm leading-6 ${
                notification.unread
                  ? "font-bold text-slate-900"
                  : "font-semibold text-slate-700"
              }`}
            >
              {notification.title}
            </h3>

            <div className="flex shrink-0 items-center gap-2">

              {notification.unread && (
                <span className="h-2 w-2 rounded-full bg-blue-500" />
              )}

              <span className="text-xs text-slate-400">
                {notification.time}
              </span>

            </div>

          </div>

          <p className="mt-1 text-sm leading-6 text-slate-500">
            {notification.message}
          </p>

          {/* Action */}
          {notification.action && (
            <div className="mt-4">

              <button
                type="button"
                onClick={(event) => onAction(notification, event)}
                disabled={updating}
                className={`
                  inline-flex items-center gap-2 rounded-lg
                  px-4 py-2.5 text-xs font-semibold
                  transition disabled:cursor-not-allowed disabled:opacity-50
                  ${
                    isError
                      ? "bg-red-50 text-red-600 hover:bg-red-100"
                      : "bg-blue-50 text-blue-600 hover:bg-blue-100"
                  }
                `}
              >
                {updating ? "UPDATING..." : notification.action}

                {!updating && <ArrowUpRight size={15} />}
              </button>

            </div>
          )}

        </div>

      </div>

    </article>
  );
}
