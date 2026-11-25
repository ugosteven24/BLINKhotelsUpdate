import crypto from "node:crypto";

// Paystack signs the RAW request body with HMAC-SHA512 using your secret key (x-paystack-signature header).
export function verifyPaystackSignature(rawBody, signature, secret) {
  if (!signature || !secret) return false;
  const expected = Buffer.from(crypto.createHmac("sha512", secret).update(rawBody).digest("hex"), "utf8");
  const given = Buffer.from(String(signature), "utf8");
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}
