"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Search,
  MapPin,
  ChevronRight,
  Home,
  Building2,
  BedDouble,
  SlidersHorizontal,
} from "lucide-react";

import { getRoomCategories } from "@/services/room.service";
import styles from "./categories.module.css";

const formatPrice = (n) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(n);

function CategoriesContent() {
  const searchParams = useSearchParams();
  const destination = searchParams.get("destination") || "";

  const cityName = destination.trim()
    ? destination.trim().replace(/\b\w/g, (l) => l.toUpperCase())
    : "All destinations";

  const [categories, setCategories] = useState([]);
  const [summary, setSummary] = useState({ totalHotels: 0, totalRooms: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  // Fetch from MySQL (via the server action) whenever the destination changes.
  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        setError("");
        const result = await getRoomCategories(destination);
        if (!active) return;
        setCategories(result.categories);
        setSummary(result.summary);
      } catch (err) {
        console.error("Failed to load room categories:", err);
        if (active) setError("Unable to load room categories. Please try again.");
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [destination]);

  const filteredCategories = useMemo(() => {
    const value = search.trim().toLowerCase();
    return categories.filter(
      (c) =>
        c.name.toLowerCase().includes(value) &&
        // (filter === "all" || c.type === filter)
         (filter === "all")
    );
  }, [categories, search, filter]);

  const getCategoryUrl = (category) => {
    const params = new URLSearchParams();
    params.set("city", destination);
    // room_type is free text in the DB, so pass the exact name (not a slug)
    // for the room list page to match on.
    params.set("category", category.name);
    return `/categorydetails?${params.toString()}`;
  };

  const describe = (c) => {
    const parts = [];
    if (c.minPrice != null) parts.push(`From ${formatPrice(c.minPrice)} per night`);
    if (c.maxCapacity) parts.push(`sleeps up to ${c.maxCapacity}`);
    return parts.join(" · ");
  };

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <span className={styles.locationBadge}>
            <MapPin size={15} />
            {cityName}
          </span>
          <h1>
            Explore Hotel
            <span> Categories</span>
          </h1>
          <p>
            Discover different types of accommodation available across hotels
            {destination ? ` in ${cityName}` : ""}.
          </p>
        </div>
      </section>

      <div className={styles.breadcrumb}>
        <Link href="/" aria-label="Home">
          <Home size={17} />
        </Link>
        <ChevronRight size={15} />
        <Link href="/pages/destinations">Destinations</Link>
        <ChevronRight size={15} />
        <span>{cityName}</span>
        <ChevronRight size={15} />
        <span>Categories</span>
      </div>

      <section className={styles.content}>
        <div className={styles.heading}>
          <div>
            <span className={styles.eyebrow}>FIND YOUR PERFECT STAY</span>
            <h2>Explore by Category</h2>
            <p>
              Browse room categories available across hotels
              {destination ? ` in ${cityName}` : ""}.
            </p>
          </div>

          <div className={styles.hotelSummary}>
            <Building2 size={23} />
            <div>
              <strong>{summary.totalHotels}</strong>
              <span>Hotels</span>
            </div>
          </div>
        </div>

        <div className={styles.searchArea}>
          <div className={styles.searchBox}>
            <Search size={20} />
            <input
              type="search"
              placeholder="Search hotel categories..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className={styles.filterArea}>
          <div className={styles.filterLabel}>
            <SlidersHorizontal size={17} />
            <span>Categories:</span>
          </div>
          <div className={styles.filterButtons}>
            {[
              ["all", "All Categories"],
              ["global", "Standard Categories"],
              ["custom", "Hotel Specialties"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={filter === value ? styles.selected : ""}
                onClick={() => setFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className={styles.emptyState}>
            <p>Loading room categories...</p>
          </div>
        ) : error ? (
          <div className={styles.emptyState}>
            <p>{error}</p>
            <button type="button" onClick={() => window.location.reload()}>
              Try again
            </button>
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className={styles.emptyState}>
       
            <h3>No categories found</h3>
            <p>
              {categories.length === 0
                ? "There are no available room categories yet."
                : "Try searching with a different category name."}
            </p>
            {categories.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setFilter("all");
                }}
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className={styles.categoryList}>
            {filteredCategories.map((category) => (
              <Link
                key={category.id}
                href={getCategoryUrl(category)}
                className={styles.categoryItem}
              >
                <div className={styles.categoryImage}>
                  {category.image ? (
                    <img src={category.image} alt={category.name} />
                  ) : (
                    <BedDouble size={36} />
                  )}
                </div>

                <div className={styles.categoryInfo}>
                  <h3>{category.name}</h3>
                  <p>{describe(category)}</p>
                  <div className={styles.categoryStats}>
                    <span>
                      <Building2 size={16} />
                      {category.hotels} {category.hotels === 1 ? "Hotel" : "Hotels"}
                    </span>
                    <span>
                      <BedDouble size={16} />
                      {category.rooms} {category.rooms === 1 ? "Room" : "Rooms"}
                    </span>
                  </div>
                </div>

                <div className={styles.categoryArrow}>
                  <ChevronRight size={22} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className={styles.bottomSummary}>
        <div className={styles.summaryItem}>
          <Building2 size={32} />
          <div>
            <span>Total Hotels</span>
            <strong>{summary.totalHotels} Hotels</strong>
          </div>
        </div>
        <div className={styles.summaryDivider} />
        <div className={styles.summaryItem}>
          <BedDouble size={32} />
          <div>
            <span>Registered Rooms</span>
            <strong>{summary.totalRooms} Rooms</strong>
          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        <p>© {new Date().getFullYear()} HotelReserve. Stay Better. Travel Further.</p>
      </footer>
    </main>
  );
}

// useSearchParams needs a Suspense boundary for `next build`.
export default function HotelCategoriesPage() {
  return (
    <Suspense fallback={null}>
      <CategoriesContent />
    </Suspense>
  );
}