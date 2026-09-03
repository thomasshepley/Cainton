#!/usr/bin/env node
/**
 * One-time fix-up for the evening guest list: corrects names/surnames on
 * parties that already exist in the live database. Matches each party by
 * its current label, then updates the label and guest names in place —
 * existing RSVP responses stay attached (they're keyed by guest id, not
 * name) so nobody's answer is lost.
 *
 * Local:   node scripts/update-evening-guests.js
 * Docker:  docker compose exec wedding-rsvp node scripts/update-evening-guests.js
 */
const path = require("path");
const Database = require("better-sqlite3");

const dbPath = path.join(process.cwd(), "data", "wedding.db");
const db = new Database(dbPath);

// { oldLabel: the party's current label, newLabel, newGuests: full names
//   in the same order as the party's guests were originally added }
const UPDATES = [
  { oldLabel: "Grandma Lynn", newLabel: "Grandma Lynn Walker", newGuests: ["Grandma Lynn Walker"] },
  { oldLabel: "Gabby", newLabel: "Gabby Booth", newGuests: ["Gabby Booth"] },
  { oldLabel: "Shiv & Sam", newLabel: "Shiv & Sam Pancholi", newGuests: ["Shiv Pancholi", "Sam Pancholi"] },
  { oldLabel: "Jamie Garde & Emma", newLabel: "Jamie Garde & Emma Rice", newGuests: ["Jamie Garde", "Emma Rice"] },
  { oldLabel: "Connor Yates & Emma", newLabel: "Connor Yates & Emma Wharton", newGuests: ["Connor Yates", "Emma Wharton"] },
  { oldLabel: "Kelly & Noah", newLabel: "Kelly & Noah Blizard", newGuests: ["Kelly Blizard", "Noah Blizard"] },
  { oldLabel: "Shannon & Bryce", newLabel: "Shannon & Bryce Llewellyn", newGuests: ["Shannon Llewellyn", "Bryce Llewellyn"] },
  { oldLabel: "Vicky & Martin", newLabel: "Vicky & Martin Lawton", newGuests: ["Vicky Lawton", "Martin Lawton"] },
  { oldLabel: "Ashleigh & Ryan", newLabel: "Ashleigh Booth & Ryan Sandiford", newGuests: ["Ashleigh Booth", "Ryan Sandiford"] },
  { oldLabel: "Matt & Stacy", newLabel: "Matt & Stacy Gandy", newGuests: ["Matt Gandy", "Stacy Gandy"] },
  { oldLabel: "Linda & John", newLabel: "Linda & John Riding", newGuests: ["Linda Riding", "John Riding"] },
  { oldLabel: "Kyle & Jess", newLabel: "Kyle Evans & Jessica Pugh-Hanson", newGuests: ["Kyle Evans", "Jessica Pugh-Hanson"] },
];

const findParty = db.prepare("SELECT id FROM parties WHERE label = ?");
const updateLabel = db.prepare("UPDATE parties SET label = ? WHERE id = ?");
const listGuests = db.prepare("SELECT id FROM guests WHERE party_id = ? ORDER BY id");
const updateGuestName = db.prepare("UPDATE guests SET full_name = ? WHERE id = ?");

const applyUpdate = db.transaction((update) => {
  const party = findParty.get(update.oldLabel);
  if (!party) {
    console.log(`Skipped "${update.oldLabel}" — no party with that label found.`);
    return;
  }
  const guests = listGuests.all(party.id);
  if (guests.length !== update.newGuests.length) {
    console.log(
      `Skipped "${update.oldLabel}" — expected ${update.newGuests.length} guest(s), found ${guests.length}.`
    );
    return;
  }
  updateLabel.run(update.newLabel, party.id);
  guests.forEach((g, i) => updateGuestName.run(update.newGuests[i], g.id));
  console.log(`Updated "${update.oldLabel}" -> "${update.newLabel}"`);
});

for (const update of UPDATES) applyUpdate(update);
console.log("Done.");
