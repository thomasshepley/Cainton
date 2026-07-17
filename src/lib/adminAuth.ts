import { NextRequest } from "next/server";
import { createHash } from "crypto";
import { getSetting } from "@/lib/db";

/**
 * Admin access is gated by a shared password.
 *
 * - If a password has been set from the Settings page, its SHA-256 hash
 *   is stored in the settings table and takes precedence.
 * - Otherwise the ADMIN_PASSWORD env var applies (falling back to a
 *   default for local dev — change it before sharing the site!).
 *
 * Locked out? Reset from the command line (password reverts to the
 * ADMIN_PASSWORD env var):
 *   docker compose exec wedding-rsvp node scripts/reset-admin-password.js
 */

export function hashPassword(password: string): string {
  return createHash("sha256").update(password, "utf8").digest("hex");
}

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export function checkPassword(provided: string): boolean {
  const storedHash = getSetting("admin_password_hash");
  if (storedHash) {
    return timingSafeEqualStr(hashPassword(provided), storedHash);
  }
  const expected = process.env.ADMIN_PASSWORD || "cainton-admin";
  return timingSafeEqualStr(provided, expected);
}

export function isAdmin(req: NextRequest): boolean {
  return checkPassword(req.headers.get("x-admin-key") || "");
}
