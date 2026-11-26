
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  MapPin,
  Heart,
  SlidersHorizontal,
  ChevronDown,
  ArrowRight,
  Waves,
  Wifi,
  Utensils,
  Dumbbell,
  ShieldCheck,
  Headset,
  Star,
  X,
} from "lucide-react";
import { listHotels } from "@/services/hotel.service";
import { getCurrentUser } from "@/services/auth.service";
import { addFavorite, listFavoriteIds, removeFavorite } from "@/services/user.service";



const PAGE_SIZE = 12;

const amenityIcons = {
  Pool: Waves,
  Spa: Waves,
  WiFi: Wifi,
  Restaurant: Utensils,
  "Fitness Center": Dumbbell,
  "Beach Access": Waves,
};

function normalizeResort(data, id) {
  const location = [data.city, data.state, data.country]
    .filter(Boolean)
    .join(", ");

  const rawImages = Array.isArray(data.images) ? data.images : [];

  const image =
    rawImages
      .map((item) => (typeof item === "string" ? item : item?.url))
      .find(Boolean) ||
    data.image ||
    data.imageUrl ||
    data.photoURL ||
    data.coverImage ||
    data.cover_image
  "";

  return {
    id,
    name: data.hotelName || "Unnamed hotel",
    location: location || data.address || "Location unavailable",
    city: data.city || "",
    state: data.state || "",
    country: data.country || "",
    type: data.category || "",
    room_name: data.room_type_name || data.name || "",
    price: Number(data.price || 0),
    rating: getStarRating(data.starRating),
    reviews: Number(data.reviewCount || 0),
    badge: data.badge || "",
    badgeType: data.badgeType || "",
    amenities: Array.isArray(data.amenities) ? data.amenities : [],
    image,
    status: String(data.status || "").toLowerCase(),
  };
}

