// Masks sensitive values before a provider payload is shown in the admin UI.
const SENSITIVE = /(authorization|card|bin|last4|signature|secret|token|key|email|phone|account|ip_address|password|cvv|pin|bank)/i;

export function redact(value, depth = 0) {
  if (depth > 8) return "[…]";
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, SENSITIVE.test(k) && v != null && typeof v !== "object" ? "[redacted]" : redact(v, depth + 1)]));
  }
  return value;
}

export function safePayloadText(raw) {
  try {
    const obj = typeof raw === "string" ? JSON.parse(raw) : raw;
    return JSON.stringify(redact(obj), null, 2);
  } catch {
    return "[payload is not valid JSON and is hidden]";
  }
}
