"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/services/admin/auth";

const NAV = [
  { items: [{ href: "/admin", text: "Dashboard" }] },
  { group: "Marketplace", items: [
    { href: "/admin/users", text: "Users" },
    { href: "/admin/hotels", text: "Hotels" },
    { href: "/admin/amenities", text: "Amenities" },
    { href: "/admin/rooms", text: "Rooms" },
    { href: "/admin/rooms/types", text: "Room types & rates" },
    { href: "/admin/reservations", text: "Reservations" },
  ] },
  { group: "Finance", items: [
    { href: "/admin/payments", text: "Payments" },
    { href: "/admin/payments/refunds", text: "Refunds" },
    { href: "/admin/payouts", text: "Payouts" },
    { href: "/admin/bank-accounts", text: "Bank accounts" },
  ] },
    { group: "Notifications", items: [
    { href: "/admin/notifications/", text: "Notification" },
    { href: "/admin/notifications/new", text: "New" },

  ] },
  { group: "Promotions & Coupons", items: [{ href: "/admin/coupons", text: "Coupons" }] },
  { group: "Reports", items: [
    { href: "/admin/reports/bookings", text: "Booking Reports" },
    { href: "/admin/reports/hotel-performance", text: "Hotel Performance" },
    { href: "/admin/reports/revenue", text: "Revenue Reports" },
    { href: "/admin/reports/commissions", text: "Commission Reports" },
    { href: "/admin/reports/customers", text: "Customer Reports" },
    { href: "/admin/reports/payments", text: "Payment Reports" },
  ] },
  { group: "System Management", items: [
    { href: "/admin/system/settings", text: "Platform Settings" },
    { href: "/admin/system/audit-logs", text: "Audit Logs" },
    { href: "/admin/system/activity", text: "Admin Activity" },
    { href: "/admin/login-logs", text: "Login Logs" },
    { href: "/admin/sessions", text: "Active Sessions" },
    { href: "/admin/webhooks", text: "Payment Webhooks" },
    { href: "/admin/roles", text: "Roles & Permissions" },
    { href: "/admin/system/support", text: "Support Settings" },
  ] },
  { group: "Account", items: [
    { href: "/admin/account/profile", text: "My Profile" },
    { href: "/admin/account/password", text: "Change Password" },
  ] },
];

export default function Sidebar({ name }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); }, [path]);
  const all = NAV.flatMap((g) => g.items.map((i) => i.href));
  const active = all.filter((h) => (h === "/admin" ? path === h : path === h || path.startsWith(h + "/"))).sort((a, b) => b.length - a.length)[0];
  return (
    <aside className={`adm-side${open ? " open" : ""}`}>
      <div className="adm-sidehead">
        <div className="adm-brand"><div>Hotel Marketplace<small>Signed in as {name}</small></div></div>
        <button type="button" className="adm-burger" aria-expanded={open} aria-controls="adm-nav" onClick={() => setOpen((o) => !o)}>
          {open ? "Close" : "Menu"}
        </button>
      </div>
      <nav id="adm-nav" className="adm-nav" aria-label="Admin">
        {NAV.map((g, i) => (
          <div key={i}>
            {g.group && <div className="adm-grp">{g.group}</div>}
            {g.items.map((it) => (
              <Link key={it.href} href={it.href} className={`adm-link${active === it.href ? " on" : ""}`}>{it.text}</Link>
            ))}
          </div>
        ))}
        <form action={logoutAction}><button className="adm-logout" type="submit">Logout</button></form>
      </nav>
    </aside>
  );
}
