# Firebase -> MySQL migration notes

Status: code complete, **not yet built or run against a database**. Do the checklist at the bottom first.

## Architecture
- `src/lib/db/connection.js` - one cached `mysql2/promise` pool (env `DB_*`), `query()`, `run()`, `withTransaction()` (always releases the connection, rolls back on error).
- `src/services/*.service.js` - every file starts with `"use server"`. Pages call these Server Actions; SQL never reaches the browser.
- `src/lib/*` - server-side helpers that are NOT public endpoints (session internals, mappers, availability rules, finance rules, sanitiser).
- Auth: bcrypt (`bcryptjs`) password hashes; a signed JWT in an HTTP-only cookie that carries only a session id; the `sessions` table is checked on every request, and role + blocked status are read from `users` each time. `proxy.js` is a cheap first gate; the real check is in the `(Admin)` layout and in each action (`requireUser` / `requireRole`).
- Booking integrity: a booking holds one physical room. Inside a transaction the hotel's active rooms are locked (`SELECT ... FOR UPDATE`, id order), overlap is checked (`check_in < new_out AND check_out > new_in`, status pending/confirmed/completed), the price is recomputed server-side. Approval re-checks under a room lock. Cancel/reject frees the room.
- Money: commission % (settings `commission`, default 10 or `PLATFORM_COMMISSION_PERCENT`) is fixed on the booking at approval. A payout row appears when a booking is completed AND paid; an admin marks it paid.

## Services
auth, hotel, room, booking, payment (payments/refunds/payouts/commission), review, user (profile, users, favourites), notification, security (login logs), cms (generic content/config collections with a per-collection policy).

## Tables
users, sessions, password_reset_tokens, login_logs, hotels, rooms, bookings, payments, refunds, payouts, hotel_reviews, review_reports, favorites, notifications, records (content/config documents).

## Not migrated / needs your decision
- Google sign-in: needs a Google OAuth client + callback; the button shows "unavailable".
- Password-reset email: token is created, but no mail transport; the link is printed to the server console in development. There is no `/reset-password` page yet (`resetPassword` action exists).
- Existing Firebase users/data: no data import was written. Firebase password hashes cannot be turned into bcrypt hashes; users must reset passwords (or import with Firebase's scrypt parameters and verify once at login).
- Payment gateway: none. An admin records the payment (`recordPayment`); there is no payment UI button yet.
- Auto-complete of finished stays: admin action only (`completeBooking`), no scheduler.
- Reviews / reporting / payments have services but no new client UI was added (no page called them before).
- Backup page: only stores settings; real backups should use `mysqldump`.
- Settings (gateway/SMTP keys) are stored as plain JSON in `records` (superadmin only). Encrypt them before production.
- Realtime notifications became 30-second polling.
- Hotels need rooms: add them at `/superadmin/hotels/<id>/rooms` or the hotel cannot be booked.
- `app/api/reverse-geocode/route.js` already existed and was left as is.

## Checklist (nothing below has been run yet)
1. `npm install` (regenerates package-lock.json; the old one listed firebase).
2. Create the database, run `database/schema.sql`.
3. Copy `.env.example` to `.env.local`; fill `DB_*`, `SESSION_SECRET`. Delete the `FIREBASE_*` lines from your own `.env.local` and revoke those keys.
4. `node --env-file=.env.local database/create-superadmin.mjs you@example.com "Password" First Last`
5. `npm run build` and fix anything it reports.
6. Try: register, login, /Adminlogin, add hotel, approve, add rooms, book twice for the same dates (second must fail), cancel, approve, record payment, complete, payout.
