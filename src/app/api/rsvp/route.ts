import { NextRequest, NextResponse } from "next/server";
import { getParty, guestsForParty, saveRsvp } from "@/lib/db";
import { DEFAULT_MENU, menuById, MENU_COURSE_DISHES } from "@/lib/site";

/**
 * POST an RSVP for a whole party.
 * {
 *   partyId, submittedBy, comment, songRequest,
 *   answers: [{ guestId, attending, meals: { starter, main, dessert } }]
 * }
 * Meal choices apply to full-day parties only (the sit-down lunch);
 * evening-only guests never pick meals. Each attending
 * guest must choose one dish per course, all from the menu the couple
 * assigned them (adult by default; set via the admin dashboard) —
 * guests cannot switch menus themselves.
 */
export async function POST(req: NextRequest) {
  let body: {
    partyId?: unknown;
    submittedBy?: unknown;
    comment?: unknown;
    songRequest?: unknown;
    answers?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const partyId = Number(body.partyId);
  const submittedBy =
    typeof body.submittedBy === "string" ? body.submittedBy.trim().slice(0, 100) : "";
  const comment = typeof body.comment === "string" ? body.comment : "";
  const songRequest = typeof body.songRequest === "string" ? body.songRequest : "";

  if (!Number.isInteger(partyId) || partyId <= 0 || !submittedBy) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const party = getParty(partyId);
  if (!party) {
    return NextResponse.json({ error: "Party not found" }, { status: 404 });
  }
  if (!Array.isArray(body.answers) || body.answers.length === 0) {
    return NextResponse.json(
      { error: "Please answer for at least one guest." },
      { status: 400 }
    );
  }

  const mealRequired = party.invite_type === "full";
  // Menus are assigned server-side (guests table), never by the client
  const guestMenus = new Map(
    guestsForParty(partyId).map((g) => [g.id, g.menu])
  );
  const answers: { guestId: number; attending: boolean; meal: string | null }[] =
    [];
  for (const raw of body.answers as unknown[]) {
    const a = raw as { guestId?: unknown; attending?: unknown; meals?: unknown };
    const guestId = Number(a.guestId);
    if (!Number.isInteger(guestId) || guestId <= 0) {
      return NextResponse.json({ error: "Invalid guest" }, { status: 400 });
    }
    const attending = a.attending === true;
    let meal: string | null = null;
    if (attending && mealRequired) {
      const menuId = guestMenus.get(guestId) ?? DEFAULT_MENU;
      const courseDishes = MENU_COURSE_DISHES.get(menuId);
      const picks =
        typeof a.meals === "object" && a.meals !== null && !Array.isArray(a.meals)
          ? (a.meals as Record<string, unknown>)
          : {};
      // One valid dish per course of the guest's menu, nothing extra
      const canonical: Record<string, string> = {};
      for (const course of menuById(menuId).courses) {
        const pick = picks[course.id];
        if (typeof pick !== "string" || !courseDishes?.get(course.id)?.has(pick)) {
          return NextResponse.json(
            {
              error: `Please choose a ${course.label.toLowerCase()} for each attending guest.`,
            },
            { status: 400 }
          );
        }
        canonical[course.id] = pick;
      }
      meal = JSON.stringify(canonical);
    }
    answers.push({ guestId, attending, meal });
  }

  saveRsvp({ partyId, submittedBy, comment, songRequest, answers });
  return NextResponse.json({ ok: true });
}
