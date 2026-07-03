import { NextRequest, NextResponse } from "next/server";
import { allGuests } from "@/lib/db";
import { rankMatches, CONFIDENT_MATCH, POSSIBLE_MATCH } from "@/lib/match";
import { buildPartyPayload } from "@/lib/partyPayload";

/**
 * POST { name } -> fuzzy-match against the guest list.
 *
 * Responses:
 *  - { status: "match", match, party }        one clear best match
 *  - { status: "choices", candidates }        a few plausible matches to pick from
 *  - { status: "not_found" }                  nothing close enough
 */
export async function POST(req: NextRequest) {
  let body: { name?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (name.length < 2 || name.length > 100) {
    return NextResponse.json(
      { error: "Please enter your full name." },
      { status: 400 }
    );
  }

  const guests = allGuests();
  const ranked = rankMatches(name, guests, (g) => g.full_name, {
    floor: POSSIBLE_MATCH,
    limit: 5,
  });

  if (ranked.length === 0) {
    return NextResponse.json({ status: "not_found" });
  }

  const best = ranked[0];
  const runnerUp = ranked[1];
  // Confident single match: clearly above threshold AND clearly ahead of #2
  const decisive =
    best.score >= CONFIDENT_MATCH &&
    (!runnerUp ||
      best.score - runnerUp.score >= 0.08 ||
      runnerUp.score < CONFIDENT_MATCH);

  if (decisive) {
    return NextResponse.json({
      status: "match",
      match: { id: best.item.id, full_name: best.item.full_name },
      party: buildPartyPayload(best.item.id),
    });
  }

  return NextResponse.json({
    status: "choices",
    candidates: ranked.map((c) => ({
      id: c.item.id,
      full_name: c.item.full_name,
    })),
  });
}
