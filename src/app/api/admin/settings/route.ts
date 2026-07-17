import { NextRequest, NextResponse } from "next/server";
import { logActivity, setSetting } from "@/lib/db";
import { checkPassword, hashPassword, isAdmin } from "@/lib/adminAuth";
import { readSettings, SiteSettings } from "@/lib/settings";
import { requestContext } from "@/lib/activity";

/** GET current settings (admin only) */
export async function GET(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ settings: readSettings() });
}

const BOOL_KEYS: (keyof SiteSettings)[] = [
  "lockMeals",
  "selfEditOnly",
  "lockAfterSubmit",
  "commentsAfterDeadline",
];
const TEXT_KEYS: (keyof SiteSettings)[] = [
  "mealDeadline",
  "rsvpDeadline",
  "closedMessage",
];

/**
 * POST { action: "update", changes: Partial<SiteSettings> }
 * POST { action: "changePassword", current, next }
 */
export async function POST(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const ctx = requestContext(req, body, "Admin");

  if (body.action === "changePassword") {
    const current = typeof body.current === "string" ? body.current : "";
    const next = typeof body.next === "string" ? body.next : "";
    if (!checkPassword(current)) {
      return NextResponse.json(
        { error: "Current password is incorrect." },
        { status: 400 }
      );
    }
    if (next.length < 8) {
      return NextResponse.json(
        { error: "New password must be at least 8 characters." },
        { status: 400 }
      );
    }
    setSetting("admin_password_hash", hashPassword(next));
    logActivity(
      [
        {
          partyId: null,
          partyLabel: "",
          subject: "Admin panel",
          field: "Settings",
          oldValue: null,
          newValue: "Admin password changed",
        },
      ],
      ctx
    );
    return NextResponse.json({ ok: true });
  }

  if (body.action === "update") {
    const changes =
      typeof body.changes === "object" && body.changes !== null
        ? (body.changes as Record<string, unknown>)
        : {};
    const before = readSettings();
    const entries = [];
    for (const key of BOOL_KEYS) {
      if (typeof changes[key] === "boolean") {
        const next = changes[key] as boolean;
        if (next !== before[key]) {
          setSetting(key, next ? "1" : "0");
          entries.push({
            partyId: null,
            partyLabel: "",
            subject: "Site settings",
            field: "Settings",
            oldValue: `${key}: ${before[key] ? "on" : "off"}`,
            newValue: `${key}: ${next ? "on" : "off"}`,
          });
        }
      }
    }
    for (const key of TEXT_KEYS) {
      if (typeof changes[key] === "string") {
        const next = (changes[key] as string).slice(0, 2000);
        // Deadlines must be valid timestamps (or empty to clear)
        if (
          (key === "mealDeadline" || key === "rsvpDeadline") &&
          next !== "" &&
          Number.isNaN(new Date(next).getTime())
        ) {
          return NextResponse.json(
            { error: "Invalid date/time." },
            { status: 400 }
          );
        }
        if (next !== before[key]) {
          setSetting(key, next);
          entries.push({
            partyId: null,
            partyLabel: "",
            subject: "Site settings",
            field: "Settings",
            oldValue: `${key}: ${before[key] || "—"}`,
            newValue: `${key}: ${next || "—"}`,
          });
        }
      }
    }
    logActivity(entries, ctx);
    return NextResponse.json({ ok: true, settings: readSettings() });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
