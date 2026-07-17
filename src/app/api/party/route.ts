import { NextRequest, NextResponse } from "next/server";
import { buildPartyPayload } from "@/lib/partyPayload";
import { getGuestDetail, logActivity } from "@/lib/db";
import { requestContext } from "@/lib/activity";

/** POST { guestId } -> party details for a guest picked from the candidate list */
export async function POST(req: NextRequest) {
  let body: { guestId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const guestId = Number(body.guestId);
  if (!Number.isInteger(guestId) || guestId <= 0) {
    return NextResponse.json({ error: "Invalid guest" }, { status: 400 });
  }
  const party = buildPartyPayload(guestId);
  if (!party) {
    return NextResponse.json({ error: "Guest not found" }, { status: 404 });
  }
  const guest = getGuestDetail(guestId);
  if (guest) {
    logActivity(
      [
        {
          partyId: guest.party_id,
          partyLabel: guest.party_label,
          subject: guest.full_name,
          field: "Access",
          oldValue: null,
          newValue: "Found invitation (picked from name suggestions)",
        },
      ],
      requestContext(req, body as Record<string, unknown>, guest.full_name)
    );
  }
  return NextResponse.json({ party });
}
