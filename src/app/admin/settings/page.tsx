"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { site, MenuDef, CourseDef, DishOption } from "@/lib/site";

interface SiteSettings {
  lockMeals: boolean;
  selfEditOnly: boolean;
  lockAfterSubmit: boolean;
  mealDeadline: string;
  rsvpDeadline: string;
  commentsAfterDeadline: boolean;
  closedMessage: string;
}

/**
 * New ids are generated from the label plus a short random suffix.
 * Existing ids are never regenerated — guests' stored choices point at
 * them, so renaming a dish keeps every response intact.
 */
function newId(prefix: string, label: string): string {
  const slug =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 20) || "item";
  return `${prefix}-${slug}-${Math.random().toString(36).slice(2, 6)}`;
}

const INPUT_CLASS =
  "w-full rounded-lg border border-ink-soft/25 bg-white px-3 py-2 text-sm outline-none focus:border-gold";
const SMALL_BTN =
  "rounded-lg border border-ink-soft/30 px-2.5 py-1 text-[0.65rem] tracking-[0.1em] uppercase text-ink-soft hover:border-sage-dark hover:text-sage-dark";

/** ISO timestamp -> value for <input type="datetime-local"> (local time) */
function isoToLocal(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localToIso(local: string): string {
  if (!local) return "";
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

function Toggle({
  checked,
  onChange,
  disabled,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label: string;
  description: string;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-3">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-ink-soft">
          {description}
        </span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors ${
          checked ? "bg-sage-dark" : "bg-ink-soft/30"
        } disabled:opacity-50`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-5" : ""
          }`}
        />
      </button>
    </label>
  );
}

export default function AdminSettingsPage() {
  const [key, setKey] = useState("");
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  // Deadline / message drafts (saved explicitly)
  const [mealDeadline, setMealDeadline] = useState("");
  const [rsvpDeadline, setRsvpDeadline] = useState("");
  const [closedMessage, setClosedMessage] = useState("");

  // Menu editor (drafts — saved explicitly)
  const [menus, setMenus] = useState<MenuDef[]>([]);
  const [menusDirty, setMenusDirty] = useState(false);
  const [menusOpen, setMenusOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Password form
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNext, setPwNext] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("adminTheme");
    if (saved === "dark") setTheme("dark");
    return () => document.documentElement.classList.remove("theme-dark");
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("theme-dark", theme === "dark");
    localStorage.setItem("adminTheme", theme);
  }, [theme]);

  const load = useCallback(async (adminKey: string) => {
    try {
      const res = await fetch("/api/admin/settings", {
        headers: { "x-admin-key": adminKey },
      });
      if (!res.ok) {
        setAuthed(false);
        return;
      }
      const data = await res.json();
      setSettings(data.settings);
      setMealDeadline(isoToLocal(data.settings.mealDeadline));
      setRsvpDeadline(isoToLocal(data.settings.rsvpDeadline));
      setClosedMessage(data.settings.closedMessage);
      if (Array.isArray(data.menus)) {
        setMenus(data.menus);
        setMenusDirty(false);
      }
      setAuthed(true);
    } catch {
      setAuthed(false);
    }
  }, []);

  useEffect(() => {
    const saved = sessionStorage.getItem("adminKey") ?? "";
    setKey(saved);
    if (saved) load(saved);
    else setAuthed(false);
  }, [load]);

  async function update(changes: Partial<SiteSettings>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-key": key },
        body: JSON.stringify({
          action: "update",
          changes,
          client: {
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not save.");
        return;
      }
      setSettings(data.settings);
      setNotice("Saved.");
    } catch {
      setError("Could not save.");
    } finally {
      setBusy(false);
    }
  }

  /* ---------- menu editing helpers (draft state only) ---------- */

  function editMenus(fn: (draft: MenuDef[]) => MenuDef[]) {
    setMenus((prev) => fn(structuredClone(prev)));
    setMenusDirty(true);
  }

  const updateMenu = (menuId: string, patch: Partial<MenuDef>) =>
    editMenus((d) => d.map((m) => (m.id === menuId ? { ...m, ...patch } : m)));

  const updateCourse = (
    menuId: string,
    courseId: string,
    patch: Partial<CourseDef>
  ) =>
    editMenus((d) =>
      d.map((m) =>
        m.id === menuId
          ? {
              ...m,
              courses: m.courses.map((c) =>
                c.id === courseId ? { ...c, ...patch } : c
              ),
            }
          : m
      )
    );

  const updateDish = (
    menuId: string,
    courseId: string,
    dishId: string,
    patch: Partial<DishOption>
  ) =>
    editMenus((d) =>
      d.map((m) =>
        m.id === menuId
          ? {
              ...m,
              courses: m.courses.map((c) =>
                c.id === courseId
                  ? {
                      ...c,
                      options: c.options.map((o) =>
                        o.id === dishId ? { ...o, ...patch } : o
                      ),
                    }
                  : c
              ),
            }
          : m
      )
    );

  const addDish = (menuId: string, courseId: string) =>
    editMenus((d) =>
      d.map((m) =>
        m.id === menuId
          ? {
              ...m,
              courses: m.courses.map((c) =>
                c.id === courseId
                  ? {
                      ...c,
                      options: [
                        ...c.options,
                        { id: newId("dish", "new dish"), label: "", description: "" },
                      ],
                    }
                  : c
              ),
            }
          : m
      )
    );

  const removeDish = (menuId: string, courseId: string, dishId: string) =>
    editMenus((d) =>
      d.map((m) =>
        m.id === menuId
          ? {
              ...m,
              courses: m.courses.map((c) =>
                c.id === courseId
                  ? { ...c, options: c.options.filter((o) => o.id !== dishId) }
                  : c
              ),
            }
          : m
      )
    );

  const addCourse = (menuId: string) =>
    editMenus((d) =>
      d.map((m) =>
        m.id === menuId
          ? {
              ...m,
              courses: [
                ...m.courses,
                {
                  id: newId("course", "course"),
                  label: "",
                  options: [
                    { id: newId("dish", "new dish"), label: "", description: "" },
                  ],
                },
              ],
            }
          : m
      )
    );

  const removeCourse = (menuId: string, courseId: string) =>
    editMenus((d) =>
      d.map((m) =>
        m.id === menuId
          ? { ...m, courses: m.courses.filter((c) => c.id !== courseId) }
          : m
      )
    );

  const addMenu = () =>
    editMenus((d) => [
      ...d,
      {
        id: newId("menu", "menu"),
        label: "",
        courses: [
          {
            id: newId("course", "starter"),
            label: "Starter",
            options: [
              { id: newId("dish", "new dish"), label: "", description: "" },
            ],
          },
        ],
      },
    ]);

  const removeMenu = (menuId: string) =>
    editMenus((d) => d.filter((m) => m.id !== menuId));

  /** Toggle a dish between plain and having with/without-cheese style options */
  const toggleVariants = (menuId: string, courseId: string, dish: DishOption) =>
    updateDish(menuId, courseId, dish.id, {
      variants: dish.variants?.length
        ? undefined
        : [
            { id: newId("opt", "option a"), label: "" },
            { id: newId("opt", "option b"), label: "" },
          ],
    });

  async function menuAction(payload: Record<string, unknown>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-key": key },
        body: JSON.stringify({
          ...payload,
          client: {
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not save the menus.");
        return;
      }
      if (Array.isArray(data.menus)) setMenus(data.menus);
      setMenusDirty(false);
      setNotice("Menus saved.");
    } catch {
      setError("Could not save the menus.");
    } finally {
      setBusy(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    if (pwNext !== pwConfirm) {
      setError("New passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-key": key },
        body: JSON.stringify({
          action: "changePassword",
          current: pwCurrent,
          next: pwNext,
          client: {
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not change password.");
        return;
      }
      // The stored session key is now stale — update it
      sessionStorage.setItem("adminKey", pwNext);
      setKey(pwNext);
      setPwCurrent("");
      setPwNext("");
      setPwConfirm("");
      setNotice("Password changed.");
    } catch {
      setError("Could not change password.");
    } finally {
      setBusy(false);
    }
  }

  if (authed === null) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-ink-soft">
        Loading…
      </main>
    );
  }

  if (!authed || !settings) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="font-display text-3xl">Settings</h1>
        <p className="text-sm text-ink-soft">
          Please log in on the dashboard first.
        </p>
        <Link
          href="/admin"
          className="rounded-lg border border-sage-dark px-6 py-2 text-xs tracking-[0.2em] uppercase text-sage-dark hover:bg-sage-dark hover:text-cream"
        >
          Go to dashboard
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl">Settings</h1>
          <p className="mt-1 text-xs text-ink-soft sm:text-sm">
            {site.coupleNames} · Wedding Dashboard
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            title="Toggle dark mode"
            className="rounded-lg border border-ink-soft/30 px-3 py-1.5 text-[0.65rem] tracking-[0.15em] uppercase text-ink-soft hover:border-ink hover:text-ink"
          >
            {theme === "dark" ? "☀ Light" : "🌙 Dark"}
          </button>
          <Link
            href="/admin"
            className="rounded-lg border border-ink-soft/30 px-3 py-1.5 text-[0.65rem] tracking-[0.15em] uppercase text-ink-soft hover:border-ink hover:text-ink"
          >
            ← Dashboard
          </Link>
        </div>
      </header>

      {error && <p className="mt-4 text-sm text-red-700">{error}</p>}
      {notice && <p className="mt-4 text-sm text-sage-dark">{notice}</p>}

      {/* Locks */}
      <section className="mt-6 rounded-xl border border-ink-soft/20 bg-white/60 p-4">
        <h2 className="text-[0.65rem] tracking-[0.25em] uppercase text-ink-soft">
          Locks
        </h2>
        <div className="mt-1 divide-y divide-ink-soft/10">
          <Toggle
            checked={settings.lockMeals}
            disabled={busy}
            onChange={(v) => update({ lockMeals: v })}
            label="Lock all meal choices now"
            description="Nobody can change meal choices while this is on. Attendance, notes and song requests stay open."
          />
          <Toggle
            checked={settings.lockAfterSubmit}
            disabled={busy}
            onChange={(v) => update({ lockAfterSubmit: v })}
            label="Lock meal choices once submitted"
            description="After a guest submits their meal choices they can't change them — only you can, from the dashboard."
          />
          <Toggle
            checked={settings.selfEditOnly}
            disabled={busy}
            onChange={(v) => update({ selfEditOnly: v })}
            label="Guests can only edit their own response"
            description="Each guest must RSVP under their own name. They still see the rest of their party's answers, but can't change them."
          />
        </div>
        <p className="mt-2 border-t border-ink-soft/10 pt-3 text-xs leading-relaxed text-ink-soft">
          To hide a family from the name search entirely (e.g. your own
          party), use the <em>Hide from search</em> button inside that
          family&apos;s card on the dashboard.
        </p>
      </section>

      {/* Deadlines */}
      <section className="mt-4 rounded-xl border border-ink-soft/20 bg-white/60 p-4">
        <h2 className="text-[0.65rem] tracking-[0.25em] uppercase text-ink-soft">
          Deadlines
        </h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="block text-sm font-medium">Meal choice deadline</span>
            <span className="mt-0.5 block text-xs text-ink-soft">
              Meal choices lock at this time; RSVPs stay open.
            </span>
            <input
              type="datetime-local"
              value={mealDeadline}
              onChange={(e) => setMealDeadline(e.target.value)}
              className="mt-2 w-full rounded-lg border border-ink-soft/25 bg-white px-3 py-2 text-sm outline-none focus:border-gold"
            />
          </label>
          <label className="block">
            <span className="block text-sm font-medium">RSVP deadline</span>
            <span className="mt-0.5 block text-xs text-ink-soft">
              RSVPs and meal choices both lock at this time.
            </span>
            <input
              type="datetime-local"
              value={rsvpDeadline}
              onChange={(e) => setRsvpDeadline(e.target.value)}
              className="mt-2 w-full rounded-lg border border-ink-soft/25 bg-white px-3 py-2 text-sm outline-none focus:border-gold"
            />
          </label>
        </div>
        <div className="mt-2 divide-y divide-ink-soft/10">
          <Toggle
            checked={settings.commentsAfterDeadline}
            disabled={busy}
            onChange={(v) => update({ commentsAfterDeadline: v })}
            label="Keep notes & song requests open after the RSVP deadline"
            description="Guests can still find their name and update their note and song request — everything else stays locked."
          />
        </div>
        <label className="mt-3 block">
          <span className="block text-sm font-medium">
            Message shown when RSVPs are closed
          </span>
          <textarea
            value={closedMessage}
            onChange={(e) => setClosedMessage(e.target.value)}
            rows={2}
            maxLength={500}
            className="mt-2 w-full rounded-lg border border-ink-soft/25 bg-white px-3 py-2 text-sm leading-relaxed outline-none focus:border-gold"
          />
        </label>
        <button
          onClick={() =>
            update({
              mealDeadline: localToIso(mealDeadline),
              rsvpDeadline: localToIso(rsvpDeadline),
              closedMessage,
            })
          }
          disabled={busy}
          className="mt-3 rounded-lg border border-sage-dark bg-sage-dark px-6 py-2 text-xs tracking-[0.2em] uppercase text-cream transition-all enabled:hover:bg-transparent enabled:hover:text-sage-dark disabled:opacity-40"
        >
          Save deadlines
        </button>
        <button
          onClick={() => {
            setMealDeadline("");
            setRsvpDeadline("");
            update({ mealDeadline: "", rsvpDeadline: "" });
          }}
          disabled={busy}
          className="mt-3 ml-2 rounded-lg border border-ink-soft/30 px-4 py-2 text-xs tracking-[0.15em] uppercase text-ink-soft hover:border-ink hover:text-ink disabled:opacity-40"
        >
          Clear deadlines
        </button>
      </section>

      {/* Menus */}
      <section className="mt-4 overflow-hidden rounded-xl border border-ink-soft/20 bg-white/60">
        <button
          onClick={() => setMenusOpen((v) => !v)}
          className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-cream-dark/40"
        >
          <span
            className={`text-xs text-ink-soft transition-transform duration-200 ${
              menusOpen ? "rotate-90" : ""
            }`}
          >
            ▸
          </span>
          <span className="flex-1">
            <span className="block text-[0.65rem] tracking-[0.25em] uppercase text-ink-soft">
              Menus
            </span>
            <span className="mt-0.5 block text-xs text-ink-soft">
              {menus.length} menus · edit courses and dishes
            </span>
          </span>
          {menusDirty && <span className="text-[0.65rem] text-gold">unsaved</span>}
        </button>

        {menusOpen && (
          <div className="border-t border-ink-soft/10 px-4 pb-4">
            <p className="py-3 text-xs leading-relaxed text-ink-soft">
              Renaming a dish is always safe — guests who already chose it
              keep their choice. Deleting a dish leaves anyone who picked it
              without that course, so check the dashboard afterwards.
            </p>

            <div className="space-y-2">
              {menus.map((menu) => {
                const open = openMenuId === menu.id;
                return (
                  <div
                    key={menu.id}
                    className="overflow-hidden rounded-lg border border-ink-soft/20 bg-white/70"
                  >
                    <div className="flex items-center gap-2 px-3 py-2">
                      <button
                        onClick={() => setOpenMenuId(open ? null : menu.id)}
                        className={`text-xs text-ink-soft transition-transform duration-200 ${
                          open ? "rotate-90" : ""
                        }`}
                        aria-label="Expand menu"
                      >
                        ▸
                      </button>
                      <input
                        value={menu.label}
                        onChange={(e) =>
                          updateMenu(menu.id, { label: e.target.value })
                        }
                        placeholder="Menu name"
                        className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm font-medium outline-none hover:border-ink-soft/20 focus:border-gold focus:bg-white"
                      />
                      <span className="text-[0.65rem] text-ink-soft/60">
                        {menu.courses.length} courses
                      </span>
                      <button
                        onClick={() => {
                          if (
                            confirm(
                              `Delete the "${menu.label || "untitled"}" menu? Guests assigned to it will need moving to another menu.`
                            )
                          )
                            removeMenu(menu.id);
                        }}
                        className="text-xs text-red-800/50 hover:text-red-800"
                        title="Delete menu"
                      >
                        ✕
                      </button>
                    </div>

                    {open && (
                      <div className="space-y-3 border-t border-ink-soft/10 px-3 py-3">
                        {menu.courses.map((course) => (
                          <div
                            key={course.id}
                            className="rounded-lg border border-ink-soft/15 p-2.5"
                          >
                            <div className="flex items-center gap-2">
                              <input
                                value={course.label}
                                onChange={(e) =>
                                  updateCourse(menu.id, course.id, {
                                    label: e.target.value,
                                  })
                                }
                                placeholder="Course name (e.g. Starter)"
                                className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 text-[0.7rem] tracking-[0.15em] uppercase outline-none hover:border-ink-soft/20 focus:border-gold focus:bg-white"
                              />
                              <button
                                onClick={() => {
                                  if (confirm(`Delete the "${course.label}" course?`))
                                    removeCourse(menu.id, course.id);
                                }}
                                className="text-xs text-red-800/50 hover:text-red-800"
                                title="Delete course"
                              >
                                ✕
                              </button>
                            </div>

                            <div className="mt-2 space-y-2">
                              {course.options.map((dish) => (
                                <div
                                  key={dish.id}
                                  className="rounded-lg bg-cream-dark/40 p-2"
                                >
                                  <div className="flex items-center gap-2">
                                    <input
                                      value={dish.label}
                                      onChange={(e) =>
                                        updateDish(menu.id, course.id, dish.id, {
                                          label: e.target.value,
                                        })
                                      }
                                      placeholder="Dish name"
                                      className={INPUT_CLASS}
                                    />
                                    <button
                                      onClick={() =>
                                        removeDish(menu.id, course.id, dish.id)
                                      }
                                      className="text-xs text-red-800/50 hover:text-red-800"
                                      title="Delete dish"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                  <input
                                    value={dish.description ?? ""}
                                    onChange={(e) =>
                                      updateDish(menu.id, course.id, dish.id, {
                                        description: e.target.value,
                                      })
                                    }
                                    placeholder="Description (optional)"
                                    className={`${INPUT_CLASS} mt-1.5 text-xs`}
                                  />
                                  {dish.variants?.length ? (
                                    <div className="mt-1.5 space-y-1.5 border-l-2 border-sage-dark/30 pl-2.5">
                                      <p className="text-[0.6rem] tracking-[0.15em] uppercase text-ink-soft">
                                        Guest picks one
                                      </p>
                                      {dish.variants.map((v, vi) => (
                                        <input
                                          key={v.id}
                                          value={v.label}
                                          onChange={(e) => {
                                            const next = [...dish.variants!];
                                            next[vi] = {
                                              ...v,
                                              label: e.target.value,
                                            };
                                            updateDish(
                                              menu.id,
                                              course.id,
                                              dish.id,
                                              { variants: next }
                                            );
                                          }}
                                          placeholder={`Option ${vi + 1} (e.g. With cheese)`}
                                          className={`${INPUT_CLASS} text-xs`}
                                        />
                                      ))}
                                      <div className="flex gap-2">
                                        <button
                                          onClick={() =>
                                            updateDish(menu.id, course.id, dish.id, {
                                              variants: [
                                                ...dish.variants!,
                                                {
                                                  id: newId("opt", "option"),
                                                  label: "",
                                                },
                                              ],
                                            })
                                          }
                                          className={SMALL_BTN}
                                        >
                                          + Option
                                        </button>
                                        <button
                                          onClick={() =>
                                            toggleVariants(menu.id, course.id, dish)
                                          }
                                          className={SMALL_BTN}
                                        >
                                          Remove options
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() =>
                                        toggleVariants(menu.id, course.id, dish)
                                      }
                                      className={`${SMALL_BTN} mt-1.5`}
                                      title="For dishes like a burger with or without cheese"
                                    >
                                      + Add choices (e.g. with / without cheese)
                                    </button>
                                  )}
                                </div>
                              ))}
                              <button
                                onClick={() => addDish(menu.id, course.id)}
                                className={SMALL_BTN}
                              >
                                + Dish
                              </button>
                            </div>
                          </div>
                        ))}
                        <button
                          onClick={() => addCourse(menu.id)}
                          className={SMALL_BTN}
                        >
                          + Course
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button onClick={addMenu} className={SMALL_BTN}>
                + Menu
              </button>
              <span className="flex-1" />
              <button
                onClick={() => {
                  if (
                    confirm(
                      "Discard your menu edits and go back to the built-in menus?"
                    )
                  )
                    menuAction({ action: "resetMenus" });
                }}
                disabled={busy}
                className="rounded-lg border border-ink-soft/30 px-4 py-2 text-xs tracking-[0.15em] uppercase text-ink-soft hover:border-ink hover:text-ink disabled:opacity-40"
              >
                Reset to defaults
              </button>
              <button
                onClick={() => menuAction({ action: "saveMenus", menus })}
                disabled={busy || !menusDirty}
                className="rounded-lg border border-sage-dark bg-sage-dark px-6 py-2 text-xs tracking-[0.2em] uppercase text-cream transition-all enabled:hover:bg-transparent enabled:hover:text-sage-dark disabled:opacity-40"
              >
                Save menus
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Security */}
      <section className="mt-4 rounded-xl border border-ink-soft/20 bg-white/60 p-4">
        <h2 className="text-[0.65rem] tracking-[0.25em] uppercase text-ink-soft">
          Security
        </h2>
        <form onSubmit={changePassword} className="mt-3 grid gap-3 sm:max-w-sm">
          <input
            type="password"
            value={pwCurrent}
            onChange={(e) => setPwCurrent(e.target.value)}
            placeholder="Current password"
            autoComplete="current-password"
            className="rounded-lg border border-ink-soft/25 bg-white px-3 py-2 text-sm outline-none focus:border-gold"
          />
          <input
            type="password"
            value={pwNext}
            onChange={(e) => setPwNext(e.target.value)}
            placeholder="New password (min 8 characters)"
            autoComplete="new-password"
            className="rounded-lg border border-ink-soft/25 bg-white px-3 py-2 text-sm outline-none focus:border-gold"
          />
          <input
            type="password"
            value={pwConfirm}
            onChange={(e) => setPwConfirm(e.target.value)}
            placeholder="Confirm new password"
            autoComplete="new-password"
            className="rounded-lg border border-ink-soft/25 bg-white px-3 py-2 text-sm outline-none focus:border-gold"
          />
          <button
            type="submit"
            disabled={busy || !pwCurrent || pwNext.length < 8}
            className="rounded-lg border border-sage-dark bg-sage-dark px-6 py-2 text-xs tracking-[0.2em] uppercase text-cream transition-all enabled:hover:bg-transparent enabled:hover:text-sage-dark disabled:opacity-40 sm:justify-self-start"
          >
            Change password
          </button>
        </form>
        <div className="mt-4 border-t border-ink-soft/10 pt-3">
          <p className="text-xs font-medium">
            Admin only — reset the password over SSH
          </p>
          <p className="mt-1 text-xs leading-relaxed text-ink-soft">
            Locked out? Connect to the server and run these three commands.
            The password then reverts to <code>ADMIN_PASSWORD</code> in the
            server&apos;s <code>.env</code> file.
          </p>
          <pre className="mt-2 overflow-x-auto rounded-lg bg-cream-dark px-3 py-2 text-[0.7rem] leading-relaxed">
            {`ssh ubuntu@<your-server-ip>
cd Cainton
docker compose exec wedding-rsvp node scripts/reset-admin-password.js`}
          </pre>
        </div>
      </section>
    </main>
  );
}
