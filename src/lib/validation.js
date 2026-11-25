// Small server-side validation helpers shared by the services.
// (Not a "use server" file, so it can export plain synchronous functions.)

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function cleanString(value, max = 255) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function normalizeEmail(value) {
  return cleanString(value, 255).toLowerCase();
}

export function isValidEmail(value) {
  return typeof value === "string" && value.length <= 255 && EMAIL_RE.test(value);
}

// bcrypt only uses the first 72 BYTES of a password, so longer input is rejected.
export function isAcceptablePassword(value) {
  return (
    typeof value === "string" &&
    value.length >= 6 &&
    Buffer.byteLength(value, "utf8") <= 72
  );
}
