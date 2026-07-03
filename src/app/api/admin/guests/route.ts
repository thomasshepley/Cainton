import { NextRequest, NextResponse } from "next/server";
import {
  addParty,
  addGuestToParty,
  deleteGuest,
  deleteParty,
} from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";

/**
 * Admin guest-list management.
 * POST { action: "addParty", label, guests: string[] }
 * POST { action: "addGuest", partyId, name }
 * POST { action: "deleteGuest", guestId }
 * POST { action: "deleteParty", partyId }
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
      addParty(label, guests);
      return NextResponse.json({ ok: true });
    }
    if (action === "addGuest") {
      const partyId = Number(body.partyId);
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!Number.isInteger(partyId) || partyId <= 0 || !name) {
        return NextResponse.json({ error: "Invalid request" }, { status: 400 });
      }
      addGuestToParty(partyId, name);
      return NextResponse.json({ ok: true });
    }
    if (action === "deleteGuest") {
      const guestId = Number(body.guestId);
      if (!Number.isInteger(guestId) || guestId <= 0) {
        return NextResponse.json({ error: "Invalid request" }, { status: 400 });
      }
      deleteGuest(guestId);
      return NextResponse.json({ ok: true });
    }
    if (action === "deleteParty") {
      const partyId = Number(body.partyId);
      if (!Number.isInteger(partyId) || partyId <= 0) {
        return NextResponse.json({ error: "Invalid request" }, { status: 400 });
      }
      deleteParty(partyId);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    console.error("Admin guests action failed:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
