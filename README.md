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

## Running with Docker (recommended for a home PC)

With [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or
Docker Engine) installed, create a file named `.env` in the project folder
to set the admin password (Docker Compose picks it up automatically, and
it's gitignored):

```
ADMIN_PASSWORD=pick-a-secret
```

Then:

```bash
docker compose up -d --build
```

(Skipping the `.env` file also works — the password just falls back to the
default `cainton-admin`. On Windows PowerShell, don't use the Linux-style
`VAR=value command` prefix; use the `.env` file, or run
`$env:ADMIN_PASSWORD = "pick-a-secret"` before `docker compose up`.)

That's it — the site is on http://localhost:3000 and restarts automatically
with your PC (`restart: unless-stopped`). All RSVPs are stored in
`./data/wedding.db` on your machine (the folder is mounted into the
container), so they survive rebuilds; back that one file up and you can never
lose a response. Edit `data/guests.seed.json` *before* first launch to set the
real guest list, or manage guests later from `/admin`. To re-seed from the
JSON, stop the container, delete `data/wedding.db*`, and start it again.

Useful commands:

```bash
docker compose logs -f       # watch the server logs
docker compose down          # stop
docker compose up -d --build # rebuild after changing code/config
```

### Letting other people reach it

- **Same Wi-Fi/LAN**: they can visit `http://<your-PC's-IP>:3000`
  (find it with `ipconfig` on Windows / `ip addr` on Linux / `ifconfig` on Mac).

- **From anywhere — quick demo** (showing someone the site): a Cloudflare
  quick tunnel is built into the compose file. No account needed:

  ```bash
  docker compose --profile public up -d
  docker compose logs tunnel
  ```

  The logs contain your public HTTPS URL (`https://<random-words>.trycloudflare.com`)
  — send it to anyone. The URL changes every time the tunnel restarts, and
  quick tunnels are best-effort, so use this for demos rather than the real
  invitations. Stop sharing with `docker compose --profile public down`
  (add `up -d` after to keep the site running locally).

- **From anywhere — permanent URL** (for the real invitations): create a free
  [Cloudflare account](https://dash.cloudflare.com/), add your domain, then in
  Zero Trust → Networks → Tunnels create a tunnel pointing at
  `http://wedding-rsvp:3000`, and put its token in `.env` as
  `TUNNEL_TOKEN=...`. Then:

  ```bash
  docker compose --profile domain up -d
  ```

  Guests get a stable `https://rsvp.yourdomain.com` that survives restarts.
  (Tailscale `tailscale funnel 3000` or ngrok `ngrok http 3000` work too if
  you already use them.)

**Before making the site public**: set a strong `ADMIN_PASSWORD` in `.env` —
the `/admin` dashboard is reachable by anyone who has the URL and guesses the
password.

## Customizing

| What | Where |
| --- | --- |
| Couple names, date, venue, deadline, contact email, menus & dishes | `src/lib/site.ts` |
| Guest list (initial seed) | `data/guests.seed.json` |
| Colors & fonts | `src/app/globals.css` |
| Admin password | `.env.local` → `ADMIN_PASSWORD` (see `.env.example`) |

### Guest list format

`data/guests.seed.json` is a list of *parties* — households or groups that
RSVP together. Each party has a label and its guests:

```json
{
  "label": "The Smith Family",
  "guests": ["John Smith", "Elizabeth Smith", "Emily Smith"],
  "invite": "evening"
}
```

`"invite"` is optional: omit it (or use `"full"`) for guests invited to the
whole day; `"evening"` marks evening-reception-only parties. Evening guests
see that on their RSVP and skip the meal-choice step (no wedding breakfast).
You can also switch a party between full day and evening at any time from
the admin dashboard.

### Menus

There are four wedding-breakfast menus, defined in `src/lib/site.ts`:
Standard (default), Vegetarian, Coeliac, and Children's. Every guest starts
on the Standard menu; assign a different menu per guest from the admin
dashboard (guests cannot switch menus themselves). On the RSVP page each
guest picks a dish from their assigned menu, and the dashboard's meal
counts are grouped by menu for the caterer.

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
- **A nickname dictionary** (~200 names, British-flavoured) — "Liz Smith" finds
  "Elizabeth Smith", "Pip Clarke" finds "Philippa Clarke"
- **Surname spelling variants** — Clark/Clarke, Smith/Smyth/Smythe,
  Stewart/Stuart, Reid/Reed, Davies/Davis, and Mac-/Mc- prefixes fold together
- **Surname guard** — first-name-only matches don't fire against the wrong family

One clear winner goes straight through; a close call shows a "did you mean?"
list; no plausible match shows a friendly not-found page with a contact email.
Guests who come back can update a previously submitted RSVP.
