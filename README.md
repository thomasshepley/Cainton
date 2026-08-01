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

## Deploying to a VPS (production)

The recommended production setup: a small VPS (an entry-level 2 GB
instance from OVH/Hetzner/DigitalOcean is plenty for a wedding), your
domain pointed at it, and Caddy terminating HTTPS with automatic
Let's Encrypt certificates — all included in the compose file.

1. **Order the VPS** — choose an Ubuntu LTS image (or a "Docker" app
   image if offered). SSH in.
2. **Install Docker** (skip if the image included it):
   ```bash
   curl -fsSL https://get.docker.com | sh
   ```
3. **DNS** — in your registrar's panel (OVH: Web Cloud → Domain names →
   DNS zone), add an `A` record for e.g. `rsvp` pointing at the VPS's
   IPv4 address.
4. **Deploy**:
   ```bash
   git clone <this repo> && cd <repo>
   cp .env.example .env
   nano .env        # strong ADMIN_PASSWORD + DOMAIN=rsvp.yourdomain.com
   nano data/guests.seed.json   # confirm the real guest list
   docker compose --profile https up -d --build
   ```
   First build takes a few minutes. Caddy fetches the certificate on
   first request — the site is then live at `https://rsvp.yourdomain.com`
   (and `/admin` works from anywhere).
5. **If the build is killed on a 2 GB VPS** (out of memory), add swap
   once and rebuild:
   ```bash
   sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile \
     && sudo mkswap /swapfile && sudo swapon /swapfile
   echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
   ```
6. **Firewall** — if the VPS has one enabled, open ports 80 and 443
   (`sudo ufw allow 80,443/tcp`). The app itself listens only on
   localhost; Caddy is the sole public entrance.
7. **Backups** — everything lives in `data/wedding.db`. A nightly copy
   is one cron line:
   ```bash
   (crontab -l; echo "0 3 * * * cp ~/<repo>/data/wedding.db ~/wedding-backup-\$(date +\%a).db") | crontab -
   ```
   That keeps a rolling week of backups.

### Updating the live site

Install the update command once:

```bash
sudo ln -s ~/Cainton/scripts/update-site.sh /usr/local/bin/updatesite
```

After that, deploying any change is one word:

```bash
updatesite       # lists the incoming changes, then asks before applying
updatesite -y    # no confirmation prompt
updatesite -f    # rebuild even when there's nothing new to pull
```

It fetches the latest commits and shows them, backs up `data/wedding.db`
to `backups/` (keeping the 10 most recent), pulls, rebuilds, restarts,
and finally checks the site answers — stopping with a clear message if
any step fails. It refuses to run if you have uncommitted edits on the
server, so nothing you changed by hand gets overwritten.

The equivalent by hand is
`git pull && docker compose --profile https up -d --build`.

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
  "guests": [
    "John Smith",
    { "name": "Emily Smith", "menu": "children" }
  ],
  "invite": "evening"
}
```

Guests can be plain names (Adult menu) or objects with a `menu`
(`adult`, `children`, `coeliac-adult`, `coeliac-kids`, `vegetarian`).

`"invite"` is optional: omit it (or use `"full"`) for guests invited to the
whole day; `"evening"` marks evening-reception-only parties. Evening guests
see that on their RSVP and skip the meal-choice step (no wedding lunch).
You can also switch a party between full day and evening at any time from
the admin dashboard.

### Menus

There are five wedding-lunch menus, defined in `src/lib/site.ts`:
Adult (default), Kids, Adult Coeliac, Kids Coeliac, and Vegetarian.
Each menu has three courses — starter, main, dessert — and guests choose
one dish per course. The Adult Coeliac and Vegetarian menus currently
contain "TBC" placeholder dishes; replace them in `site.ts` when the
venue confirms (the structure to copy is right there).

Every guest starts on the Adult menu; assign a different menu per guest
from the admin dashboard (guests cannot switch menus themselves). The
dashboard's meal counts are grouped by menu and course for the caterer,
and the CSV export has a column per course.

The seed file is only read when the database is empty (first run). After
that, manage guests from the admin dashboard — or delete `data/wedding.db`
to re-seed from scratch.

## Pages

- `/` — splash page with the RSVP button
- `/rsvp` — the guest flow: name lookup → confirm → attending? → meals + note → done
- `/admin` — dashboard: response stats, meal counts, per-party status, add/remove
  guests and parties, CSV export. Password is `ADMIN_PASSWORD`
  (default `cainton-admin` — change it!). A collapsible **Website Activity**
  section at the bottom records every change (who, what, old → new) along
  with the requester's IP, device, language, and timezone — handy for
  checking a change really came from the right person. Searchable and
  filterable by type and party.

## Admin settings

`/admin/settings` (linked from the dashboard header) controls site
behavior. Everything is enforced server-side, not just hidden in the UI:

- **Lock all meal choices now** — freezes meals for everyone; attendance,
  notes and songs stay open.
- **Lock meal choices once submitted** — a guest's dishes become final the
  moment they submit; only the dashboard can change them after that.
- **Guests can only edit their own response** — each guest must RSVP under
  their own name; they see their party's answers but can't change them.
- **Meal choice deadline / RSVP deadline** — timed versions of the locks.
  Optionally keep notes & song requests editable after the RSVP deadline,
  and customise the "RSVPs are closed" message.
- **Hide a family from search** — per-family button on the dashboard;
  hidden parties (e.g. the couple's own) can't be found, viewed, or edited
  from the guest site at all.
- **Change the admin password** — stored hashed in the database and takes
  precedence over `ADMIN_PASSWORD`. Locked out? SSH into the server and
  run:

  ```bash
  ssh ubuntu@<your-server-ip>
  cd Cainton
  docker compose exec wedding-rsvp node scripts/reset-admin-password.js
  ```

  The password then reverts to `ADMIN_PASSWORD` from the server's `.env`.
- **Dark / light mode** — toggle in the dashboard and settings headers,
  remembered per device.

All settings changes are recorded in the Website Activity log.

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
