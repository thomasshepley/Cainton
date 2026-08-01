import { NextRequest, NextResponse } from "next/server";
import {
  addParty,
  addGuestToParty,
  deleteGuest,
  deleteParty,
  getGuestDetail,
  getParty,
  getResponse,
  logActivity,
  setGuestResponse,
  setPartyHidden,
  setPartyInviteType,
} from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";
import {
  getMenus,
  menuById,
  menuCourseDishes,
  menuIds,
} from "@/lib/menus";
import { diffGuestResponse, requestContext } from "@/lib/activity";

/**
 * Admin guest-list management. All actions are recorded in the
 * activity log with actor "Admin".
 * POST { action: "addParty", label, guests: string[] }
 * POST { action: "addGuest", partyId, name }
 * POST { action: "deleteGuest", guestId }
 * POST { action: "deleteParty", partyId }
 * POST { action: "setResponse", guestId, attending: true|false|null,
 *        meals: { courseId: dishId }, menu }
 * POST { action: "setInviteType", partyId, inviteType: "full"|"evening" }
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
  const action = body.action;
  try {
    if (action === "addParty") {
      const label = typeof body.label === "string" ? body.label.trim() : "";
      const guests = Array.isArray(body.guests)
        ? (body.guests as unknown[])
            .filter((g): g is string => typeof g === "string")
            .map((g) => g.trim())
            .filter(Boolean)
        : [];
      if (!label || guests.length === 0) {
        return NextResponse.json(
          { error: "A party needs a label and at least one guest." },
          { status: 400 }
        );
      }
      const inviteType = body.inviteType === "evening" ? "evening" : "full";
      addParty(label, guests, inviteType);
      logActivity(
        [
          {
            partyId: null,
            partyLabel: label,
            subject: label,
            field: "Guest list",
            oldValue: null,
            newValue: `Party added (${guests.join(", ")})`,
          },
        ],
        ctx
      );
      return NextResponse.json({ ok: true });
    }
    if (action === "addGuest") {
      const partyId = Number(body.partyId);
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!Number.isInteger(partyId) || partyId <= 0 || !name) {
        return NextResponse.json({ error: "Invalid request" }, { status: 400 });
      }
      addGuestToParty(partyId, name);
      const party = getParty(partyId);
      logActivity(
        [
          {
            partyId,
            partyLabel: party?.label ?? "",
            subject: name,
            field: "Guest list",
            oldValue: null,
            newValue: "Guest added",
          },
        ],
        ctx
      );
      return NextResponse.json({ ok: true });
    }
    if (action === "deleteGuest") {
      const guestId = Number(body.guestId);
      if (!Number.isInteger(guestId) || guestId <= 0) {
        return NextResponse.json({ error: "Invalid request" }, { status: 400 });
      }
      const guest = getGuestDetail(guestId);
      deleteGuest(guestId);
      if (guest) {
        logActivity(
          [
            {
              partyId: guest.party_id,
              partyLabel: guest.party_label,
              subject: guest.full_name,
              field: "Guest list",
              oldValue: "On the list",
              newValue: "Removed",
            },
          ],
          ctx
        );
      }
      return NextResponse.json({ ok: true });
    }
    if (action === "setResponse") {
      const guestId = Number(body.guestId);
      if (!Number.isInteger(guestId) || guestId <= 0) {
        return NextResponse.json({ error: "Invalid request" }, { status: 400 });
      }
      const attending =
        body.attending === true ? true : body.attending === false ? false : null;
      const menus = getMenus();
      const menu =
        typeof body.menu === "string" && menuIds(menus).has(body.menu)
          ? body.menu
          : undefined;
      // Keep only picks that are valid dishes for the guest's menu.
      // Admins may set courses one at a time, so partial picks are fine.
      const courseDishes = menu
        ? menuCourseDishes(menus).get(menu)
        : undefined;
      let meal: string | null = null;
      if (
        typeof body.meals === "object" &&
        body.meals !== null &&
        !Array.isArray(body.meals) &&
        courseDishes
      ) {
        const cleaned: Record<string, string> = {};
        for (const [courseId, dishId] of Object.entries(
          body.meals as Record<string, unknown>
        )) {
          if (
            typeof dishId === "string" &&
            courseDishes.get(courseId)?.has(dishId)
          ) {
            cleaned[courseId] = dishId;
          }
        }
        if (Object.keys(cleaned).length > 0) meal = JSON.stringify(cleaned);
      }
      // Snapshot before the change so the log can show old -> new
      const before = getGuestDetail(guestId);
      const oldResponse = before ? getResponse(guestId) : null;
      if (!setGuestResponse(guestId, attending, meal, menu)) {
        return NextResponse.json({ error: "Guest not found" }, { status: 404 });
      }
      if (before) {
        const entries = [];
        if (menu && menu !== before.menu) {
          entries.push({
            partyId: before.party_id,
            partyLabel: before.party_label,
            subject: before.full_name,
            field: "Menu",
            oldValue: menuById(menus, before.menu).label,
            newValue: menuById(menus, menu).label,
          });
        }
        if (attending === null) {
          if (oldResponse) {
            entries.push({
              partyId: before.party_id,
              partyLabel: before.party_label,
              subject: before.full_name,
              field: "RSVP",
              oldValue:
                oldResponse.attending === 1 ? "Attending" : "Declined",
              newValue: "No response",
            });
          }
        } else {
          entries.push(
            ...diffGuestResponse({
              partyId: before.party_id,
              partyLabel: before.party_label,
              guestName: before.full_name,
              oldAttending: oldResponse ? oldResponse.attending : null,
              newAttending: attending,
              oldMeal: oldResponse?.meal ?? null,
              newMeal: attending ? meal : null,
            })
          );
        }
        logActivity(entries, ctx);
      }
      return NextResponse.json({ ok: true });
    }
    if (action === "setInviteType") {
      const partyId = Number(body.partyId);
      const inviteType = body.inviteType === "evening" ? "evening" : "full";
      if (!Number.isInteger(partyId) || partyId <= 0) {
        return NextResponse.json({ error: "Invalid request" }, { status: 400 });
      }
      const before = getParty(partyId);
      if (!setPartyInviteType(partyId, inviteType)) {
        return NextResponse.json({ error: "Party not found" }, { status: 404 });
      }
      if (before && before.invite_type !== inviteType) {
        logActivity(
          [
            {
              partyId,
              partyLabel: before.label,
              subject: before.label,
              field: "Invitation",
              oldValue:
                before.invite_type === "evening" ? "Evening only" : "Full day",
              newValue: inviteType === "evening" ? "Evening only" : "Full day",
            },
          ],
          ctx
        );
      }
      return NextResponse.json({ ok: true });
    }
    if (action === "setHidden") {
      const partyId = Number(body.partyId);
      const hidden = body.hidden === true;
      if (!Number.isInteger(partyId) || partyId <= 0) {
        return NextResponse.json({ error: "Invalid request" }, { status: 400 });
      }
      const before = getParty(partyId);
      if (!setPartyHidden(partyId, hidden)) {
        return NextResponse.json({ error: "Party not found" }, { status: 404 });
      }
      if (before && (before.hidden === 1) !== hidden) {
        logActivity(
          [
            {
              partyId,
              partyLabel: before.label,
              subject: before.label,
              field: "Visibility",
              oldValue: before.hidden === 1 ? "Hidden from lookup" : "Visible",
              newValue: hidden ? "Hidden from lookup" : "Visible",
            },
          ],
          ctx
        );
      }
      return NextResponse.json({ ok: true });
    }
    if (action === "deleteParty") {
      const partyId = Number(body.partyId);
      if (!Number.isInteger(partyId) || partyId <= 0) {
        return NextResponse.json({ error: "Invalid request" }, { status: 400 });
      }
      const before = getParty(partyId);
      deleteParty(partyId);
      if (before) {
        logActivity(
          [
            {
              partyId,
              partyLabel: before.label,
              subject: before.label,
              field: "Guest list",
              oldValue: "On the list",
              newValue: "Party deleted",
            },
          ],
          ctx
        );
      }
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    console.error("Admin guests action failed:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
