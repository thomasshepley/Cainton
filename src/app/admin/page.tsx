"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { site } from "@/lib/site";

interface AdminRow {
  guest_id: number;
  full_name: string;
  party_id: number;
  party_label: string;
  invite_type: "full" | "evening";
  attending: number | null;
  meal: string | null;
  submitted_by: string | null;
  submitted_at: string | null;
  comment: string | null;
  song_request: string | null;
}

const MEAL_LABELS = new Map<string, string>(
  site.mealOptions.map((m) => [m.id, m.label])
);

export default function AdminPage() {
  const [key, setKey] = useState("");
  const [authed, setAuthed] = useState(false);
  const [rows, setRows] = useState<AdminRow[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // New party form
  const [newLabel, setNewLabel] = useState("");
  const [newGuests, setNewGuests] = useState("");
  const [newInvite, setNewInvite] = useState<"full" | "evening">("full");

  const load = useCallback(
    async (adminKey: string) => {
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
    },
    []
  );

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
    const total = rows.length;
    const attending = rows.filter((r) => r.attending === 1).length;
    const declined = rows.filter((r) => r.attending === 0).length;
    const pending = total - attending - declined;
    const meals = new Map<string, number>();
    for (const r of rows) {
      if (r.attending === 1 && r.meal) {
        meals.set(r.meal, (meals.get(r.meal) ?? 0) + 1);
      }
    }
    return { total, attending, declined, pending, meals };
  }, [rows]);

  const parties = useMemo(() => {
    const byParty = new Map<number, { label: string; rows: AdminRow[] }>();
    for (const r of rows) {
      const p = byParty.get(r.party_id) ?? { label: r.party_label, rows: [] };
      p.rows.push(r);
      byParty.set(r.party_id, p);
    }
    return [...byParty.entries()];
  }, [rows]);

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
            {site.coupleNames} — wedding dashboard
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

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl">Wedding dashboard</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {site.coupleNames} · {site.dateDisplay}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={downloadCsv}
            className="border border-ink-soft/40 px-4 py-2 text-xs tracking-[0.15em] uppercase text-ink-soft hover:border-ink hover:text-ink"
          >
            Export CSV
          </button>
          <button
            onClick={() => {
              sessionStorage.removeItem("adminKey");
              setAuthed(false);
              setKey("");
            }}
            className="border border-ink-soft/40 px-4 py-2 text-xs tracking-[0.15em] uppercase text-ink-soft hover:border-ink hover:text-ink"
          >
            Log out
          </button>
        </div>
      </header>

      {error && <p className="mt-4 text-sm text-red-700">{error}</p>}

      {/* Stats */}
      <section className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Invited", value: stats.total },
          { label: "Attending", value: stats.attending },
          { label: "Declined", value: stats.declined },
          { label: "Awaiting", value: stats.pending },
        ].map((s) => (
          <div
            key={s.label}
            className="border border-ink-soft/20 bg-white/60 p-5 text-center"
          >
            <p className="font-display text-4xl">{s.value}</p>
            <p className="mt-1 text-xs tracking-[0.2em] uppercase text-ink-soft">
              {s.label}
            </p>
          </div>
        ))}
      </section>

      {/* Meal counts */}
      {stats.meals.size > 0 && (
        <section className="mt-6 border border-ink-soft/20 bg-white/60 p-5">
          <h2 className="text-xs tracking-[0.25em] uppercase text-ink-soft">
            Meal counts
          </h2>
          <div className="mt-3 flex flex-wrap gap-x-8 gap-y-2">
            {[...stats.meals.entries()].map(([mealId, count]) => (
              <p key={mealId} className="text-sm">
                <span className="font-display text-xl">{count}</span>{" "}
                <span className="text-ink-soft">
                  × {MEAL_LABELS.get(mealId) ?? mealId}
                </span>
              </p>
            ))}
          </div>
        </section>
      )}

      {/* Guest list by party */}
      <section className="mt-10">
        <h2 className="font-display text-2xl">Guest list</h2>
        <div className="mt-4 space-y-4">
          {parties.map(([partyId, p]) => (
            <div
              key={partyId}
              className="border border-ink-soft/20 bg-white/60 p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-display flex items-center gap-3 text-xl">
                  {p.label}
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-[0.6rem] tracking-[0.15em] uppercase ${
                      p.rows[0]?.invite_type === "evening"
                        ? "border-gold/60 text-gold"
                        : "border-sage-dark/40 text-sage-dark"
                    }`}
                  >
                    {p.rows[0]?.invite_type === "evening"
                      ? "Evening only"
                      : "Full day"}
                  </span>
                </h3>
                <button
                  onClick={() => {
                    if (confirm(`Delete party "${p.label}" and all its guests?`))
                      action({ action: "deleteParty", partyId });
                  }}
                  className="text-xs tracking-[0.15em] uppercase text-red-800/70 hover:text-red-800 hover:underline"
                >
                  Delete party
                </button>
              </div>
              <table className="mt-3 w-full text-sm">
                <tbody>
                  {p.rows.map((r) => (
                    <tr
                      key={r.guest_id}
                      className="border-t border-ink-soft/10"
                    >
                      <td className="py-2 pr-4">{r.full_name}</td>
                      <td className="py-2 pr-4">
                        {r.attending === null ? (
                          <span className="text-ink-soft/60">No response</span>
                        ) : r.attending === 1 ? (
                          <span className="text-sage-dark">✓ Attending</span>
                        ) : (
                          <span className="text-ink-soft">✗ Declined</span>
                        )}
                      </td>
                      <td className="py-2 pr-4 text-ink-soft">
                        {r.meal ? (MEAL_LABELS.get(r.meal) ?? r.meal) : "—"}
                      </td>
                      <td className="py-2 text-right">
                        <button
                          onClick={() => {
                            if (confirm(`Remove ${r.full_name} from the list?`))
                              action({
                                action: "deleteGuest",
                                guestId: r.guest_id,
                              });
                          }}
                          className="text-xs text-red-800/60 hover:text-red-800 hover:underline"
                        >
                          remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(p.rows[0]?.comment || p.rows[0]?.song_request) && (
                <div className="mt-3 space-y-1 border-t border-ink-soft/10 pt-3 text-sm text-ink-soft">
                  {p.rows[0]?.comment && <p className="italic">“{p.rows[0].comment}”</p>}
                  {p.rows[0]?.song_request && (
                    <p>🎵 Song request: {p.rows[0].song_request}</p>
                  )}
                </div>
              )}
              <AddGuestInline
                onAdd={(name) =>
                  action({ action: "addGuest", partyId, name })
                }
              />
            </div>
          ))}
        </div>
      </section>

      {/* Add party */}
      <section className="mt-10 border border-ink-soft/20 bg-white/60 p-5">
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
            className="border border-ink-soft/25 bg-white px-3 py-2 text-sm outline-none focus:border-gold"
          />
          <textarea
            value={newGuests}
            onChange={(e) => setNewGuests(e.target.value)}
            placeholder={"John Smith\nJane Smith"}
            rows={3}
            className="border border-ink-soft/25 bg-white px-3 py-2 text-sm outline-none focus:border-gold sm:row-span-2"
          />
          <select
            value={newInvite}
            onChange={(e) => setNewInvite(e.target.value as "full" | "evening")}
            className="border border-ink-soft/25 bg-white px-3 py-2 text-sm outline-none focus:border-gold"
          >
            <option value="full">Invited to the full day</option>
            <option value="evening">Invited to the evening only</option>
          </select>
          <button
            type="submit"
            disabled={busy}
            className="border border-sage-dark bg-sage-dark px-6 py-2 text-xs tracking-[0.2em] uppercase text-cream transition-all enabled:hover:bg-transparent enabled:hover:text-sage-dark disabled:opacity-40 sm:justify-self-start"
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
      className="mt-3 flex gap-2 border-t border-ink-soft/10 pt-3"
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Add a guest to this party…"
        className="flex-1 border border-ink-soft/25 bg-white px-3 py-1.5 text-sm outline-none focus:border-gold"
      />
      <button
        type="submit"
        className="border border-ink-soft/30 px-4 py-1.5 text-xs tracking-[0.15em] uppercase text-ink-soft hover:border-sage-dark hover:text-sage-dark"
      >
        Add
      </button>
    </form>
  );
}
