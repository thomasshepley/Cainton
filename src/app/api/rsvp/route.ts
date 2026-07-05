import { NextRequest, NextResponse } from "next/server";
import { getParty, saveRsvp } from "@/lib/db";
import { site } from "@/lib/site";

const VALID_MEALS = new Set<string>(site.mealOptions.map((m) => m.id));

/**
 * POST an RSVP for a whole party.
 * {
 *   partyId, submittedBy, comment, songRequest,
 *   answers: [{ guestId, attending, meal }]
 * }
 * Meal choices apply to full-day parties only (the sit-down wedding
 * breakfast); evening-only guests never pick a meal.
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
  const answers: { guestId: number; attending: boolean; meal: string | null }[] =
    [];
  for (const raw of body.answers as unknown[]) {
    const a = raw as { guestId?: unknown; attending?: unknown; meal?: unknown };
    const guestId = Number(a.guestId);
    if (!Number.isInteger(guestId) || guestId <= 0) {
      return NextResponse.json({ error: "Invalid guest" }, { status: 400 });
    }
    const attending = a.attending === true;
    let meal: string | null = null;
    if (attending && mealRequired) {
      if (typeof a.meal !== "string" || !VALID_MEALS.has(a.meal)) {
        return NextResponse.json(
          { error: "Please choose a meal for each attending guest." },
          { status: 400 }
        );
      }
      meal = a.meal;
    }
    answers.push({ guestId, attending, meal });
  }

  saveRsvp({ partyId, submittedBy, comment, songRequest, answers });
  return NextResponse.json({ ok: true });
}
