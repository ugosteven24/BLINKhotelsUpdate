// Shared helpers for the services. Not a "use server" file.
import { randomUUID } from "node:crypto";

export const newId = () => randomUUID();

export function clampInt(value, min, max, fallback) {
  const n = Math.trunc(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function toMoney(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 0;
}

// Business error: message is safe to show to the user.
export class ServiceError extends Error {
  constructor(message, code = "invalid") {
    super(message);
    this.name = "ServiceError";
    this.code = code;
  }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Strict YYYY-MM-DD -> Date at UTC midnight, or null.
export function parseDay(value) {
  if (typeof value !== "string" || !DATE_RE.test(value)) return null;
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value ? null : d;
}

export const todayUtc = () => new Date().toISOString().slice(0, 10);

export function nightsBetween(checkIn, checkOut) {
  return Math.round((parseDay(checkOut) - parseDay(checkIn)) / 86_400_000);
}
