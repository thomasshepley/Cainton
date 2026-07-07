"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { site, menuById, parseMeals } from "@/lib/site";

interface AdminRow {
  guest_id: number;
  full_name: string;
  party_id: number;
  menu: string;
  party_label: string;
  invite_type: "full" | "evening";
  attending: number | null;
  meal: string | null;
  submitted_by: string | null;
  submitted_at: string | null;
  comment: string | null;
  song_request: string | null;
}

type StatKey = "invited" | "attending" | "declined" | "awaiting";

const SELECT_CLASS =
  "rounded-lg border border-ink-soft/25 bg-white px-2.5 py-1.5 text-xs text-ink outline-none transition-colors focus:border-gold disabled:opacity-50";

/* ---------- small building blocks ---------- */

function SegmentedStatus({
  value,
  onChange,
  disabled,
}: {
  value: "none" | "yes" | "no";
  onChange: (v: "none" | "yes" | "no") => void;
  disabled?: boolean;
}) {
  const options: { v: "none" | "yes" | "no"; label: string; on: string }[] = [
    { v: "yes", label: "✓ Yes", on: "bg-sage-dark text-cream" },
    { v: "no", label: "✗ No", on: "bg-ink text-cream" },
    { v: "none", label: "–", on: "bg-ink-soft/70 text-cream" },
  ];
  return (
    <div className="inline-flex overflow-hidden rounded-full border border-ink-soft/25 bg-white">
      {options.map((o, i) => (
        <button
          key={o.v}
          type="button"
          disabled={disabled}
          onClick={() => onChange(o.v)}
          title={
            o.v === "none" ? "Clear (no response)" : o.v === "yes" ? "Attending" : "Declined"
          }
          className={`px-3 py-1.5 text-xs transition-colors disabled:opacity-50 ${
            i > 0 ? "border-l border-ink-soft/15" : ""
          } ${value === o.v ? o.on : "text-ink-soft hover:bg-cream-dark"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Chip({
  tone,
  children,
}: {
  tone: "sage" | "ink" | "gold";
  children: React.ReactNode;
}) {
  const tones = {
    sage: "border-sage-dark/40 bg-sage-light text-sage-dark",
    ink: "border-ink-soft/30 bg-cream-dark text-ink-soft",
    gold: "border-gold/50 bg-gold-light text-gold",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.65rem] whitespace-nowrap ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

/* ---------- page ---------- */

export default function AdminPage() {
  const [key, setKey] = useState("");
  const [authed, setAuthed] = useState(false);
  const [rows, setRows] = useState<AdminRow[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [openParties, setOpenParties] = useState<Set<number>>(new Set());
  const [openStat, setOpenStat] = useState<StatKey | null>(null);

  // New party form
  const [newLabel, setNewLabel] = useState("");
  const [newGuests, setNewGuests] = useState("");
  const [newInvite, setNewInvite] = useState<"full" | "evening">("full");

  const load = useCallback(async (adminKey: string) => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/overview", {
        headers: { "x-admin-key": adminKey },
      });
      if (res.status === 401) {
        setAuthed(false);
        sessionStorage.removeItem("adminKey");
        setError("Incorrect password.");
        return;
      }
      const data = await res.json();
      setRows(data.rows);
      setAuthed(true);
      sessionStorage.setItem("adminKey", adminKey);
    } catch {
      setError("Could not load data.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const saved = sessionStorage.getItem("adminKey");
    if (saved) {
      setKey(saved);
      load(saved);
    }
  }, [load]);

  async function action(payload: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/guests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": key,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Action failed.");
        return;
      }
      await load(key);
    } catch {
      setError("Action failed.");
    } finally {
      setBusy(false);
    }
  }

  async function downloadCsv() {
    const res = await fetch("/api/admin/export", {
      headers: { "x-admin-key": key },
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "wedding-rsvps.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const stats = useMemo(() => {
    const lists: Record<StatKey, AdminRow[]> = {
      invited: rows,
      attending: rows.filter((r) => r.attending === 1),
      declined: rows.filter((r) => r.attending === 0),
      awaiting: rows.filter((r) => r.attending === null),
    };
    const meals = new Map<string, number>();
    for (const r of lists.attending) {
      for (const dishId of Object.values(parseMeals(r.meal))) {
        meals.set(dishId, (meals.get(dishId) ?? 0) + 1);
      }
    }
    const responded = lists.attending.length + lists.declined.length;
    return { lists, meals, responded };
  }, [rows]);

  const parties = useMemo(() => {
    const byParty = new Map<number, { label: string; rows: AdminRow[] }>();
    for (const r of rows) {
      const p = byParty.get(r.party_id) ?? { label: r.party_label, rows: [] };
      p.rows.push(r);
      byParty.set(r.party_id, p);
    }
    return [...byParty.entries()].map(([id, p]) => {
      const attending = p.rows.filter((r) => r.attending === 1).length;
      const declined = p.rows.filter((r) => r.attending === 0).length;
      const awaiting = p.rows.length - attending - declined;
      return { id, ...p, attending, declined, awaiting };
    });
  }, [rows]);

  function toggleParty(id: number) {
    setOpenParties((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allOpen = parties.length > 0 && openParties.size === parties.length;

  if (!authed) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            load(key);
          }}
          className="animate-rise w-full max-w-sm text-center"
        >
          <h1 className="font-display text-4xl">Admin</h1>
          <p className="mt-2 text-sm text-ink-soft">
            {site.coupleNames} — Wedding Dashboard
          </p>
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="Admin password"
            autoFocus
            className="mt-8 w-full border-b border-ink-soft/40 bg-transparent px-2 py-3 text-center outline-none focus:border-gold"
          />
          {error && <p className="mt-4 text-sm text-red-700">{error}</p>}
          <button
            type="submit"
            disabled={busy || !key}
            className="mt-6 w-full border border-sage-dark bg-sage-dark px-8 py-3 text-sm tracking-[0.3em] uppercase text-cream transition-all enabled:hover:bg-transparent enabled:hover:text-sage-dark disabled:opacity-40"
          >
            {busy ? "Checking…" : "Enter"}
          </button>
          <Link
            href="/"
            className="mt-6 block text-xs tracking-[0.2em] uppercase text-ink-soft hover:underline"
          >
            ← Back to site
          </Link>
        </form>
      </main>
    );
  }

  const statTiles: { key: StatKey; label: string; accent: string }[] = [
    { key: "invited", label: "Invited", accent: "text-ink" },
    { key: "attending", label: "Attending", accent: "text-sage-dark" },
    { key: "declined", label: "Declined", accent: "text-ink-soft" },
    { key: "awaiting", label: "Awaiting", accent: "text-gold" },
  ];
  const respondedPct =
    rows.length === 0 ? 0 : Math.round((stats.responded / rows.length) * 100);

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl">Wedding Dashboard</h1>
          <p className="mt-1 text-xs text-ink-soft sm:text-sm">
            {site.coupleNames} · {site.dateDisplay}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={downloadCsv}
            className="rounded-lg border border-ink-soft/30 px-3 py-1.5 text-[0.65rem] tracking-[0.15em] uppercase text-ink-soft hover:border-ink hover:text-ink"
          >
            Export CSV
          </button>
          <button
            onClick={() => {
              sessionStorage.removeItem("adminKey");
              setAuthed(false);
              setKey("");
            }}
            className="rounded-lg border border-ink-soft/30 px-3 py-1.5 text-[0.65rem] tracking-[0.15em] uppercase text-ink-soft hover:border-ink hover:text-ink"
          >
            Log out
          </button>
        </div>
      </header>

      {error && <p className="mt-4 text-sm text-red-700">{error}</p>}

      {/* Response progress */}
      <section className="mt-6 rounded-xl border border-ink-soft/20 bg-white/60 p-4">
        <div className="flex items-baseline justify-between">
          <p className="text-[0.65rem] tracking-[0.25em] uppercase text-ink-soft">
            Responses
          </p>
          <p className="text-xs text-ink-soft">
            <span className="font-display text-lg text-ink">{stats.responded}</span>{" "}
            of {rows.length} · {respondedPct}%
          </p>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-cream-dark">
          <div
            className="h-full rounded-full bg-sage transition-all duration-500"
            style={{ width: `${respondedPct}%` }}
          />
        </div>
      </section>

      {/* Stat tiles — tap to see who's in each group */}
      <section className="mt-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          {statTiles.map((t) => {
            const open = openStat === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setOpenStat(open ? null : t.key)}
                className={`rounded-xl border p-3 text-center transition-all sm:p-4 ${
                  open
                    ? "border-gold bg-gold-light/60"
                    : "border-ink-soft/20 bg-white/60 hover:border-gold/60"
                }`}
              >
                <p className={`font-display text-3xl sm:text-4xl ${t.accent}`}>
                  {stats.lists[t.key].length}
                </p>
                <p className="mt-0.5 text-[0.6rem] tracking-[0.2em] uppercase text-ink-soft">
                  {t.label}
                  <span
                    className={`ml-1 inline-block transition-transform ${open ? "rotate-180" : ""}`}
                  >
                    ▾
                  </span>
                </p>
              </button>
            );
          })}
        </div>
        {openStat && (
          <div className="animate-rise mt-2 rounded-xl border border-gold/40 bg-white/70 p-4">
            <p className="text-[0.65rem] tracking-[0.25em] uppercase text-gold">
              {statTiles.find((t) => t.key === openStat)?.label} —{" "}
              {stats.lists[openStat].length}{" "}
              {stats.lists[openStat].length === 1 ? "guest" : "guests"}
            </p>
            {stats.lists[openStat].length === 0 ? (
              <p className="mt-2 text-sm text-ink-soft">No one yet.</p>
            ) : (
              <ul className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
                {stats.lists[openStat].map((r) => (
                  <li key={r.guest_id} className="text-sm">
                    {r.full_name}
                    <span className="ml-1.5 text-xs text-ink-soft/70">
                      {r.party_label}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      {/* Meal counts, grouped by menu for the caterer */}
      {stats.meals.size > 0 && (
        <section className="mt-4 rounded-xl border border-ink-soft/20 bg-white/60 p-4">
          <h2 className="text-[0.65rem] tracking-[0.25em] uppercase text-ink-soft">
            Meal counts
          </h2>
          <div className="mt-2 space-y-3">
            {site.menus.map((menu) => {
              const courses = menu.courses
                .map((course) => ({
                  course,
                  counted: course.options.filter((o) => stats.meals.has(o.id)),
                }))
                .filter((c) => c.counted.length > 0);
              if (courses.length === 0) return null;
              return (
                <div key={menu.id}>
                  <p className="text-[0.6rem] tracking-[0.2em] uppercase text-gold">
                    {menu.label}
                  </p>
                  <div className="mt-1 space-y-1">
                    {courses.map(({ course, counted }) => (
                      <div
                        key={course.id}
                        className="flex flex-wrap items-baseline gap-x-5 gap-y-0.5"
                      >
                        <p className="w-16 text-[0.6rem] tracking-[0.15em] uppercase text-ink-soft/70">
                          {course.label}
                        </p>
                        {counted.map((o) => (
                          <p key={o.id} className="text-sm">
                            <span className="font-display text-lg">
                              {stats.meals.get(o.id)}
                            </span>{" "}
                            <span className="text-xs text-ink-soft">
                              × {o.label}
                            </span>
                          </p>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Guest list */}
      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl">Guest list</h2>
          <button
            onClick={() =>
              setOpenParties(
                allOpen ? new Set() : new Set(parties.map((p) => p.id))
              )
            }
            className="text-[0.65rem] tracking-[0.15em] uppercase text-ink-soft underline-offset-4 hover:underline"
          >
            {allOpen ? "Collapse all" : "Expand all"}
          </button>
        </div>

        <div className="mt-3 space-y-2">
          {parties.map((p) => {
            const open = openParties.has(p.id);
            const inviteType = p.rows[0]?.invite_type ?? "full";
            const comment = p.rows[0]?.comment;
            const song = p.rows[0]?.song_request;
            return (
              <div
                key={p.id}
                className="overflow-hidden rounded-xl border border-ink-soft/20 bg-white/60"
              >
                {/* Collapsed header: the at-a-glance summary */}
                <button
                  onClick={() => toggleParty(p.id)}
                  className="flex w-full flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 text-left transition-colors hover:bg-cream-dark/40"
                >
                  <span
                    className={`inline-block text-xs text-ink-soft transition-transform duration-200 ${open ? "rotate-90" : ""}`}
                  >
                    ▸
                  </span>
                  <span className="font-display min-w-0 flex-1 truncate text-lg leading-tight">
                    {p.label}
                  </span>
                  {inviteType === "evening" && <Chip tone="gold">evening</Chip>}
                  <span className="flex items-center gap-1.5">
                    {p.attending > 0 && <Chip tone="sage">✓ {p.attending}</Chip>}
                    {p.declined > 0 && <Chip tone="ink">✗ {p.declined}</Chip>}
                    {p.awaiting > 0 && <Chip tone="gold">· {p.awaiting} awaiting</Chip>}
                    {(comment || song) && (
                      <span className="text-xs" title="Has a comment or song request">
                        💬
                      </span>
                    )}
                  </span>
                </button>

                {open && (
                  <div className="animate-rise border-t border-ink-soft/10 px-4 pb-4">
                    {/* Party-level controls */}
                    <div className="flex flex-wrap items-center justify-between gap-2 py-3">
                      <select
                        value={inviteType}
                        onChange={(e) =>
                          action({
                            action: "setInviteType",
                            partyId: p.id,
                            inviteType: e.target.value,
                          })
                        }
                        disabled={busy}
                        className={SELECT_CLASS}
                      >
                        <option value="full">Invited: full day</option>
                        <option value="evening">Invited: evening only</option>
                      </select>
                      <button
                        onClick={() => {
                          if (confirm(`Delete party "${p.label}" and all its guests?`))
                            action({ action: "deleteParty", partyId: p.id });
                        }}
                        className="text-[0.65rem] tracking-[0.15em] uppercase text-red-800/60 hover:text-red-800 hover:underline"
                      >
                        Delete party
                      </button>
                    </div>

                    {/* Members */}
                    <div className="space-y-2">
                      {p.rows.map((r) => (
                        <div
                          key={r.guest_id}
                          className="rounded-lg border border-ink-soft/15 bg-white/70 p-3"
                        >
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                            <p className="min-w-0 flex-1 truncate text-sm font-medium">
                              {r.full_name}
                            </p>
                            <SegmentedStatus
                              value={
                                r.attending === null
                                  ? "none"
                                  : r.attending === 1
                                    ? "yes"
                                    : "no"
                              }
                              disabled={busy}
                              onChange={(v) =>
                                action({
                                  action: "setResponse",
                                  guestId: r.guest_id,
                                  attending: v === "none" ? null : v === "yes",
                                  meals: v === "yes" ? parseMeals(r.meal) : {},
                                  menu: r.menu,
                                })
                              }
                            />
                            <button
                              onClick={() => {
                                if (confirm(`Remove ${r.full_name} from the list?`))
                                  action({
                                    action: "deleteGuest",
                                    guestId: r.guest_id,
                                  });
                              }}
                              title="Remove guest"
                              className="text-xs text-red-800/50 hover:text-red-800"
                            >
                              ✕
                            </button>
                          </div>
                          {inviteType === "full" && (
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <select
                                value={r.menu}
                                onChange={(e) =>
                                  action({
                                    action: "setResponse",
                                    guestId: r.guest_id,
                                    attending:
                                      r.attending === null
                                        ? null
                                        : r.attending === 1,
                                    // dishes must belong to the new menu
                                    meals: {},
                                    menu: e.target.value,
                                  })
                                }
                                disabled={busy}
                                className={SELECT_CLASS}
                              >
                                {site.menus.map((m) => (
                                  <option key={m.id} value={m.id}>
                                    {m.label}
                                  </option>
                                ))}
                              </select>
                              {r.attending === 1 &&
                                menuById(r.menu).courses.map((course) => {
                                  const picks = parseMeals(r.meal);
                                  const current = picks[course.id] ?? "";
                                  return (
                                    <select
                                      key={course.id}
                                      value={current}
                                      onChange={(e) => {
                                        const next = { ...picks };
                                        if (e.target.value)
                                          next[course.id] = e.target.value;
                                        else delete next[course.id];
                                        action({
                                          action: "setResponse",
                                          guestId: r.guest_id,
                                          attending: true,
                                          meals: next,
                                          menu: r.menu,
                                        });
                                      }}
                                      disabled={busy}
                                      className={`${SELECT_CLASS} ${
                                        current === "" ? "border-gold text-gold" : ""
                                      }`}
                                    >
                                      <option value="">{course.label}…</option>
                                      {course.options.map((o) => (
                                        <option key={o.id} value={o.id}>
                                          {o.label}
                                        </option>
                                      ))}
                                    </select>
                                  );
                                })}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Comment + song */}
                    {(comment || song) && (
                      <div className="mt-3 space-y-1 rounded-lg bg-cream-dark/50 p-3 text-sm text-ink-soft">
                        {comment && <p className="italic">“{comment}”</p>}
                        {song && <p>🎵 {song}</p>}
                      </div>
                    )}

                    <AddGuestInline
                      onAdd={(name) =>
                        action({ action: "addGuest", partyId: p.id, name })
                      }
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Add party */}
      <section className="mt-8 rounded-xl border border-ink-soft/20 bg-white/60 p-4">
        <h2 className="font-display text-2xl">Add a party</h2>
        <p className="mt-1 text-xs text-ink-soft">
          A “party” is a household or group that RSVPs together (e.g. a couple
          or family). Enter one guest name per line.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const guests = newGuests
              .split("\n")
              .map((g) => g.trim())
              .filter(Boolean);
            if (!newLabel.trim() || guests.length === 0) return;
            action({
              action: "addParty",
              label: newLabel.trim(),
              guests,
              inviteType: newInvite,
            });
            setNewLabel("");
            setNewGuests("");
            setNewInvite("full");
          }}
          className="mt-4 grid gap-3 sm:grid-cols-2"
        >
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder='Party label, e.g. "The Smith Family"'
            className="rounded-lg border border-ink-soft/25 bg-white px-3 py-2 text-sm outline-none focus:border-gold"
          />
          <textarea
            value={newGuests}
            onChange={(e) => setNewGuests(e.target.value)}
            placeholder={"John Smith\nJane Smith"}
            rows={3}
            className="rounded-lg border border-ink-soft/25 bg-white px-3 py-2 text-sm outline-none focus:border-gold sm:row-span-2"
          />
          <select
            value={newInvite}
            onChange={(e) => setNewInvite(e.target.value as "full" | "evening")}
            className="rounded-lg border border-ink-soft/25 bg-white px-3 py-2 text-sm outline-none focus:border-gold"
          >
            <option value="full">Invited to the full day</option>
            <option value="evening">Invited to the evening only</option>
          </select>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg border border-sage-dark bg-sage-dark px-6 py-2 text-xs tracking-[0.2em] uppercase text-cream transition-all enabled:hover:bg-transparent enabled:hover:text-sage-dark disabled:opacity-40 sm:justify-self-start"
          >
            Add party
          </button>
        </form>
      </section>
    </main>
  );
}

function AddGuestInline({ onAdd }: { onAdd: (name: string) => void }) {
  const [name, setName] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        onAdd(name.trim());
        setName("");
      }}
      className="mt-3 flex gap-2"
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Add a guest to this party…"
        className="min-w-0 flex-1 rounded-lg border border-ink-soft/25 bg-white px-3 py-1.5 text-sm outline-none focus:border-gold"
      />
      <button
        type="submit"
        className="rounded-lg border border-ink-soft/30 px-4 py-1.5 text-[0.65rem] tracking-[0.15em] uppercase text-ink-soft hover:border-sage-dark hover:text-sage-dark"
      >
        Add
      </button>
    </form>
  );
}
