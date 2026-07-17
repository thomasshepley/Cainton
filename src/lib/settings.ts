import { getSettings } from "@/lib/db";

/**
 * Admin-configurable behavior, stored in the settings table.
 * Booleans are "1"/"0"; deadlines are ISO timestamps (empty = unset).
 */
export interface SiteSettings {
  /** Meal choices locked for everyone right now */
  lockMeals: boolean;
  /** Guests can only edit their own row, not the rest of their party */
  selfEditOnly: boolean;
  /** Once a guest has submitted meal choices they can't change them */
  lockAfterSubmit: boolean;
  /** ISO timestamp after which meal choices lock (empty = never) */
  mealDeadline: string;
  /** ISO timestamp after which RSVP + meals lock (empty = never) */
  rsvpDeadline: string;
  /** After the RSVP deadline, comment & song request stay editable */
  commentsAfterDeadline: boolean;
  /** Message shown to guests when RSVPs are closed */
  closedMessage: string;
}

export const SETTING_DEFAULTS: SiteSettings = {
  lockMeals: false,
  selfEditOnly: false,
  lockAfterSubmit: false,
  mealDeadline: "",
  rsvpDeadline: "",
  commentsAfterDeadline: true,
  closedMessage:
    "The RSVP deadline has passed. If you need to change anything, please contact us directly.",
};

const BOOL_KEYS = [
  "lockMeals",
  "selfEditOnly",
  "lockAfterSubmit",
  "commentsAfterDeadline",
] as const;
const TEXT_KEYS = ["mealDeadline", "rsvpDeadline", "closedMessage"] as const;

export function readSettings(): SiteSettings {
  const raw = getSettings();
  const out: SiteSettings = { ...SETTING_DEFAULTS };
  for (const k of BOOL_KEYS) {
    if (raw[k] !== undefined) out[k] = raw[k] === "1";
  }
  for (const k of TEXT_KEYS) {
    if (raw[k] !== undefined) out[k] = raw[k];
  }
  return out;
}

/** The lock state in force right now (deadlines evaluated) */
export interface Locks {
  /** No meal changes for anyone */
  mealsLocked: boolean;
  /** No RSVP (attendance) changes for anyone */
  rsvpLocked: boolean;
  /** With rsvpLocked: comment & song request still editable */
  commentsOpen: boolean;
  selfEditOnly: boolean;
  lockAfterSubmit: boolean;
  closedMessage: string;
}

export function computeLocks(now = new Date()): Locks {
  const s = readSettings();
  const pastMealDeadline =
    !!s.mealDeadline && now.getTime() > new Date(s.mealDeadline).getTime();
  const pastRsvpDeadline =
    !!s.rsvpDeadline && now.getTime() > new Date(s.rsvpDeadline).getTime();
  return {
    mealsLocked: s.lockMeals || pastMealDeadline || pastRsvpDeadline,
    rsvpLocked: pastRsvpDeadline,
    commentsOpen: !pastRsvpDeadline || s.commentsAfterDeadline,
    selfEditOnly: s.selfEditOnly,
    lockAfterSubmit: s.lockAfterSubmit,
    closedMessage: s.closedMessage,
  };
}
