import { NextRequest, NextResponse } from "next/server";
import { deleteSetting, logActivity, setSetting } from "@/lib/db";
import { checkPassword, hashPassword, isAdmin } from "@/lib/adminAuth";
import { readSettings, SiteSettings } from "@/lib/settings";
import { requestContext } from "@/lib/activity";
import { DEFAULT_MENUS, getMenus } from "@/lib/menus";
import { MenuDef, TAG_IDS } from "@/lib/site";

/** GET current settings and menus (admin only) */
export async function GET(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ settings: readSettings(), menus: getMenus() });
}

/**
 * Validate an incoming menu structure. Returns an error message, or
 * null when the menus are usable.
 */
function validateMenus(value: unknown): string | null {
  if (!Array.isArray(value) || value.length === 0) {
    return "There must be at least one menu.";
  }
  const seenIds = new Set<string>();
  for (const menu of value as MenuDef[]) {
    if (!menu?.id || typeof menu.id !== "string") return "A menu is missing its id.";
    if (seenIds.has(menu.id)) return `Duplicate menu id "${menu.id}".`;
    seenIds.add(menu.id);
    if (!menu.label?.trim()) return "Every menu needs a name.";
    if (!Array.isArray(menu.courses) || menu.courses.length === 0) {
      return `"${menu.label}" needs at least one course.`;
    }
    for (const course of menu.courses) {
      if (!course?.id || !course.label?.trim()) {
        return `A course in "${menu.label}" needs a name.`;
      }
      if (!Array.isArray(course.options) || course.options.length === 0) {
        return `"${course.label}" in "${menu.label}" needs at least one dish.`;
      }
      for (const dish of course.options) {
        if (!dish?.id || typeof dish.id !== "string") {
          return "A dish is missing its id.";
        }
        if (!dish.label?.trim()) {
          return `A dish in "${course.label}" needs a name.`;
        }
        if (seenIds.has(dish.id)) return `Duplicate dish id "${dish.id}".`;
        seenIds.add(dish.id);
        for (const v of dish.variants ?? []) {
          if (!v?.id || !v.label?.trim()) {
            return `An option of "${dish.label}" needs a name.`;
          }
          if (seenIds.has(v.id)) return `Duplicate option id "${v.id}".`;
          seenIds.add(v.id);
        }
      }
    }
  }
  return null;
}

/** Strip unknown fields so only the menu shape is persisted */
function normalizeMenus(value: MenuDef[]): MenuDef[] {
  return value.map((m) => ({
    id: m.id,
    label: m.label.trim(),
    courses: m.courses.map((c) => ({
      id: c.id,
      label: c.label.trim(),
      options: c.options.map((o) => ({
        id: o.id,
        label: o.label.trim(),
        description: (o.description ?? "").trim(),
        ...(o.tags?.length
          ? { tags: o.tags.filter((t) => TAG_IDS.has(t)) }
          : {}),
        ...(o.variants?.length
          ? {
              variants: o.variants.map((v) => ({
                id: v.id,
                label: v.label.trim(),
              })),
            }
          : {}),
      })),
    })),
  }));
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
 * POST { action: "saveMenus", menus }
 * POST { action: "resetMenus" }
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

  if (body.action === "saveMenus") {
    if (!Array.isArray(body.menus)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    // Menu and course structure is fixed — only the dishes within each
    // existing course can be changed, so rebuild from the current shape
    const incoming = body.menus as MenuDef[];
    const merged: MenuDef[] = getMenus().map((menu) => {
      const inc = incoming.find((m) => m.id === menu.id);
      return {
        ...menu,
        courses: menu.courses.map((course) => {
          const incCourse = inc?.courses.find((c) => c.id === course.id);
          return {
            ...course,
            options: Array.isArray(incCourse?.options)
              ? incCourse.options
              : course.options,
          };
        }),
      };
    });
    const problem = validateMenus(merged);
    if (problem) {
      return NextResponse.json({ error: problem }, { status: 400 });
    }
    const menus = normalizeMenus(merged);
    setSetting("menus", JSON.stringify(menus));
    logActivity(
      [
        {
          partyId: null,
          partyLabel: "",
          subject: "Menus",
          field: "Settings",
          oldValue: null,
          newValue: `Menus updated (${menus
            .map((m) => m.label)
            .join(", ")})`,
        },
      ],
      ctx
    );
    return NextResponse.json({ ok: true, menus: getMenus() });
  }

  if (body.action === "resetMenus") {
    deleteSetting("menus");
    logActivity(
      [
        {
          partyId: null,
          partyLabel: "",
          subject: "Menus",
          field: "Settings",
          oldValue: null,
          newValue: "Menus reset to the built-in defaults",
        },
      ],
      ctx
    );
    return NextResponse.json({ ok: true, menus: DEFAULT_MENUS });
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
