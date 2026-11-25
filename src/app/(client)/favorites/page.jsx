
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";




import {
  Search,
  MapPin,
  Heart,
  ChevronDown,
  ArrowRight,
  Waves,
  Wifi,
  Utensils,
  Dumbbell,
  Star,
  LoaderCircle,
} from "lucide-react";
import { getCurrentUser } from "@/services/auth.service";
import { listFavorites, removeFavorite as removeFavoriteAction } from "@/services/user.service";

const amenityIcons = {
  Pool: Waves,
  Spa: Waves,
  WiFi: Wifi,
  Restaurant: Utensils,
  "Fitness Center": Dumbbell,
  "Beach Access": Waves,
};

function getStarRating(value) {
  if (typeof value === "number") {
    return value;
  }

  const match = String(value || "").match(/\d+/);

  return match ? Number(match[0]) : 0;
}

function normalizeResort(data, id) {
  const location = [
    data.city,
    data.state,
    data.country,
  ]
    .filter(Boolean)
    .join(", ");

  const rawImages = Array.isArray(data.images)
    ? data.images
    : [];

  const image =
    rawImages
      .map((item) =>
        typeof item === "string" ? item : item?.url
      )
      .find(Boolean) ||
    data.image ||
    data.imageUrl ||
    data.photoURL ||
    data.coverImage ||
    "";

  return {
    id,
    name: data.hotelName || "Unnamed hotel",
    location: location || data.address || "Location unavailable",
    country: data.country || "",
    type: data.category || "",
    price: Number(data.price || 0),
    rating: getStarRating(data.starRating),
    reviews: Number(data.reviewCount || 0),
    badge: data.badge || "",
    badgeType: data.badgeType || "",
    amenities: Array.isArray(data.amenities)
      ? data.amenities
      : [],
    image,
    status: String(data.status || "").toLowerCase(),
  };
}

