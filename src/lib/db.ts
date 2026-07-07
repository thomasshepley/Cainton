import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

/**
 * SQLite storage for the guest list and RSVP responses.
 * The DB file lives in ./data and is created (and seeded from
 * data/guests.seed.json) on first run.
 */

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "wedding.db");
const SEED_PATH = path.join(DATA_DIR, "guests.seed.json");

export interface Guest {
  id: number;
  party_id: number;
  full_name: string;
  /** Which wedding-lunch menu this guest is on (site.ts menus) */
  menu: string;
}

/** 'full' = daytime + evening; 'evening' = evening reception only */
export type InviteType = "full" | "evening";

export interface Party {
  id: number;
  label: string;
  invite_type: InviteType;
}

export interface Response {
  guest_id: number;
  attending: number; // 1 = yes, 0 = no
  meal: string | null;
  submitted_by: string;
  submitted_at: string;
}

export interface PartyComment {
  party_id: number;
  comment: string;
  song_request: string;
  submitted_at: string;
}

declare global {
  // Reuse the connection across Next.js hot reloads in dev
  var __weddingDb: Database.Database | undefined;
}

function initDb(): Database.Database {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS parties (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      label TEXT NOT NULL,
      invite_type TEXT NOT NULL DEFAULT 'full'
    );
    CREATE TABLE IF NOT EXISTS guests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      party_id INTEGER NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
      full_name TEXT NOT NULL,
      menu TEXT NOT NULL DEFAULT 'adult'
    );
    CREATE TABLE IF NOT EXISTS responses (
      guest_id INTEGER PRIMARY KEY REFERENCES guests(id) ON DELETE CASCADE,
      attending INTEGER NOT NULL,
      meal TEXT,
      submitted_by TEXT NOT NULL,
      submitted_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS party_comments (
      party_id INTEGER PRIMARY KEY REFERENCES parties(id) ON DELETE CASCADE,
      comment TEXT NOT NULL,
      song_request TEXT NOT NULL DEFAULT '',
      submitted_at TEXT NOT NULL
    );
  `);

  // Migrations for databases created before these columns existed
  const partyCols = db.prepare("PRAGMA table_info(parties)").all() as {
    name: string;
  }[];
  if (!partyCols.some((c) => c.name === "invite_type")) {
    db.exec(
      "ALTER TABLE parties ADD COLUMN invite_type TEXT NOT NULL DEFAULT 'full'"
    );
  }
  const commentCols = db.prepare("PRAGMA table_info(party_comments)").all() as {
    name: string;
  }[];
  if (!commentCols.some((c) => c.name === "song_request")) {
    db.exec(
      "ALTER TABLE party_comments ADD COLUMN song_request TEXT NOT NULL DEFAULT ''"
    );
  }
  const guestCols = db.prepare("PRAGMA table_info(guests)").all() as {
    name: string;
  }[];
  if (!guestCols.some((c) => c.name === "menu")) {
    db.exec("ALTER TABLE guests ADD COLUMN menu TEXT NOT NULL DEFAULT 'adult'");
  }
  // Menus were split into adult/kids coeliac variants
  db.exec("UPDATE guests SET menu = 'coeliac-adult' WHERE menu = 'coeliac'");
  // Meal choices moved from a single dish id to a JSON object of
  // course -> dish; legacy single-dish values can't be mapped, so those
  // guests show as "no meal chosen" and can re-pick (or be set by admin)
  db.exec(
    "UPDATE responses SET meal = NULL WHERE meal IS NOT NULL AND meal NOT LIKE '{%'"
  );

  // Seed the guest list on first run
  const count = db.prepare("SELECT COUNT(*) AS n FROM guests").get() as {
    n: number;
  };
  if (count.n === 0 && fs.existsSync(SEED_PATH)) {
    const seed = JSON.parse(fs.readFileSync(SEED_PATH, "utf8")) as {
      label: string;
      guests: string[];
      invite?: string;
    }[];
    const insertParty = db.prepare(
      "INSERT INTO parties (label, invite_type) VALUES (?, ?)"
    );
    const insertGuest = db.prepare(
      "INSERT INTO guests (party_id, full_name) VALUES (?, ?)"
    );
    const tx = db.transaction(() => {
      for (const party of seed) {
        const inviteType = party.invite === "evening" ? "evening" : "full";
        const { lastInsertRowid } = insertParty.run(party.label, inviteType);
        for (const name of party.guests) {
          insertGuest.run(lastInsertRowid, name.trim());
        }
      }
    });
    tx();
  }

  return db;
}

export function getDb(): Database.Database {
  if (!global.__weddingDb) {
    global.__weddingDb = initDb();
  }
  return global.__weddingDb;
}

// ---------- Guest queries ----------

export function allGuests(): Guest[] {
  return getDb()
    .prepare("SELECT id, party_id, full_name, menu FROM guests ORDER BY full_name")
    .all() as Guest[];
}

export function partyOf(guestId: number): {
  party: Party;
  members: Guest[];
} | null {
  const db = getDb();
  const guest = db
    .prepare("SELECT id, party_id, full_name, menu FROM guests WHERE id = ?")
    .get(guestId) as Guest | undefined;
  if (!guest) return null;
  const party = db
    .prepare("SELECT id, label, invite_type FROM parties WHERE id = ?")
    .get(guest.party_id) as Party;
  const members = db
    .prepare(
      "SELECT id, party_id, full_name, menu FROM guests WHERE party_id = ? ORDER BY id"
    )
    .all(guest.party_id) as Guest[];
  return { party, members };
}

export function responsesForParty(partyId: number): Response[] {
  return getDb()
    .prepare(
      `SELECT r.guest_id, r.attending, r.meal, r.submitted_by, r.submitted_at
       FROM responses r JOIN guests g ON g.id = r.guest_id
       WHERE g.party_id = ?`
    )
    .all(partyId) as Response[];
}

export function commentForParty(partyId: number): PartyComment | null {
  return (
    (getDb()
      .prepare(
        "SELECT party_id, comment, song_request, submitted_at FROM party_comments WHERE party_id = ?"
      )
      .get(partyId) as PartyComment | undefined) ?? null
  );
}

export function getParty(partyId: number): Party | null {
  return (
    (getDb()
      .prepare("SELECT id, label, invite_type FROM parties WHERE id = ?")
      .get(partyId) as Party | undefined) ?? null
  );
}

export function guestsForParty(partyId: number): Guest[] {
  return getDb()
    .prepare(
      "SELECT id, party_id, full_name, menu FROM guests WHERE party_id = ? ORDER BY id"
    )
    .all(partyId) as Guest[];
}

export function saveRsvp(input: {
  partyId: number;
  submittedBy: string;
  comment: string;
  songRequest: string;
  answers: { guestId: number; attending: boolean; meal: string | null }[];
}): void {
  const db = getDb();
  const now = new Date().toISOString();
  const upsertResponse = db.prepare(`
    INSERT INTO responses (guest_id, attending, meal, submitted_by, submitted_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(guest_id) DO UPDATE SET
      attending = excluded.attending,
      meal = excluded.meal,
      submitted_by = excluded.submitted_by,
      submitted_at = excluded.submitted_at
  `);
  const upsertComment = db.prepare(`
    INSERT INTO party_comments (party_id, comment, song_request, submitted_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(party_id) DO UPDATE SET
      comment = excluded.comment,
      song_request = excluded.song_request,
      submitted_at = excluded.submitted_at
  `);
  const deleteComment = db.prepare(
    "DELETE FROM party_comments WHERE party_id = ?"
  );
  // Only accept answers for guests actually in this party
  const memberIds = new Set(
    (
      db
        .prepare("SELECT id FROM guests WHERE party_id = ?")
        .all(input.partyId) as { id: number }[]
    ).map((r) => r.id)
  );

  const tx = db.transaction(() => {
    for (const a of input.answers) {
      if (!memberIds.has(a.guestId)) continue;
      upsertResponse.run(
        a.guestId,
        a.attending ? 1 : 0,
        a.attending ? a.meal : null,
        input.submittedBy,
        now
      );
    }
    const comment = input.comment.trim().slice(0, 2000);
    const song = input.songRequest.trim().slice(0, 200);
    if (comment || song) {
      upsertComment.run(input.partyId, comment, song, now);
    } else {
      deleteComment.run(input.partyId);
    }
  });
  tx();
}

// ---------- Admin queries ----------

export interface AdminRow {
  guest_id: number;
  full_name: string;
  party_id: number;
  menu: string;
  party_label: string;
  invite_type: InviteType;
  attending: number | null;
  meal: string | null;
  submitted_by: string | null;
  submitted_at: string | null;
  comment: string | null;
  song_request: string | null;
}

export function adminOverview(): AdminRow[] {
  return getDb()
    .prepare(
      `SELECT g.id AS guest_id, g.full_name, g.party_id, g.menu,
              p.label AS party_label,
              p.invite_type, r.attending, r.meal, r.submitted_by, r.submitted_at,
              c.comment, c.song_request
       FROM guests g
       JOIN parties p ON p.id = g.party_id
       LEFT JOIN responses r ON r.guest_id = g.id
       LEFT JOIN party_comments c ON c.party_id = g.party_id
       ORDER BY p.id, g.id`
    )
    .all() as AdminRow[];
}

export function addParty(
  label: string,
  guestNames: string[],
  inviteType: InviteType = "full"
): void {
  const db = getDb();
  const tx = db.transaction(() => {
    const { lastInsertRowid } = db
      .prepare("INSERT INTO parties (label, invite_type) VALUES (?, ?)")
      .run(label.trim(), inviteType);
    const insertGuest = db.prepare(
      "INSERT INTO guests (party_id, full_name) VALUES (?, ?)"
    );
    for (const name of guestNames) {
      const trimmed = name.trim();
      if (trimmed) insertGuest.run(lastInsertRowid, trimmed);
    }
  });
  tx();
}

export function deleteParty(partyId: number): void {
  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare(
      "DELETE FROM responses WHERE guest_id IN (SELECT id FROM guests WHERE party_id = ?)"
    ).run(partyId);
    db.prepare("DELETE FROM party_comments WHERE party_id = ?").run(partyId);
    db.prepare("DELETE FROM guests WHERE party_id = ?").run(partyId);
    db.prepare("DELETE FROM parties WHERE id = ?").run(partyId);
  });
  tx();
}

export function deleteGuest(guestId: number): void {
  const db = getDb();
  const tx = db.transaction(() => {
    const guest = db
      .prepare("SELECT party_id FROM guests WHERE id = ?")
      .get(guestId) as { party_id: number } | undefined;
    if (!guest) return;
    db.prepare("DELETE FROM responses WHERE guest_id = ?").run(guestId);
    db.prepare("DELETE FROM guests WHERE id = ?").run(guestId);
    const remaining = db
      .prepare("SELECT COUNT(*) AS n FROM guests WHERE party_id = ?")
      .get(guest.party_id) as { n: number };
    if (remaining.n === 0) {
      db.prepare("DELETE FROM party_comments WHERE party_id = ?").run(
        guest.party_id
      );
      db.prepare("DELETE FROM parties WHERE id = ?").run(guest.party_id);
    }
  });
  tx();
}

export function addGuestToParty(partyId: number, name: string): void {
  getDb()
    .prepare("INSERT INTO guests (party_id, full_name) VALUES (?, ?)")
    .run(partyId, name.trim());
}

/**
 * Admin override of a single guest's response.
 * attending null clears the response entirely (back to "no response");
 * meal is only stored for attending guests; menu (if given) updates the
 * guest's assigned menu regardless of status.
 */
export function setGuestResponse(
  guestId: number,
  attending: boolean | null,
  meal: string | null,
  menu?: string
): boolean {
  const db = getDb();
  const guest = db
    .prepare("SELECT id FROM guests WHERE id = ?")
    .get(guestId) as { id: number } | undefined;
  if (!guest) return false;
  if (menu) {
    db.prepare("UPDATE guests SET menu = ? WHERE id = ?").run(menu, guestId);
  }
  if (attending === null) {
    db.prepare("DELETE FROM responses WHERE guest_id = ?").run(guestId);
    return true;
  }
  db.prepare(
    `INSERT INTO responses (guest_id, attending, meal, submitted_by, submitted_at)
     VALUES (?, ?, ?, 'Admin', ?)
     ON CONFLICT(guest_id) DO UPDATE SET
       attending = excluded.attending,
       meal = excluded.meal,
       submitted_by = excluded.submitted_by,
       submitted_at = excluded.submitted_at`
  ).run(guestId, attending ? 1 : 0, attending ? meal : null, new Date().toISOString());
  return true;
}

/** Admin: switch a whole party between full-day and evening-only */
export function setPartyInviteType(
  partyId: number,
  inviteType: InviteType
): boolean {
  const result = getDb()
    .prepare("UPDATE parties SET invite_type = ? WHERE id = ?")
    .run(inviteType, partyId);
  return result.changes > 0;
}
