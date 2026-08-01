import { getSetting } from "@/lib/db";
import { site, MenuDef, DishOption, DEFAULT_MENU } from "@/lib/site";

/**
 * Menus are editable from the admin Settings page. The edited version
 * is stored as JSON in the settings table under "menus"; when absent
 * (or unparseable) the defaults from site.ts apply.
 *
 * Server-side code must call getMenus() per request rather than reading
 * site.menus directly, so admin edits take effect immediately.
 */

export const DEFAULT_MENUS: MenuDef[] = site.menus as unknown as MenuDef[];

function isValidMenus(value: unknown): value is MenuDef[] {
  if (!Array.isArray(value) || value.length === 0) return false;
  return value.every(
    (m) =>
      m &&
      typeof m.id === "string" &&
      m.id !== "" &&
      typeof m.label === "string" &&
      Array.isArray(m.courses) &&
      m.courses.every(
        (c: unknown) =>
          c &&
          typeof (c as { id?: unknown }).id === "string" &&
          typeof (c as { label?: unknown }).label === "string" &&
          Array.isArray((c as { options?: unknown }).options) &&
          (c as { options: unknown[] }).options.every(
            (o: unknown) =>
              o &&
              typeof (o as { id?: unknown }).id === "string" &&
              typeof (o as { label?: unknown }).label === "string"
          )
      )
  );
}

export function getMenus(): MenuDef[] {
  const raw = getSetting("menus");
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (isValidMenus(parsed)) return parsed;
    } catch {
      /* fall through to defaults */
    }
  }
  return DEFAULT_MENUS;
}

export function menuById(menus: MenuDef[], id: string): MenuDef {
  return menus.find((m) => m.id === id) ?? menus[0] ?? DEFAULT_MENUS[0];
}

/** Storable dish ids for an option: its variants, else the option id */
export function storableIds(o: DishOption): string[] {
  return o.variants?.length ? o.variants.map((v) => v.id) : [o.id];
}

/** dish id -> label, across every menu, course and variant */
export function dishLabels(menus: MenuDef[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const menu of menus) {
    for (const course of menu.courses) {
      for (const o of course.options) {
        map.set(o.id, o.label);
        for (const v of o.variants ?? []) {
          map.set(v.id, `${o.label} — ${v.label.toLowerCase()}`);
        }
      }
    }
  }
  return map;
}

/** menu id -> course id -> set of storable dish ids (for validation) */
export function menuCourseDishes(
  menus: MenuDef[]
): Map<string, Map<string, Set<string>>> {
  return new Map(
    menus.map((menu) => [
      menu.id,
      new Map(
        menu.courses.map((course) => [
          course.id,
          new Set<string>(course.options.flatMap(storableIds)),
        ])
      ),
    ])
  );
}

/** Every course id in display order (union across menus) */
export function courseOrder(menus: MenuDef[]): { id: string; label: string }[] {
  const seen = new Map<string, string>();
  for (const menu of menus) {
    for (const course of menu.courses) {
      if (!seen.has(course.id)) seen.set(course.id, course.label);
    }
  }
  return [...seen.entries()].map(([id, label]) => ({ id, label }));
}

/** Valid menu ids right now */
export function menuIds(menus: MenuDef[]): Set<string> {
  return new Set(menus.map((m) => m.id));
}

export { DEFAULT_MENU };