export default function ExplorePage() {
  const [resorts, setResorts] = useState([]);
  const [favorites, setFavorites] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [user, setUser] = useState(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("popular");

  const [removingId, setRemovingId] = useState(null);

  // Fetch the authenticated user's favorite hotels.
  const fetchFavorites = useCallback(async (userId) => {
    setLoading(true);
    setError("");

    try {
      // Favourite hotels (with their current details) from MySQL.
      const favoriteHotels = await listFavorites();

      if (favoriteHotels.length === 0) {
        setFavorites([]);
        setResorts([]);
        return;
      }

      setFavorites(favoriteHotels.map((hotel) => hotel.id));

      const validHotels = favoriteHotels
        .map((hotel) => normalizeResort(hotel, hotel.id))
        .filter((hotel) => hotel && hotel.status !== "inactive");

      setResorts(validHotels);
    } catch (err) {
      console.error("Failed to fetch favorite hotels:", err);
      setError("Unable to load your favorite hotels. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);



  const clearFilters = () => {
    setSearchTerm("");
    setSortBy("popular");
  };
  // Load the signed-in user.
  useEffect(() => {
    let active = true;

    const unsubscribe = (() => {
      let active = true; (async () => {
        const currentUser = await getCurrentUser(); if (!active) return;
        if (!active) return;

        setUser(currentUser);

        if (!currentUser) {
          setFavorites([]);
          setResorts([]);
          setLoading(false);
          return;
        }

        await fetchFavorites(currentUser.uid);
      })(); return () => { active = false; };
    })();

    return () => {
      active = false;
      unsubscribe();
    };
  }, [fetchFavorites]);

  // Search and sort favorite hotels.
  const filteredResorts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    const results = resorts.filter((resort) => {
      return (
        !term ||
        resort.name.toLowerCase().includes(term) ||
        resort.location.toLowerCase().includes(term) ||
        resort.country.toLowerCase().includes(term)
      );
    });

    if (sortBy === "price-low") {
      results.sort((a, b) => a.price - b.price);
    } else if (sortBy === "price-high") {
      results.sort((a, b) => b.price - a.price);
    } else if (sortBy === "rating") {
      results.sort((a, b) => b.rating - a.rating);
    } else {
      results.sort((a, b) => b.reviews - a.reviews);
    }

    return results;
  }, [resorts, searchTerm, sortBy]);

  // Remove a hotel from the user's favorites.
  async function removeFavorite(hotelId) {
    if (!user || removingId) return;

    setRemovingId(hotelId);
    setError("");

    try {
      await removeFavoriteAction(hotelId);

      setFavorites((previous) =>
        previous.filter((id) => id !== hotelId)
      );

      setResorts((previous) =>
        previous.filter((hotel) => hotel.id !== hotelId)
      );
    } catch (err) {
      console.error("Failed to remove favorite:", err);
      setError("Unable to remove this hotel from favorites.");
    } finally {
      setRemovingId(null);
    }
  }

  // Loading state.
  if (loading) {
    return (
      <main className="px-4 lg:px-14 py-11 min-h-[60vh] flex items-center justify-center">
        <div className="no-resorts flex flex-col items-center justify-center gap-3 text-center">
          <LoaderCircle className="animate-spin" size={30} />
          <p>Loading your favorite hotels...</p>
        </div>
      </main>
    );
  }

  // Authentication state.
  if (!user) {
    return (
      <main className="px-4 lg:px-14 py-11">
        <div className="no-resorts">
          <Heart size={36} />

          <h3>Sign in to view your favorites</h3>

          <p>
            Sign in to your account to see the hotels
            you have saved.
          </p>

          <Link
            href="/login"
            className="view-details-button"
          >
            Sign In
            <ArrowRight size={15} />
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="px-4 lg:px-14 py-11">
      <div className="resorts-results">

        {/* Page heading */}
        <div className="results-heading">
          <div>
            <h2>My Favorites</h2>

            <p>
              {filteredResorts.length} favorite hotels
              {searchTerm ? " found" : " saved"}
            </p>
          </div>

          <label className="sort-control">
            <span>Sort by:</span>

            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}>
              <option value="popular">Popularity</option>
              <option value="rating">Highest Rated</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
            </select>

            <ChevronDown size={15} />
          </label>
        </div>

        {/* Search */}
        {resorts.length > 0 && (


          <div className="mb-9">
            <div className="group flex items-center gap-3 rounded-1xl border border-slate-200 bg-white px-5 py-4 shadow-sm transition-all duration-200 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10">
              <Search size={21} className="shrink-0 text-slate-400 transition group-focus-within:text-blue-600" />

              <input
                className="w-full bg-transparent text-sm font-medium text-slate-800 outline-none placeholder:font-normal placeholder:text-slate-400"
                type="text"
                placeholder="Search hotels, cities, destinations or locations..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
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
        )}

        {/* Error message */}
        {error && (
          <div className="favorite-error" role="alert">
            <p>{error}</p>

            <button
              type="button"
              onClick={() => fetchFavorites(user.uid)}
            >
              Retry
            </button>
          </div>
        )}

        {/* Hotel cards */}
        {filteredResorts.length > 0 ? (
          <div className="resorts-grid">
            {filteredResorts.map((resort) => (
              <article
                className="resort-card"
                key={resort.id}
              >
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

                  {/* Remove favorite */}
                  <button
                    type="button"
                    className="favorite-button is-favorite"
                    aria-label={`Remove ${resort.name} from favorites`}
                    disabled={removingId === resort.id}
                    onClick={() => removeFavorite(resort.id)}
                  >
                    {removingId === resort.id ? (
                      <LoaderCircle
                        size={19}
                        className="animate-spin"
                      />
                    ) : (
                      <Heart
                        size={19}
                        fill="currentColor"
                      />
                    )}
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
                        {resort.type}
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
                      {resort.price > 0 ? (
                        <>
                          <strong>
                            {resort.price.toLocaleString("en-NG", {
                              style: "currency",
                              currency: "NGN",
                              maximumFractionDigits: 0,
                            })}
                          </strong>

                          <span>/ night</span>
                        </>
                      ) : (
                        <span>Price unavailable</span>
                      )}
                    </div>

                    <Link
                      href={`/dashboard/hoteldetails/${encodeURIComponent(resort.id)}`}
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
            {resorts.length === 0 ? (
              <>
                <Heart size={38} />

                <h3>No favorite hotels yet</h3>

                <p>
                  Hotels you save will appear here.
                  Explore hotels and tap the heart icon
                  to add them to your favorites.
                </p>

                <Link
                  href="/explore"
                  className="view-details-button"
                >
                  Explore Hotels
                  <ArrowRight size={15} />
                </Link>
              </>
            ) : (
              <>
                <Search size={34} />

                <h3>No hotels found</h3>

                <p>
                  No favorite hotels match your search.
                </p>

                <button
                  type="button"
                  className="view-details-button"
                  onClick={() => setSearchTerm("")}
                >
                  Clear Search
                </button>
              </>
            )}
          </div>
        )}

      </div>
    </main>
  );
}