function getStarRating(value) {
  if (typeof value === "number") {
    return value;
  }

  const match = String(value || "").match(/\d+/);
  return match ? Number(match[0]) : 0;
}
export default function ExplorePage() {
  const [resorts, setResorts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const [destination, setDestination] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guests, setGuests] = useState("2");

  const [maxPrice, setMaxPrice] = useState(null);
  const [ratings, setRatings] = useState([]);
  const [types, setTypes] = useState([]);
  const [amenities, setAmenities] = useState([]);
  const [sortBy, setSortBy] = useState("popular");
  // Hotel ids the signed-in guest has saved. Kept as strings so a numeric id from one query and a string id
  // from another always compare equal.
  const [favorites, setFavorites] = useState([]);
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [pendingFavorites, setPendingFavorites] = useState([]); // ids with a request in flight
  const [favoriteNotice, setFavoriteNotice] = useState(null);   // { text, kind }
  const pendingRef = useRef(new Set());
  const noticeTimerRef = useRef(null);
  const router = useRouter();
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const observerRef = useRef(null);
  const loadingRef = useRef(false);
  const lastDocumentRef = useRef(null);
  const hasMoreRef = useRef(true);
  const searchRef = useRef("");   // the search text the server list is currently using
  const requestRef = useRef(0);   // bumps on every new search, so late answers to an old search are ignored

  const [hasMore, setHasMore] = useState(true);

  // Fetch the first batch or the next batch from the server.
  const fetchResorts = useCallback(async (isInitial = false) => {
    // A new search may start while an older request is still running; "load more" may not.
    if (!isInitial && (loadingRef.current || !hasMoreRef.current)) return;

    if (isInitial) requestRef.current += 1;
    const requestId = requestRef.current;

    loadingRef.current = true;
    setError("");

    if (isInitial) {
      setLoading(true);
      lastDocumentRef.current = null;
      hasMoreRef.current = true;
      setHasMore(true);
    } else {
      setLoadingMore(true);
    }

    try {
      // Server-side paging: the cursor is the id of the last hotel received.
      const page = await listHotels({
        limit: PAGE_SIZE,
        cursor: isInitial ? null : lastDocumentRef.current,
        q: searchRef.current || undefined,
      });

      if (requestId !== requestRef.current) return; // the search changed while this was loading

      const results = page.items
        .map((hotel) => normalizeResort(hotel, hotel.id))
        .filter((resort) => resort.status !== "inactive");

      setResorts((previous) => {
        if (isInitial) return results;

        // Prevent duplicates if a document appears in two batches.
        const existingIds = new Set(previous.map((item) => item.id));
        return [
          ...previous,
          ...results.filter((item) => !existingIds.has(item.id)),
        ];
      });

      lastDocumentRef.current = page.nextCursor ?? lastDocumentRef.current;

      const moreAvailable = page.nextCursor !== null;
      hasMoreRef.current = moreAvailable;
      setHasMore(moreAvailable);
    } catch (err) {
      if (requestId !== requestRef.current) return;
      console.error("Failed to load resorts:", err);
      setError("Unable to load resorts. Please try again.");
    } finally {
      if (requestId === requestRef.current) {
        loadingRef.current = false;
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, []);

  // Who is signed in, and which hotels they have already saved (so the hearts start filled in).
  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const currentUser = await getCurrentUser();
        if (!active) return;
        setUser(currentUser);
        if (!currentUser) return;

        const ids = await listFavoriteIds();
        if (active) setFavorites(ids.map(String));
      } catch (err) {
        console.error("Unable to load favorites:", err);
      } finally {
        if (active) setAuthLoading(false);
      }
    })();

    return () => {
      active = false;
      clearTimeout(noticeTimerRef.current);
    };
  }, []);

  // (Re)load from the first page on mount and whenever the search text changes.
  useEffect(() => {
    searchRef.current = searchTerm;
    fetchResorts(true);
  }, [searchTerm, fetchResorts]);

  // Search as you type: wait until the guest pauses, then ask the server.
  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(destination.trim()), 400);
    return () => clearTimeout(timer);
  }, [destination]);

  // Automatically fetch the next batch when the sentinel enters view.
  useEffect(() => {
    const sentinel = observerRef.current;

    if (
      !sentinel ||
      loading ||
      loadingMore ||
      !hasMore ||
      error
    ) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          fetchResorts(false);
        }
      },
      {
        root: null,
        rootMargin: "300px",
        threshold: 0,
      }
    );

    observer.observe(sentinel);

    return () => observer.disconnect();
  }, [fetchResorts, loading, loadingMore, hasMore, error]);

  // Generate filter choices from records already fetched.
  const resortTypes = useMemo(
    () =>
      [...new Set(resorts.map((resort) => resort.type).filter(Boolean))]
        .sort(),
    [resorts]
  );

  const amenityOptions = useMemo(
    () =>
      [...new Set(resorts.flatMap((resort) => resort.amenities))]
        .filter(Boolean)
        .sort()
        .map((value) => ({
          value,
          label: value,
        })),
    [resorts]
  );

  const prices = resorts
    .map((resort) => resort.price)
    .filter((price) => Number.isFinite(price) && price > 0);

  const minPrice = prices.length
    ? Math.floor(Math.min(...prices))
    : 0;

  const highestPrice = prices.length
    ? Math.ceil(Math.max(...prices))
    : 0;

  const filteredResorts = useMemo(() => {
    const result = resorts.filter((resort) => {
      const matchesPrice =
        maxPrice === null || resort.price <= maxPrice;

      const matchesRating =
        ratings.length === 0 ||
        ratings.some((rating) => resort.rating >= rating);

      const matchesType =
        types.length === 0 || types.includes(resort.type);

      const matchesAmenities = amenities.every((amenity) =>
        resort.amenities.includes(amenity)
      );

      return (
        matchesPrice &&
        matchesRating &&
        matchesType &&
        matchesAmenities
      );
    });

    if (sortBy === "price-low") {
      result.sort((a, b) => a.price - b.price);
    } else if (sortBy === "price-high") {
      result.sort((a, b) => b.price - a.price);
    } else if (sortBy === "rating") {
      result.sort((a, b) => b.rating - a.rating);
    } else {
      result.sort((a, b) => b.reviews - a.reviews);
    }

    return result;
  }, [resorts, maxPrice, ratings, types, amenities, sortBy]);

  function toggleValue(value, values, setValues) {
    setValues((previous) =>
      previous.includes(value)
        ? previous.filter((item) => item !== value)
        : [...previous, value]
    );
  }

  function handleSearch(event) {
    event.preventDefault();
    setSearchTerm(destination.trim()); // Enter / Search button: no need to wait for the typing pause
  }

  function clearFilters() {
    setMaxPrice(null);
    setRatings([]);
    setTypes([]);
    setAmenities([]);
    setDestination("");
    setSearchTerm("");
  }

  function showFavoriteNotice(text, kind = "success") {
    clearTimeout(noticeTimerRef.current);
    setFavoriteNotice({ text, kind });
    noticeTimerRef.current = setTimeout(() => setFavoriteNotice(null), 3000);
  }

  // Save or un-save a hotel. The heart changes straight away and is put back if the server says no.
  async function toggleFavorite(id) {
    const key = String(id);
    if (pendingRef.current.has(key)) return; // ignore double-clicks while this hotel is being saved

    if (!user) {
      router.push("/login");
      return;
    }

    const wasFavorite = favorites.includes(key);

    pendingRef.current.add(key);
    setPendingFavorites((previous) => [...previous, key]);
    setFavorites((previous) =>
      wasFavorite ? previous.filter((item) => item !== key) : [...previous, key]
    );

    try {
      if (wasFavorite) await removeFavorite(id);
      else await addFavorite(id);
      showFavoriteNotice(wasFavorite ? "Removed from your favorites" : "Saved to your favorites");
    } catch (err) {
      console.error("Favorite operation failed:", err);

      // Undo the optimistic change.
      setFavorites((previous) =>
        wasFavorite
          ? previous.includes(key) ? previous : [...previous, key]
          : previous.filter((item) => item !== key)
      );

      // Most common cause: the session expired. If so, send the guest to sign in again.
      const stillSignedIn = await getCurrentUser().catch(() => user);
      if (!stillSignedIn) {
        setUser(null);
        router.push("/login");
      } else {
        showFavoriteNotice("We couldn't update your favorites. Please try again.", "error");
      }
    } finally {
      pendingRef.current.delete(key);
      setPendingFavorites((previous) => previous.filter((item) => item !== key));
    }
  }

  return (
    <main className="">

      {favoriteNotice && (
        <div className={`favorite-toast ${favoriteNotice.kind}`} role="status" aria-live="polite">
          {favoriteNotice.text}
        </div>
      )}






      <section className="resorts-main">
        <button
          className="mobile-filter-toggle"
          type="button"
          onClick={() => setMobileFiltersOpen((previous) => !previous)}
        >
          {mobileFiltersOpen ? (
            <X size={18} />
          ) : (
            <SlidersHorizontal size={18} />
          )}
          {mobileFiltersOpen ? "Close Filters" : "Filters"}
        </button>

        <aside
          className={`resort-filters  ${mobileFiltersOpen ? "filters-open" : ""
            }`}
        >
          <div className="filter-heading">
            <h2>
              <SlidersHorizontal size={17} />
              Filters
            </h2>
            <button type="button" onClick={clearFilters}>
              Clear all
            </button>
          </div>

          <div className="filter-section">
            <h3>Maximum price per night</h3>

            {prices.length > 0 ? (
              <>
                <input
                  className="price-slider"
                  type="range"
                  min={minPrice}
                  max={Math.max(highestPrice, minPrice + 1)}
                  step={1}
                  value={maxPrice ?? highestPrice}
                  onChange={(event) =>
                    setMaxPrice(Number(event.target.value))
                  }
                  aria-label="Maximum price per night"
                />

                <div className="price-labels">
                  <span>{minPrice.toLocaleString()}</span>
                  <strong>
                    {(maxPrice ?? highestPrice).toLocaleString()} max
                  </strong>
                </div>
              </>
            ) : (
              <p>No prices available</p>
            )}
          </div>

          <div className="filter-section">
            <h3>Minimum Star Rating</h3>

            {[5, 4, 3, 2, 1].map((rating) => (
              <label className="filter-option" key={rating}>
                <input
                  type="checkbox"
                  checked={ratings.includes(rating)}
                  onChange={() =>
                    toggleValue(rating, ratings, setRatings)
                  }
                />
                <span>{rating} Stars and above</span>
                <span className="rating-stars">
                  {"★".repeat(rating)}
                  <span className="empty-stars">
                    {"★".repeat(5 - rating)}
                  </span>
                </span>
              </label>
            ))}
          </div>

          <div className="filter-section">
            <h3>Resort Type</h3>

            {resortTypes.map((type) => (
              <label className="filter-option" key={type}>
                <input
                  type="checkbox"
                  checked={types.includes(type)}
                  onChange={() => toggleValue(type, types, setTypes)}
                />
                <span>{type}</span>
              </label>
            ))}
          </div>

          <div className="filter-section">
            <h3>Amenities</h3>

            {amenityOptions.map((amenity) => (
              <label className="filter-option" key={amenity.value}>
                <input
                  type="checkbox"
                  checked={amenities.includes(amenity.value)}
                  onChange={() =>
                    toggleValue(
                      amenity.value,
                      amenities,
                      setAmenities
                    )
                  }
                />
                <span>{amenity.label}</span>
              </label>
            ))}
          </div>

          <button
            className="apply-filters-button"
            type="button"
            onClick={() => setMobileFiltersOpen(false)}
          >
            Apply Filters
          </button>
        </aside>

        <div className="resorts-results">
          <div className="mb-9">
            <div className="group flex items-center gap-3 rounded-1xl border border-slate-200 bg-white px-5 py-4 shadow-sm transition-all duration-200 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10">
              <Search size={21} className="shrink-0 text-slate-400 transition group-focus-within:text-blue-600" />

              <input
                className="w-full bg-transparent text-sm font-medium text-slate-800 outline-none placeholder:font-normal placeholder:text-slate-400"
                type="text"
                placeholder="Search hotels, cities, destinations or locations..."
                value={searchTerm}
                onChange={(event) => setDestination(event.target.value)}
              />

              {searchTerm && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold text-blue-600 hover:bg-blue-50"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="results-heading">

            <div>
              <h2>Resorts</h2>
              <p>
                {searchTerm && <>Results for &ldquo;{searchTerm}&rdquo;: </>}
                Showing {filteredResorts.length} matching resorts from{" "}
                {resorts.length} loaded
              </p>
            </div>

            <label className="sort-control">
              <span>Sort by:</span>
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value)}
              >
                <option value="popular">Popularity</option>
                <option value="rating">Highest Rated</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
              </select>
              <ChevronDown size={15} />
            </label>
          </div>

          {loading ? (
            <div className="no-resorts">
              <p>Loading resorts from the server...</p>
            </div>
          ) : error && resorts.length === 0 ? (
            <div className="no-resorts">
              <h3>Unable to load resorts</h3>
              <p>{error}</p>
              <button
                type="button"
                className="view-details-button"
                onClick={() => fetchResorts(true)}
              >
                Try Again
              </button>
            </div>
          ) : filteredResorts.length > 0 ? (
            <div className="resorts-grid">
              {filteredResorts.map((resort) => (
                <article className="resort-card " key={resort.id}>
                  <div className="resort-image-wrap">
                    {resort.image ? (
                      <img
                        src={resort.image}
                        alt={resort.name}
                        className="resort-image"
                        loading="lazy"
                      />
                    ) : (
                      <div className="resort-no-image">
                        <Waves size={34} />
                        <span>No image available</span>
                      </div>
                    )}

                    {resort.badge && (
                      <span
                        className={`resort-badge ${resort.badgeType}`}
                      >
                        {resort.badge}
                      </span>
                    )}

                    <button
                      type="button"
                      className={`favorite-button ${favorites.includes(String(resort.id))
                        ? "is-favorite"
                        : ""
                        }${pendingFavorites.includes(String(resort.id)) ? " is-pending" : ""}`}
                      aria-label={
                        favorites.includes(String(resort.id))
                          ? "Remove from favorites"
                          : "Add to favorites"
                      }
                      aria-pressed={favorites.includes(String(resort.id))}
                      disabled={authLoading}
                      onClick={() => toggleFavorite(resort.id)}
                    >
                      <Heart
                        size={19}
                        fill={
                          favorites.includes(String(resort.id))
                            ? "currentColor"
                            : "none"
                        }
                      />
                    </button>

                    {resort.rating > 0 && (
                      <span className="image-rating">
                        <Star size={13} fill="currentColor" />
                        {resort.rating}
                        <span>({resort.reviews})</span>
                      </span>
                    )}
                  </div>

                  <div className="resort-card-body">
                    <h3>{resort.name}</h3>

                    <p className="resort-location">
                      <MapPin size={14} />
                      {resort.location}

                      {resort.type && (
                        <>
                          <span>·</span>
                          <p className="font-extrabold text-blue-300"> {resort.room_name}</p>
                          <p>({resort.type})</p>

                        </>
                      )}
                    </p>

                    <div className="resort-amenities">
                      {resort.amenities.slice(0, 4).map((amenity) => {
                        const Icon = amenityIcons[amenity] || Waves;

                        return (
                          <span key={amenity} title={amenity}>
                            <Icon size={14} />
                            {amenity}
                          </span>
                        );
                      })}
                    </div>

                    <div className="resort-card-bottom">
                      <div className="resort-price">
                        {/* {resort.price > 0 ? (
                          <>
                            <strong>
                              {resort.price.toLocaleString()}
                            </strong>
                            <span>/ night</span>
                          </>
                        ) : (
                          <span>Price unavailable</span>
                        )} */}
                      </div>

                      <Link
                        key={`${resort.room_name}-${resort.city}`}
                        href={`/categorydetails?category=${encodeURIComponent(resort.room_name)}&city=${encodeURIComponent(resort.city)}`}
                        className="view-details-button"
                      >
                        View Details
                        <ArrowRight size={15} />
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="no-resorts">

              <h3>No resorts found</h3>
              <p>
                {resorts.length === 0
                  ? searchTerm
                    ? `Nothing matches "${searchTerm}". Check the spelling or try a city or state.`
                    : "No resort records are available."
                  : "Try another destination or remove some filters."}
              </p>
              <button
                type="button"
                className="view-details-button"
                onClick={clearFilters}
              >
                Clear Filters
              </button>
            </div>
          )}

          {/* Infinite-scroll trigger */}
          {!loading && !error && hasMore && (
            <div
              ref={observerRef}
              className="infinite-scroll-trigger"
              aria-live="polite"
            >
              {loadingMore && <p>Loading more resorts...</p>}
            </div>
          )}

          {error && resorts.length > 0 && (
            <div className="infinite-scroll-trigger">
              <p>{error}</p>
              <button
                type="button"
                className="view-details-button"
                onClick={() => fetchResorts(false)}
              >
                Retry Loading
              </button>
            </div>
          )}

          {!loading && !error && !hasMore && resorts.length > 0 && (
            <div className="infinite-scroll-trigger">
              <p>You’ve reached the end of the resorts.</p>
            </div>
          )}
        </div>
      </section>

      <section className="resort-promises">
        <div>
          <ShieldCheck size={29} />
          <span>
            <strong>Secure Booking</strong>
            <small>Your data is always protected</small>
          </span>
        </div>

        <div>
          <Headset size={29} />
          <span>
            <strong>Customer Support</strong>
            <small>We're here to help</small>
          </span>
        </div>

        <div>
          <Star size={29} />
          <span>
            <strong>Find Your Stay</strong>
            <small>Explore available resort options</small>
          </span>
        </div>
      </section>


    </main>
  );
}
