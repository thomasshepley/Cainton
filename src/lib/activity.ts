import { NextRequest } from "next/server";
import { ActivityContext, ActivityEntry } from "@/lib/db";
import { parseMeals } from "@/lib/site";
import { courseOrder, dishLabels, getMenus } from "@/lib/menus";

/**
 * Request metadata stored with each activity entry so the couple can
 * sanity-check that a change really came from the right person.
 * The client sends its own timezone in the request body (`client.timezone`).
 */
export function requestContext(
  req: NextRequest,
  body: Record<string, unknown>,
  actor: string
): ActivityContext {
  const forwarded = req.headers.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null;
  const client =
    typeof body.client === "object" && body.client !== null
      ? (body.client as Record<string, unknown>)
      : {};
  return {
    actor,
    ip,
    userAgent: req.headers.get("user-agent"),
    language: req.headers.get("accept-language"),
    timezone: typeof client.timezone === "string" ? client.timezone : null,
  };
}

export function statusLabel(attending: number | boolean | null): string {
  if (attending === null) return "No response";
  return attending === 1 || attending === true ? "Attending" : "Declined";
}

function dishLabel(
  labels: Map<string, string>,
  dishId: string | undefined
): string {
  return dishId ? (labels.get(dishId) ?? dishId) : "—";
}

/**
 * Diff one guest's stored response against incoming values, producing
 * human-readable activity entries (only for what actually changed).
 */
export function diffGuestResponse(input: {
  partyId: number;
  partyLabel: string;
  guestName: string;
  oldAttending: number | null;
  newAttending: boolean;
  oldMeal: string | null;
  newMeal: string | null;
}): ActivityEntry[] {
  const entries: ActivityEntry[] = [];
  const base = {
    partyId: input.partyId,
    partyLabel: input.partyLabel,
    subject: input.guestName,
  };
  const oldStatus = statusLabel(input.oldAttending);
  const newStatus = statusLabel(input.newAttending);
  if (oldStatus !== newStatus) {
    entries.push({
      ...base,
      field: "RSVP",
      oldValue: oldStatus,
      newValue: newStatus,
    });
  }
  const menus = getMenus();
  const labels = dishLabels(menus);
  const oldPicks = parseMeals(input.oldMeal);
  const newPicks = parseMeals(input.newMeal);
  for (const course of courseOrder(menus)) {
    const before = oldPicks[course.id];
    const after = newPicks[course.id];
    if (before !== after) {
      entries.push({
        ...base,
        field: course.label,
        oldValue: dishLabel(labels, before),
        newValue: dishLabel(labels, after),
      });
    }
  }
  return entries;
}

/** Diff a party-level text field (comment / song request) */
export function diffText(
  partyId: number,
  partyLabel: string,
  field: string,
  before: string,
  after: string
): ActivityEntry[] {
  const a = before.trim();
  const b = after.trim();
  if (a === b) return [];
  return [
    {
      partyId,
      partyLabel,
      subject: partyLabel,
      field,
      oldValue: a || "—",
      newValue: b || "—",
    },
  ];
}
