-- HotelReserve MySQL schema (MySQL 8.0+, InnoDB, utf8mb4)
--
-- Run:  mysql -u <user> -p <database> < database/schema.sql

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS users (
  id             CHAR(36)      NOT NULL,
  first_name     VARCHAR(100)  NOT NULL DEFAULT '',
  last_name      VARCHAR(100)  NOT NULL DEFAULT '',
  full_name      VARCHAR(200)  NOT NULL DEFAULT '',
  email          VARCHAR(255)  NOT NULL,
  password_hash  VARCHAR(255)  NULL,                 -- NULL for accounts without a password
  role           ENUM('superadmin','admin','hotel_owner','staff','client') NOT NULL DEFAULT 'client',
  status         ENUM('active','blocked','disabled') NOT NULL DEFAULT 'active',
  phone          VARCHAR(40)   NOT NULL DEFAULT '',
  photo_url      VARCHAR(1024) NOT NULL DEFAULT '',
  provider       ENUM('password','google') NOT NULL DEFAULT 'password',
  profile        JSON          NULL,                 -- extra profile fields (address, city, preferences, ...)
  blocked_at     DATETIME      NULL,
  created_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_login_at  DATETIME      NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- One row per signed-in browser. The session cookie holds a signed token that
-- carries only this id; role and status are always read from `users` on the server.
CREATE TABLE IF NOT EXISTS sessions (
  id          CHAR(36)     NOT NULL,
  user_id     CHAR(36)     NOT NULL,
  expires_at  DATETIME     NOT NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip_address  VARCHAR(45)  NULL,
  user_agent  VARCHAR(255) NULL,
  PRIMARY KEY (id),
  KEY idx_sessions_user (user_id),
  KEY idx_sessions_expires (expires_at),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Only a SHA-256 of the emailed token is stored.
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     CHAR(36)     NOT NULL,
  token_hash  CHAR(64)     NOT NULL,
  expires_at  DATETIME     NOT NULL,
  used_at     DATETIME     NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_reset_token (token_hash),
  KEY idx_reset_user (user_id),
  CONSTRAINT fk_reset_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Login history; also used to throttle repeated failures.
CREATE TABLE IF NOT EXISTS login_logs (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     CHAR(36)     NULL,
  email       VARCHAR(255) NOT NULL,
  success     TINYINT(1)   NOT NULL,
  ip_address  VARCHAR(45)  NULL,
  user_agent  VARCHAR(255) NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_login_email_time (email, created_at),
  KEY idx_login_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ===========================================================================
-- Hotels, rooms, bookings
-- ===========================================================================

-- Queried / joined / filtered attributes are real columns; descriptive
-- attributes of the hotel (description, address, amenities,
-- galleryImages, policies, ...) live in `data` and are merged back on read.
CREATE TABLE IF NOT EXISTS hotels (
  id          CHAR(36)       NOT NULL,
  legacy_id   INT            NULL,
  owner_id    CHAR(36)       NULL,
  hotel_name  VARCHAR(255)   NOT NULL,
  category    VARCHAR(100)   NOT NULL DEFAULT '',
  city        VARCHAR(120)   NOT NULL DEFAULT '',
  state       VARCHAR(120)   NOT NULL DEFAULT '',
  country     VARCHAR(120)   NOT NULL DEFAULT '',
  price       DECIMAL(12,2)  NOT NULL DEFAULT 0,        -- default nightly price
  status      VARCHAR(20)    NOT NULL DEFAULT 'Pending', -- Pending | Approved | Rejected | inactive
  approved    TINYINT(1)     NOT NULL DEFAULT 0,
  featured    TINYINT(1)     NOT NULL DEFAULT 0,
  verified    TINYINT(1)     NOT NULL DEFAULT 0,
  cover_image VARCHAR(1024)  NOT NULL DEFAULT '',
  data        JSON           NULL,
  created_at  DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_hotels_status (status),
  KEY idx_hotels_city (city),
  KEY idx_hotels_state (state),
  KEY idx_hotels_owner (owner_id),
  KEY idx_hotels_legacy (legacy_id),
  CONSTRAINT fk_hotels_owner FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Physical room inventory. A booking is always for ONE physical room.
CREATE TABLE IF NOT EXISTS rooms (
  id               CHAR(36)      NOT NULL,
  hotel_id         CHAR(36)      NOT NULL,
  room_number      VARCHAR(30)   NOT NULL,
  room_type        VARCHAR(100)  NOT NULL DEFAULT 'Standard',
  price_per_night  DECIMAL(12,2) NULL,                  -- NULL = use the hotel's price
  capacity         INT           NOT NULL DEFAULT 2,
  status           ENUM('active','maintenance','inactive') NOT NULL DEFAULT 'active',
  created_at       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_room_number (hotel_id, room_number),
  KEY idx_rooms_hotel_status (hotel_id, status),
  CONSTRAINT fk_rooms_hotel FOREIGN KEY (hotel_id) REFERENCES hotels (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- check_out is the departure day: a stay covers the nights [check_in, check_out).
-- pending and confirmed bookings both hold the room; cancelled / rejected free it.
CREATE TABLE IF NOT EXISTS bookings (
  id                CHAR(36)      NOT NULL,
  booking_number    VARCHAR(40)   NOT NULL,
  user_id           CHAR(36)      NOT NULL,
  hotel_id          CHAR(36)      NOT NULL,
  room_id           CHAR(36)      NOT NULL,
  guest_name        VARCHAR(200)  NOT NULL DEFAULT '',
  guest_email       VARCHAR(255)  NOT NULL DEFAULT '',
  guest_phone       VARCHAR(40)   NOT NULL DEFAULT '',
  hotel_name        VARCHAR(255)  NOT NULL DEFAULT '',
  hotel_image       VARCHAR(1024) NOT NULL DEFAULT '',
  room_type         VARCHAR(100)  NOT NULL DEFAULT '',
  city              VARCHAR(120)  NOT NULL DEFAULT '',
  country           VARCHAR(120)  NOT NULL DEFAULT '',
  check_in          DATE          NOT NULL,
  check_out         DATE          NOT NULL,
  nights            INT           NOT NULL,
  guests            INT           NOT NULL DEFAULT 1,
  price_per_night   DECIMAL(12,2) NOT NULL,
  total_amount      DECIMAL(12,2) NOT NULL,
  commission_rate   DECIMAL(5,2)  NULL,                 -- % taken when the booking is confirmed
  commission_amount DECIMAL(12,2) NULL,
  owner_amount      DECIMAL(12,2) NULL,
  special_requests  TEXT          NULL,
  status            ENUM('pending','confirmed','cancelled','rejected','completed') NOT NULL DEFAULT 'pending',
  payment_status    ENUM('unpaid','paid','refund_pending','refunded') NOT NULL DEFAULT 'unpaid',
  created_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_booking_number (booking_number),
  KEY idx_bookings_user (user_id, created_at),
  KEY idx_bookings_room_dates (room_id, status, check_in, check_out),
  KEY idx_bookings_hotel (hotel_id, status),
  CONSTRAINT fk_bookings_user  FOREIGN KEY (user_id)  REFERENCES users (id),
  CONSTRAINT fk_bookings_hotel FOREIGN KEY (hotel_id) REFERENCES hotels (id),
  CONSTRAINT fk_bookings_room  FOREIGN KEY (room_id)  REFERENCES rooms (id),
  CONSTRAINT chk_booking_dates CHECK (check_out > check_in)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ===========================================================================
-- Payments, refunds, payouts (commission lives on bookings)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS payments (
  id              CHAR(36)      NOT NULL,
  booking_id      CHAR(36)      NOT NULL,
  transaction_id  VARCHAR(80)   NOT NULL,
  amount          DECIMAL(12,2) NOT NULL,
  method          VARCHAR(50)   NOT NULL DEFAULT '',
  status          ENUM('pending','paid','failed','refunded') NOT NULL DEFAULT 'pending',
  recorded_by     CHAR(36)      NULL,
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_payment_txn (transaction_id),
  KEY idx_payments_booking (booking_id),
  CONSTRAINT fk_payments_booking FOREIGN KEY (booking_id) REFERENCES bookings (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS refunds (
  id            CHAR(36)      NOT NULL,
  booking_id    CHAR(36)      NOT NULL,
  amount        DECIMAL(12,2) NOT NULL,
  reason        VARCHAR(500)  NOT NULL DEFAULT '',
  status        VARCHAR(20)   NOT NULL DEFAULT 'Pending',   -- Pending | Approved | Rejected
  decided_by    CHAR(36)      NULL,
  approved_at   DATETIME      NULL,
  rejected_at   DATETIME      NULL,
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_refund_booking (booking_id),
  CONSTRAINT fk_refunds_booking FOREIGN KEY (booking_id) REFERENCES bookings (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- One payout per completed booking: owner_amount, released only after admin approval.
CREATE TABLE IF NOT EXISTS payouts (
  id            CHAR(36)      NOT NULL,
  booking_id    CHAR(36)      NOT NULL,
  hotel_id      CHAR(36)      NOT NULL,
  owner_id      CHAR(36)      NULL,
  total_booking DECIMAL(12,2) NOT NULL,
  commission    DECIMAL(12,2) NOT NULL,
  payout_amount DECIMAL(12,2) NOT NULL,
  status        VARCHAR(20)   NOT NULL DEFAULT 'Pending',   -- Pending | Paid | Rejected
  decided_by    CHAR(36)      NULL,
  paid_at       DATETIME      NULL,
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_payout_booking (booking_id),
  KEY idx_payouts_hotel (hotel_id),
  CONSTRAINT fk_payouts_booking FOREIGN KEY (booking_id) REFERENCES bookings (id),
  CONSTRAINT fk_payouts_hotel   FOREIGN KEY (hotel_id)   REFERENCES hotels (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ===========================================================================
-- Reviews, favorites, notifications
-- ===========================================================================
-- A review is tied to a completed booking of the same user (verified stay).
CREATE TABLE IF NOT EXISTS hotel_reviews (
  id          CHAR(36)     NOT NULL,
  hotel_id    CHAR(36)     NOT NULL,
  user_id     CHAR(36)     NOT NULL,
  booking_id  CHAR(36)     NOT NULL,
  rating      TINYINT      NOT NULL,
  review      TEXT         NOT NULL,
  status      VARCHAR(20)  NOT NULL DEFAULT 'Pending',  -- Pending | Approved | Rejected
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_review_booking (booking_id),
  KEY idx_reviews_hotel (hotel_id, status),
  CONSTRAINT fk_reviews_hotel   FOREIGN KEY (hotel_id)   REFERENCES hotels (id) ON DELETE CASCADE,
  CONSTRAINT fk_reviews_user    FOREIGN KEY (user_id)    REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_reviews_booking FOREIGN KEY (booking_id) REFERENCES bookings (id) ON DELETE CASCADE,
  CONSTRAINT chk_review_rating CHECK (rating BETWEEN 1 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS review_reports (
  id          CHAR(36)     NOT NULL,
  review_id   CHAR(36)     NOT NULL,
  reporter_id CHAR(36)     NULL,
  reason      VARCHAR(500) NOT NULL DEFAULT '',
  status      VARCHAR(20)  NOT NULL DEFAULT 'Pending',  -- Pending | Resolved | Dismissed
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_report_once (review_id, reporter_id),
  CONSTRAINT fk_reports_review FOREIGN KEY (review_id) REFERENCES hotel_reviews (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS favorites (
  user_id     CHAR(36)  NOT NULL,
  hotel_id    CHAR(36)  NOT NULL,
  created_at  DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, hotel_id),
  CONSTRAINT fk_fav_user  FOREIGN KEY (user_id)  REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_fav_hotel FOREIGN KEY (hotel_id) REFERENCES hotels (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS notifications (
  id          CHAR(36)     NOT NULL,
  user_id     CHAR(36)     NOT NULL,
  title       VARCHAR(255) NOT NULL DEFAULT '',
  message     TEXT         NULL,
  category    VARCHAR(40)  NOT NULL DEFAULT 'account',
  type        VARCHAR(40)  NOT NULL DEFAULT 'general',
  icon        VARCHAR(60)  NOT NULL DEFAULT 'notifications',
  action_url  VARCHAR(1024) NULL,
  is_read     TINYINT(1)   NOT NULL DEFAULT 0,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_notif_user (user_id, is_read, created_at),
  CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ===========================================================================
-- Content / configuration collections (document style)
-- ===========================================================================
-- amenities, hotel_categories, locations, banners, advertisements, coupons,
-- roles, adminRoles, admins, aboutCMS, contactCMS, homepageCMS, pushNotifications,
-- emailBroadcasts, contactMessages, activityLogs, settings, destinations.
-- These are free-form admin content with no relations or invariants, so each
-- document is one row (access is restricted per collection in cms.service.js).
CREATE TABLE IF NOT EXISTS records (
  collection  VARCHAR(40)  NOT NULL,
  id          VARCHAR(80)  NOT NULL,
  data        JSON         NOT NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (collection, id),
  KEY idx_records_created (collection, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
