// Sanitising helpers for free-form documents that arrive from the browser.
// Not a "use server" file.

// Client code sends this where the browser needs a server-set time.
export const SERVER_TIMESTAMP = "__SERVER_TIMESTAMP__";

const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const MAX_DEPTH = 8;
const MAX_STRING = 400_000;
const MAX_DOC_BYTES = 1_000_000;

function clean(value, depth) {
  if (depth > MAX_DEPTH) throw new Error("Document is nested too deeply.");
  if (value === SERVER_TIMESTAMP) return new Date().toISOString();
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    if (value.length > MAX_STRING) throw new Error("A text value is too long.");
    return value;
  }
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    return value.slice(0, 2000).map((item) => {
      const next = clean(item, depth + 1);
      return next === undefined ? null : next;
    });
  }
  if (typeof value === "object") {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) {
      throw new Error("Unsupported value in document.");
    }
    const out = {};
    for (const [key, item] of Object.entries(value)) {
      if (FORBIDDEN_KEYS.has(key) || item === undefined) continue;
      const next = clean(item, depth + 1);
      if (next !== undefined) out[key] = next;
    }
    return out;
  }
  return undefined; // functions, symbols, ...
}

// Returns a plain, JSON-safe copy of `input`, or throws.
export function sanitizeDoc(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Invalid data.");
  }
  const out = clean(input, 0);
  if (Buffer.byteLength(JSON.stringify(out), "utf8") > MAX_DOC_BYTES) {
    throw new Error("Data is too large.");
  }
  return out;
}

export function parseJson(value) {
  if (value == null) return {};
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

export const iso = (value) => (value ? new Date(value).toISOString() : null);
