"use client";
import { useEffect, useState,useMemo,use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  MapPin,
  Star,
  ShieldCheck,
  ChevronRight,
  Hotel as HotelIcon,
} from "lucide-react";
import { getHotel } from "@/services/hotel.service";



function formatPrice(price) {
  if (
    price === undefined ||
    price === null ||
    price === "" ||
    !Number.isFinite(Number(price))
  ) {
    return null;
  }

  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(Number(price));
}

export default function HotelDetailsPage({ params }) {
  const { id } = use(params);

  const [hotel, setHotel] = useState([null]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeImage, setActiveImage] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    let cancelled = false;

    async function fetchHotel() {
      setLoading(true);
      setError("");
      setHotel(null);

      try {
        let hotelData = null;

        // The server accepts the hotel id or the old numeric id.
        const found = await getHotel(id);
        if (found) hotelData = { ...found, documentId: found.id };

        if (!cancelled) {
          if (!hotelData) {
            setError("We couldn't find this hotel.");
          } else {
            setHotel(hotelData);
            setActiveImage(hotelData.coverImage || "");
          }
        }
      } catch (err) {
        console.error("Failed to load hotel details:", err);

        if (!cancelled) {
          setError("Unable to load this hotel. Please try again.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchHotel();

    return () => {
      cancelled = true;
    };
  }, [id]);



  if (loading) {
    return (

      <>

        <main className="min-h-screen bg-slate-50 px-4 py-12">
          <div className="mx-auto max-w-6xl animate-pulse space-y-6">
            <div className="h-5 w-36 rounded bg-slate-200" />
            <div className="h-80 rounded-3xl bg-slate-200 md:h-[440px]" />
            <div className="h-8 w-2/3 rounded bg-slate-200" />
            <div className="h-5 w-1/3 rounded bg-slate-200" />
            <div className="h-40 rounded-2xl bg-slate-200" />
          </div>
        </main>
      </>
    );
  }

  if (error || !hotel) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-slate-500 shadow-sm">
            <HotelIcon size={30} />
          </div>

          <h1 className="text-2xl font-bold text-slate-900">
            Hotel not found
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-500">
            {error || "This hotel may have been removed or the link may be incorrect."}
          </p>

          <Link
            href="/dashboard/explore"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            <ArrowLeft size={17} />
            Browse hotels
          </Link>
        </div>
      </main>
    );
  }

  const gallery = Array.isArray(hotel.images)
    ? hotel.images
      .map((image) => {
        if (typeof image === "string") return image;

        return (
          image.image_url ||
          image.image_path ||
          image.url ||
          image.path ||

          ""
        );
      })
      .filter(Boolean)
    : [];

  const images = [
    ...new Set(
      [hotel.coverImage, ...gallery].filter(Boolean)
    ),
  ];

  const amenities = Array.isArray(hotel.amenities)
    ? hotel.amenities
      .map((amenity) => {
        if (typeof amenity === "string") return amenity;

        return (
          amenity.name ||
          amenity.amenity_name ||
          amenity.title ||
          ""
        );
      })
      .filter(Boolean)
    : [];

  const roomTypes = Array.isArray(hotel.roomTypes)
    ? hotel.roomTypes
    : [];
  const price = formatPrice(hotel.price);

  const location = [
    hotel.city,
    hotel.state,
    hotel.country,
  ]
    .filter(Boolean)
    .filter((value, index, array) => array.indexOf(value) === index)
    .join(", ");

  const hotelUrlId = hotel.id ?? hotel.documentId;

  return (
    <main className="min-h-screen bg-slate-50 pb-16">
      {/* Top navigation */}
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link
            href="/explore"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-slate-950"
          >
            <ArrowLeft size={18} />
            Back to hotels
          </Link>

          <span className="text-sm font-bold tracking-tight text-slate-900">
            HotelReserve
          </span>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <div className="flex flex-wrap items-center gap-2 py-5 text-sm text-slate-500">
          <Link href="/" className="hover:text-slate-900">
            Home
          </Link>
          <ChevronRight size={15} />
          <Link href="/explore" className="hover:text-slate-900">
            Hotels
          </Link>
          <ChevronRight size={15} />
          <span className="max-w-52 truncate font-medium text-slate-900">
            {hotel.hotelName || "Hotel details"}
          </span>
        </div>

        {/* Hotel heading */}
        <section className="mb-6 flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {hotel.featured && (
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
                  Featured hotel
                </span>
              )}

              {hotel.verified && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  <ShieldCheck size={14} />
                  Verified property
                </span>
              )}
            </div>

            <h1 className="text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
              {hotel.hotelName || "Unnamed hotel"}
            </h1>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <MapPin size={17} className="shrink-0 text-slate-400" />
                {location || hotel.address || "Location unavailable"}
              </span>

              {hotel.starRating && (
                <span className="inline-flex items-center gap-1.5">
                  <Star
                    size={16}
                    className="fill-amber-400 text-amber-400"
                  />
                  {hotel.starRating}
                </span>
              )}
            </div>

            {hotel.address && (
              <p className="mt-2 text-sm text-slate-500">
                {hotel.address}
                {hotel.zipCode ? `, ${hotel.zipCode}` : ""}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500">
              {images.length} {images.length === 1 ? "photo" : "photos"}
            </span>
          </div>
        </section>

        {/* Main photo gallery */}
        <section className="mb-10">
          {images.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-[1.6fr_1fr]">
              <button
                type="button"
                onClick={() => setActiveImage(images[0])}
                className="group relative h-72 overflow-hidden rounded-2xl bg-slate-200 text-left sm:h-96 md:h-[430px]"
                aria-label="View main hotel photo"
              >
                <img
                  src={activeImage || images[0]}
                  alt={hotel.hotelName || "Hotel"}
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]"
                />

                <span className="absolute bottom-4 left-4 rounded-lg bg-black/60 px-3 py-2 text-xs font-semibold text-white">
                  Main photo
                </span>
              </button>

              <div className="grid grid-cols-2 gap-3 md:grid-rows-2">
                {[0, 1, 2, 3].map((index) => {
                  const image = images[index + 1];

                  return (
                    <button
                      key={image || `empty-${index}`}
                      type="button"
                      disabled={!image}
                      onClick={() => image && setActiveImage(image)}
                      className="group relative min-h-32 overflow-hidden rounded-2xl bg-slate-200 disabled:cursor-default"
                      aria-label={`View hotel photo ${index + 2}`}
                    >
                      {image ? (
                        <img
                          src={image}
                          alt={`${hotel.hotelName || "Hotel"} photo ${index + 2}`}
                          className="h-full min-h-32 w-full object-cover transition duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full min-h-32 items-center justify-center text-slate-400">
                          <HotelIcon size={28} />
                        </div>
                      )}

                      {index === 3 && images.length > 5 && (
                        <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-sm font-bold text-white">
                          +{images.length - 5} more photos
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex h-72 flex-col items-center justify-center gap-3 rounded-2xl bg-slate-200 text-slate-500">
              <HotelIcon size={42} />
              <p className="text-sm font-medium">No hotel photos available</p>
            </div>
          )}

          {/* Thumbnail selector */}
          {images.length > 1 && (
            <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
              {images.map((image, index) => (
                <button
                  key={`${image}-${index}`}
                  type="button"
                  onClick={() => setActiveImage(image)}
                  className={`h-20 w-24 shrink-0 overflow-hidden rounded-xl border-2 transition ${activeImage === image
                    ? "border-slate-900"
                    : "border-transparent opacity-70 hover:opacity-100"
                    }`}
                  aria-label={`Select photo ${index + 1}`}
                >
                  <img
                    src={image}
                    alt={`Hotel thumbnail ${index + 1}`}
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Details and booking sidebar */}
        <div className="grid items-start gap-8 lg:grid-cols-[1fr_350px]">
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
              ) : hotel.length === 0 ? (
                <div className={styles.emptyState}>
                  <Search size={36} />
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
                  {hotel.map((category) => (
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
        </div>
      </div>
    </main>
  );
}
