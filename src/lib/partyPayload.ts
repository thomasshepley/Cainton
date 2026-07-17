import { partyOf, responsesForParty, commentForParty } from "@/lib/db";
import { parseMeals } from "@/lib/site";
import { computeLocks } from "@/lib/settings";

/** Shape of a party as sent to the RSVP flow on the client. */
export function buildPartyPayload(guestId: number) {
  const result = partyOf(guestId);
  if (!result) return null;
  // Hidden parties don't exist as far as the public site is concerned
  if (result.party.hidden === 1) return null;
  const locks = computeLocks();
  const responses = responsesForParty(result.party.id);
  const responseByGuest = new Map(responses.map((r) => [r.guest_id, r]));
  const comment = commentForParty(result.party.id);
  return {
    id: result.party.id,
    label: result.party.label,
    inviteType: result.party.invite_type,
    members: result.members.map((m) => {
      const r = responseByGuest.get(m.id);
      const previousMeals = r ? parseMeals(r.meal) : {};
      return {
        id: m.id,
        full_name: m.full_name,
        menu: m.menu,
        previous: r
          ? { attending: r.attending === 1, meals: previousMeals }
          : null,
        // Their submitted meal choices are final (lock-after-submit)
        mealsFrozen:
          locks.lockAfterSubmit && Object.keys(previousMeals).length > 0,
      };
    }),
    previousComment: comment?.comment ?? null,
    previousSongRequest: comment?.song_request || null,
    locks: {
      mealsLocked: locks.mealsLocked,
      rsvpLocked: locks.rsvpLocked,
      commentsOpen: locks.commentsOpen,
      selfEditOnly: locks.selfEditOnly,
      closedMessage: locks.closedMessage,
    },
  };
}
