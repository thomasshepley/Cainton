import { NextRequest, NextResponse } from "next/server";
import {
  commentForParty,
  getParty,
  guestsForParty,
  logActivity,
  responsesForParty,
  saveRsvp,
  ActivityEntry,
} from "@/lib/db";
import {
  DEFAULT_MENU,
  menuById,
  MENU_COURSE_DISHES,
  parseMeals,
} from "@/lib/site";
import { computeLocks } from "@/lib/settings";
import { diffGuestResponse, diffText, requestContext } from "@/lib/activity";

/**
 * POST an RSVP for a whole party.
 * {
 *   partyId, submittedBy, comment, songRequest,
 *   answers: [{ guestId, attending, meals: { starter, main, dessert } }]
 * }
 *
 * Enforced here (settings-driven):
 * - hidden parties can't be RSVP'd at all
 * - after the RSVP deadline nothing changes (except comment/song when
 *   commentsAfterDeadline is on)
 * - meal locks (global toggle, meal deadline, or lock-after-submit)
 *   silently preserve the stored meal choices
 * - self-edit-only: answers may only change the guest whose name was
 *   used to sign in; other members' answers must match stored state
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
  if (!party || party.hidden === 1) {
    return NextResponse.json({ error: "Party not found" }, { status: 404 });
  }

  const locks = computeLocks();
  const ctx = requestContext(req, body as Record<string, unknown>, submittedBy);
  const members = guestsForParty(partyId);
  const nameById = new Map(members.map((g) => [g.id, g.full_name]));
  const oldResponses = new Map(
    responsesForParty(partyId).map((r) => [r.guest_id, r])
  );
  const oldComment = commentForParty(partyId);

  // ----- RSVPs fully closed: only comment/song may still change -----
  if (locks.rsvpLocked) {
    if (!locks.commentsOpen) {
      return NextResponse.json({ error: locks.closedMessage }, { status: 403 });
    }
    saveRsvp({ partyId, submittedBy, comment, songRequest, answers: [] });
    const entries = [
      ...diffText(partyId, party.label, "Comment", oldComment?.comment ?? "", comment),
      ...diffText(
        partyId,
        party.label,
        "Song request",
        oldComment?.song_request ?? "",
        songRequest
      ),
    ];
    logActivity(entries, ctx);
    return NextResponse.json({ ok: true, note: "rsvp_locked" });
  }

  if (!Array.isArray(body.answers) || body.answers.length === 0) {
    return NextResponse.json(
      { error: "Please answer for at least one guest." },
      { status: 400 }
    );
  }

  // With self-edit-only, the editor is whoever's name was used to sign in
  const editor = members.find(
    (m) => m.full_name.toLowerCase() === submittedBy.toLowerCase()
  );
  if (locks.selfEditOnly && !editor) {
    return NextResponse.json(
      { error: "Please search for your own name to update your response." },
      { status: 403 }
    );
  }

  const mealRequired = party.invite_type === "full";
  const guestMenus = new Map(members.map((g) => [g.id, g.menu]));
  const answers: { guestId: number; attending: boolean; meal: string | null }[] =
    [];
  for (const raw of body.answers as unknown[]) {
    const a = raw as { guestId?: unknown; attending?: unknown; meals?: unknown };
    const guestId = Number(a.guestId);
    if (!Number.isInteger(guestId) || guestId <= 0) {
      return NextResponse.json({ error: "Invalid guest" }, { status: 400 });
    }
    const attending = a.attending === true;
    const old = oldResponses.get(guestId) ?? null;
    const oldMeals = parseMeals(old?.meal);
    const mealsFrozen =
      locks.mealsLocked ||
      (locks.lockAfterSubmit && Object.keys(oldMeals).length > 0);

    let meal: string | null = null;
    if (attending && mealRequired) {
      if (mealsFrozen) {
        // Locked: whatever was stored stays; incoming picks are ignored
        meal = old?.meal ?? null;
      } else {
        const menuId = guestMenus.get(guestId) ?? DEFAULT_MENU;
        const courseDishes = MENU_COURSE_DISHES.get(menuId);
        const picks =
          typeof a.meals === "object" && a.meals !== null && !Array.isArray(a.meals)
            ? (a.meals as Record<string, unknown>)
            : {};
        const canonical: Record<string, string> = {};
        for (const course of menuById(menuId).courses) {
          const pick = picks[course.id];
          if (
            typeof pick !== "string" ||
            !courseDishes?.get(course.id)?.has(pick)
          ) {
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
    }

    // Self-edit-only: anyone else's answer must match what's stored
    if (locks.selfEditOnly && editor && guestId !== editor.id) {
      const oldAttending = old ? old.attending === 1 : null;
      const statusChanged = oldAttending !== attending;
      const mealsChanged =
        attending &&
        JSON.stringify(parseMeals(meal)) !== JSON.stringify(oldMeals);
      if (old === null || statusChanged || mealsChanged) {
        const name = nameById.get(guestId) ?? "each guest";
        return NextResponse.json(
          {
            error: `Only ${name} can change their own response — please ask them to RSVP with their own name.`,
          },
          { status: 403 }
        );
      }
    }

    answers.push({ guestId, attending, meal });
  }

  saveRsvp({ partyId, submittedBy, comment, songRequest, answers });

  const entries: ActivityEntry[] = [];
  for (const a of answers) {
    const guestName = nameById.get(a.guestId);
    if (!guestName) continue; // not in this party — was ignored by saveRsvp
    const old = oldResponses.get(a.guestId);
    entries.push(
      ...diffGuestResponse({
        partyId,
        partyLabel: party.label,
        guestName,
        oldAttending: old ? old.attending : null,
        newAttending: a.attending,
        oldMeal: old?.meal ?? null,
        newMeal: a.meal,
      })
    );
  }
  entries.push(
    ...diffText(partyId, party.label, "Comment", oldComment?.comment ?? "", comment),
    ...diffText(
      partyId,
      party.label,
      "Song request",
      oldComment?.song_request ?? "",
      songRequest
    )
  );
  logActivity(entries, ctx);

  return NextResponse.json({ ok: true });
}
