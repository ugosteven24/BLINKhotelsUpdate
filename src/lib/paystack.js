// Server-only Paystack client. Reads PAYSTACK_SECRET_KEY lazily so a missing key cannot break `next build`.
const BASE = "https://api.paystack.co";

export class ProviderError extends Error {
  // apiRejected = Paystack answered and said no (safe to treat as failed). Otherwise the outcome is UNKNOWN (timeout/network).
  constructor(message, apiRejected) { super(message); this.apiRejected = apiRejected; }
}

async function call(path, { method = "GET", body } = {}) {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new ProviderError("PAYSTACK_SECRET_KEY is not configured on the server.", true);
  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
  } catch (e) {
    throw new ProviderError(`Could not reach Paystack (${e.name}).`, false);
  }
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.status) throw new ProviderError(json?.message || `Paystack error (${res.status})`, true);
  return json.data;
}

export const verifyTransaction = (reference) => call(`/transaction/verify/${encodeURIComponent(reference)}`);
export const createRefund = (payload) => call("/refund", { method: "POST", body: payload });
export const fetchRefund = (id) => call(`/refund/${encodeURIComponent(id)}`);
export const listRefunds = (reference) => call(`/refund?reference=${encodeURIComponent(reference)}`);
