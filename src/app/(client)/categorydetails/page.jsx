import Link from "next/link";
import {
  MapPin,
  Hotel,
  ArrowRight,
  SearchX,
  Star,
} from "lucide-react";

import {
  getHotelsByRoomAndCity,
  getOtherRoomCategories,
} from "@/services/hotel.service";

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

export default async function CategoryDetailsPage({ searchParams }) {
  const params = await searchParams;

  const roomName =
    typeof params.category === "string" ? params.category : "";

  const city =
    typeof params.city === "string" ? params.city : "";

  if (!roomName || !city) {
    return (
      <main className="min-h-screen p-10 text-center">
        <h1 className="text-xl font-bold">
          Room category and city are required.
        </h1>
        <Link href="/explore" className="mt-4 inline-block text-indigo-600">
          Explore hotels
        </Link>
      </main>
    );
  }

  let hotels = [];
  let otherCategories = [];
  let error = "";

  try {
    [hotels, otherCategories] = await Promise.all([
      getHotelsByRoomAndCity(roomName, city),
      getOtherRoomCategories(roomName, city),
    ]);
  } catch (err) {
    console.error("Failed to fetch category details:", err);
    error = "Unable to load hotels. Please try again later.";
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl">

        {/* Page heading */}
        <div className="mb-8">
          <p className="text-sm font-semibold text-blue-600">
            Explore hotels
          </p>

          <h1 className="mt-2 text-3xl font-extrabold text-slate-900">
            {roomName} Hotels
          </h1>

          <div className="mt-3 flex items-center gap-2 text-sm text-slate-500">
            <MapPin size={17} />
            {city}
          </div>

          {!error && (
            <p className="mt-3 text-sm text-slate-500">
              {hotels.length} hotels found
            </p>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-2xl border border-red-200 bg-white p-10 text-center">
            <p className="font-semibold text-red-600">{error}</p>
          </div>
        )}

        {/* Current category hotels */}
        {!error && hotels.length === 0 && (
          <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 text-center">
            <SearchX size={45} className="text-slate-400" />

            <h2 className="mt-4 text-xl font-bold text-slate-900">
              No hotels found
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              No {roomName} hotels were found in {city}.
            </p>

            <Link
              href="/explore"
              className="mt-6 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-700"
            >
              Explore other hotels
            </Link>
          </div>
        )}

        {!error && hotels.length > 0 && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {hotels.map((hotel) => (
              <article
                key={`${hotel.id}-${hotel.matchedRoomTypeId}`}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="relative h-56 bg-slate-200">
                  {hotel.coverImage ? (
                    <img
                      src={hotel.coverImage}
                      alt={hotel.hotelName || "Hotel"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Hotel size={45} className="text-slate-400" />
                    </div>
                  )}

                  {hotel.featured && (
                    <span className="absolute left-4 top-4 rounded-full bg-amber-400 px-3 py-1 text-xs font-bold text-amber-950">
                      Featured
                    </span>
                  )}
                </div>

                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-lg font-bold text-slate-900">
                      {hotel.hotelName || "Unnamed hotel"}
                    </h2>

                    {hotel.starRating > 0 && (
                      <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-amber-500">
                        <Star size={15} fill="currentColor" />
                        {hotel.starRating}
                      </span>
                    )}
                  </div>

                  <p className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                    <MapPin size={16} />
                    {[hotel.city, hotel.state]
                      .filter(Boolean)
                      .join(", ")}
                  </p>

                  <div className="mt-4 rounded-xl bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">
                      Matching room type
                    </p>

                    <p className="mt-1 font-semibold text-slate-900">
                      {hotel.roomName}
                    </p>

                    <p className="mt-1 text-lg font-bold text-indigo-600">
                      {formatPrice(hotel.roomPrice) || "Price unavailable"}
                    </p>
                  </div>

                  <div className="mt-5 border-t border-slate-100 pt-4">
                    <Link
                      href={`/hoteldetails/${encodeURIComponent(hotel.id)}`}
                      className="flex w-full items-center justify-center gap-2 rounded-1xl bg-blue-200 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-300"
                    >
                      View hotel
                      <ArrowRight size={16} />
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {/* Other room categories */}
        {!error && otherCategories.length > 0 && (
          <section className="mt-16 border-t border-slate-200 pt-10">
            <div className="mb-6">
              <p className="text-sm font-semibold text-blue-600">
                Discover more
              </p>

              <h2 className="mt-2 text-2xl font-extrabold text-slate-900">
                Other Room Categories in {city}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Explore other room options available in hotels around {city}.
              </p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {otherCategories.map((item) => (
                <Link
                  key={item.category_name}
                  href={`/categorydetails?category=${encodeURIComponent(
                    item.category_name
                  )}&city=${encodeURIComponent(city)}`}
                  className="group rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-1 hover:border-indigo-300 hover:shadow-lg"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-blue-600">
                      <Hotel size={22} />
                    </div>

                    <ArrowRight
                      size={19}
                      className="text-slate-400 transition group-hover:translate-x-1 group-hover:text-blue-600"
                    />
                  </div>

                  <h3 className="mt-4 text-lg font-bold text-slate-900">
                    {item.category_name}
                  </h3>

                  <p className="mt-2 text-sm text-slate-500">
                    {item.hotel_count}{" "}
                    {item.hotel_count === 1 ? "hotel" : "hotels"}
                  </p>

                  <p className="mt-3 text-sm font-semibold text-blue-600">
                    {item.starting_price !== null
                      ? `From ${formatPrice(item.starting_price)}`
                      : "Price unavailable"}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}

      </div>
    </main>
  );
}