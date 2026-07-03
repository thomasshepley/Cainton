# Cainton Wedding RSVP

A self-contained wedding RSVP website. Guests enter their name on a splash
page, get fuzzy-matched against the invite list (typos, nicknames, and
word-order mistakes are forgiven), RSVP yes/no for everyone in their party,
pick meals, leave a note, and submit. A password-protected admin dashboard
tracks responses, meal counts, and lets you manage the guest list.

## Running it

```bash
npm install
npm run dev        # http://localhost:3000
```

For production:

```bash
npm run build
npm start
```

The site uses a local SQLite database (`data/wedding.db`), created and seeded
automatically on first run — so it needs a host with a persistent filesystem
(a small VPS, Railway, Fly.io, Render with a disk, a Raspberry Pi…). It will
**not** persist data on serverless hosts like Vercel.

## Customizing

| What | Where |
| --- | --- |
| Couple names, date, venue, deadline, contact email, meal options | `src/lib/site.ts` |
| Guest list (initial seed) | `data/guests.seed.json` |
| Colors & fonts | `src/app/globals.css` |
| Admin password | `.env.local` → `ADMIN_PASSWORD` (see `.env.example`) |

### Guest list format

`data/guests.seed.json` is a list of *parties* — households or groups that
RSVP together. Each party has a label and its guests:

```json
{
  "label": "The Smith Family",
  "guests": ["John Smith", "Elizabeth Smith", "Emily Smith"]
}
```

The seed file is only read when the database is empty (first run). After
that, manage guests from the admin dashboard — or delete `data/wedding.db`
to re-seed from scratch.

## Pages

- `/` — splash page with the RSVP button
- `/rsvp` — the guest flow: name lookup → confirm → attending? → meals + note → done
- `/admin` — dashboard: response stats, meal counts, per-party status, add/remove
  guests and parties, CSV export. Password is `ADMIN_PASSWORD`
  (default `cainton-admin` — change it!).

## How the name matching works

`src/lib/match.ts` scores each guest name against what was typed using:

- **Jaro-Winkler similarity** — tolerant of typos and transpositions
  ("Jon Smyth" → "John Smith")
- **Token alignment** — word order and middle names don't matter
  ("Smith, John" or "John Robert Smith" both work)
- **A nickname dictionary** — "Liz Smith" finds "Elizabeth Smith"
- **Surname guard** — first-name-only matches don't fire against the wrong family

One clear winner goes straight through; a close call shows a "did you mean?"
list; no plausible match shows a friendly not-found page with a contact email.
Guests who come back can update a previously submitted RSVP.
