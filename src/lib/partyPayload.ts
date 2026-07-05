import { partyOf, responsesForParty, commentForParty } from "@/lib/db";

/** Shape of a party as sent to the RSVP flow on the client. */
export function buildPartyPayload(guestId: number) {
  const result = partyOf(guestId);
  if (!result) return null;
  const responses = responsesForParty(result.party.id);
  const responseByGuest = new Map(responses.map((r) => [r.guest_id, r]));
  const comment = commentForParty(result.party.id);
  return {
    id: result.party.id,
    label: result.party.label,
    inviteType: result.party.invite_type,
    members: result.members.map((m) => {
      const r = responseByGuest.get(m.id);
      return {
        id: m.id,
        full_name: m.full_name,
        previous: r ? { attending: r.attending === 1, meal: r.meal } : null,
      };
    }),
    previousComment: comment?.comment ?? null,
    previousSongRequest: comment?.song_request || null,
  };
}
