import { NextRequest } from "next/server";

/**
 * Admin access is gated by a shared password.
 * Set ADMIN_PASSWORD in .env.local (falls back to a default for local dev —
 * change it before sharing the site!).
 */
export function isAdmin(req: NextRequest): boolean {
  const expected = process.env.ADMIN_PASSWORD || "cainton-admin";
  const provided = req.headers.get("x-admin-key") || "";
  if (provided.length !== expected.length) return false;
  // Constant-time-ish comparison
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}
