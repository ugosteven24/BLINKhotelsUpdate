"use client";

import { logout as logoutAction } from "@/services/auth.service";

// Signs the user out: the Server Action deletes the session row in MySQL and
// clears the HTTP-only cookie.
export async function logout() {
  const result = await logoutAction();

  if (!result?.ok) {
    throw new Error(result?.message || "Unable to sign out.");
  }
}
