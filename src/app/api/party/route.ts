import { NextRequest, NextResponse } from "next/server";
import { buildPartyPayload } from "@/lib/partyPayload";

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
  return NextResponse.json({ party });
}
