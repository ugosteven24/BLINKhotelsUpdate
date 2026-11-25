
"use client";


import Link from "next/link";
import ProfileImage from "../component/profileImage";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { logout } from "@/services/auth.service";
import {
  Waves,
  LayoutDashboard,
  Compass,
  Heart,
  CalendarCheck,
  Bell,
  UserRound,
  Settings,
  Search,
  LogOut,
  Menu as MenuIcon,
  X,
  ArrowUpRight,
} from "lucide-react";

import "./menu.css";

export default function Menu() {
  const pathname = usePathname();
  const router = useRouter();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const handleSignOut = async () => {
    if (signingOut) return;

    setSigningOut(true);

    try {
      await logout();
      sessionStorage.clear();
      router.replace("/login");
      router.refresh();
    } catch (error) {
      console.error("Sign out failed:", error);
      setSigningOut(false);
    }
  };

  const navLinks = [
    {
      name: "Overview",
      href: "/",
      icon: LayoutDashboard,
    },
    {
      name: "Explore",
      href: "/explore",
      icon: Compass,
    },
    {
      name: "Favorites",
      href: "/favorites",
      icon: Heart,
    },
    {
      name: "My bookings",
      href: "/mybooking",
      icon: CalendarCheck,
    },
    {
      name: "Notifications",
      href: "/notification",
      icon: Bell,
    },
    {
      name: "Profile",
      href: "/profile",
      icon: UserRound,
    },
    // {
    //   name: "Settings",
    //   href: "/settings",
    //   icon: Settings,
    // },
  ];

  const isActive = (href) => {
    if (href === "/dashboard") {
      return pathname === href;
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const handleSearch = () => {
    setMobileMenuOpen(false);

    document
      .getElementById("resort-search")
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <header className="resorts-header">
      <div className="resorts-header-inner px-0 py-0">
        {/* Brand */}
        <Link href="/" className="resorts-brand">
          <span className="brand-mark">
            <Waves size={25} strokeWidth={2.3} />
          </span>

          <span className="brand-copy">
            <strong>HotelReserve</strong>
            <small>Stay better. Travel further.</small>
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="resorts-nav" aria-label="Main navigation">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const active = isActive(link.href);

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`resorts-nav-link ${active ? "active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                <Icon size={17} strokeWidth={active ? 2.3 : 1.9} />
                <span>{link.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Header Actions */}
        <div className="header-actions">


          {/* <Link
            href="/dashboard/explore"
            className="header-explore-button"
          >
            <span className="lg: text-amber-50">Find a stay</span>
            <ArrowUpRight size={17} className="lg: text-amber-50" />
          </Link> */}

          <div className="header-profile">
            <div className="header-profile-image">
              <ProfileImage />
            </div>

            <button
              type="button"
              className="header-signout-button"
              onClick={handleSignOut}
              disabled={signingOut}
            >
              <LogOut size={17} />
              <span>{signingOut ? "Signing out..." : "Sign out"}</span>
            </button>
          </div>

          {/* Mobile Menu Toggle */}
          <button
            type="button"
            className="mobile-menu-toggle "
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((prev) => !prev)}
          >
            {mobileMenuOpen ? <X size={23} /> : <MenuIcon size={23} />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div className={`mobile-nav ${mobileMenuOpen ? "open" : ""}`}>
        <div className="mobile-nav-inner">
          <div className="mobile-nav-heading">
            <span>YOUR ACCOUNT</span>
            <span className="mobile-nav-indicator">MENU</span>
          </div>

          <nav aria-label="Mobile navigation">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const active = isActive(link.href);

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`mobile-nav-link ${active ? "active" : ""}`}
                  aria-current={active ? "page" : undefined}
                >
                  <span className="mobile-nav-icon">
                    <Icon size={19} />
                  </span>

                  <span>{link.name}</span>

                  {active && <span className="mobile-active-dot" />}
                </Link>
              );
            })}
          </nav>

          <button
            type="button"
            className="mobile-search-button"
            onClick={handleSearch}
          >
            <Search size={18} />
            Search for hotels
          </button>

          <button
            type="button"
            className="mobile-signout-button"
            onClick={handleSignOut}
            disabled={signingOut}
          >
            <LogOut size={18} />
            {signingOut ? "Signing out..." : "Sign out"}
          </button>
        </div>
      </div>
    </header>
  );
}
