/**
 * Single place to customize everything about the wedding.
 * Edit these values — no other code changes needed.
 */

/** A dish variant, e.g. a burger with or without cheese. Guests picking
 *  the dish then choose a variant from a dropdown; the variant id is
 *  what gets stored. */
export interface DishVariant {
  id: string;
  label: string;
}

export interface DishOption {
  id: string;
  label: string;
  description?: string;
  variants?: DishVariant[];
  /** Dietary tag ids from DIETARY_TAGS, shown as symbols to guests */
  tags?: string[];
}

/**
 * Dietary symbols shown next to dishes. Add or reword freely — each
 * dish stores only the tag id, so changes here apply everywhere.
 */
export const DIETARY_TAGS = [
  { id: "vegetarian", label: "Vegetarian", symbol: "V" },
  { id: "vegan", label: "Vegan", symbol: "VG" },
  { id: "gluten-free", label: "Gluten free", symbol: "GF" },
  { id: "dairy-free", label: "Dairy free", symbol: "DF" },
  { id: "nuts", label: "Contains nuts", symbol: "N" },
] as const;

export type DietaryTag = (typeof DIETARY_TAGS)[number];

export const TAG_IDS = new Set<string>(DIETARY_TAGS.map((t) => t.id));

export function tagById(id: string): DietaryTag | undefined {
  return DIETARY_TAGS.find((t) => t.id === id);
}

export interface CourseDef {
  id: string;
  label: string;
  options: DishOption[];
}

export interface MenuDef {
  id: string;
  label: string;
  courses: CourseDef[];
}

const MENUS: MenuDef[] = [
  {
    id: "adult",
    label: "Adult Menu",
    courses: [
      {
        id: "starter",
        label: "Starter",
        options: [
          {
            id: "ad-st-soup",
            label: "Spiced Parsnip Soup",
            description: "With parsnip crisp",
          },
          {
            id: "ad-st-prawn",
            label: "Garlic King Prawn Parcel",
            description: "Sautéed leeks, lemon and chive butter sauce",
          },
        ],
      },
      {
        id: "main",
        label: "Main",
        options: [
          {
            id: "ad-mn-lamb",
            label: "Slow-Braised Lamb Shank",
            description:
              "Creamed potatoes, pancetta, green beans and confit carrots",
          },
          {
            id: "ad-mn-chicken",
            label: "Corn-Fed Chicken Supreme",
            description:
              "Fondant potatoes, squash purée, asparagus, king oyster mushrooms and brandy jus",
          },
        ],
      },
      {
        id: "dessert",
        label: "Dessert",
        options: [
          {
            id: "ad-ds-chocolate",
            label: "Chocolate Trio",
            description:
              "'After Eight' chocolate brownie, chocolate fondant, chocolate crisp and mint ice cream",
          },
          {
            id: "ad-ds-eton",
            label: "Eton Mess Cheesecake",
            description: "Poached fruit and Chantilly cream",
          },
        ],
      },
    ],
  },
  {
    id: "children",
    label: "Kids Menu",
    courses: [
      {
        id: "starter",
        label: "Starter",
        options: [
          {
            id: "kd-st-flatbread",
            label: "Garlic Flatbread",
            description: "",
            variants: [
              { id: "kd-st-flatbread-cheese", label: "With cheese" },
              { id: "kd-st-flatbread-plain", label: "Without cheese" },
            ],
          },
          {
            id: "kd-st-soup",
            tags: ["vegetarian"],
            label: "Homemade Tomato Soup",
            description: "",
          },
          {
            id: "kd-st-hummus",
            tags: ["vegetarian", "vegan"],
            label: "Hummus & Vegetable Crudités",
            description: "",
          },
        ],
      },
      {
        id: "main",
        label: "Main",
        options: [
          {
            id: "kd-mn-burger",
            label: "4oz Beef Burger with Fries",
            description: "",
            variants: [
              { id: "kd-mn-burger-cheese", label: "With cheese" },
              { id: "kd-mn-burger-plain", label: "Without cheese" },
            ],
          },
          {
            id: "kd-mn-pasta",
            tags: ["vegetarian"],
            label: "Pasta in Tomato & Basil Sauce",
            description: "",
          },
          {
            id: "kd-mn-chicken",
            label: "Chicken Strips",
            description: "Served with fries and peas",
          },
        ],
      },
      {
        id: "dessert",
        label: "Dessert",
        options: [
          {
            id: "kd-ds-icecream",
            tags: ["vegetarian"],
            label: "Ice Cream",
            description: "Vanilla, chocolate or strawberry",
          },
          {
            id: "kd-ds-brownie",
            tags: ["vegetarian"],
            label: "Triple Chocolate Brownie",
            description: "Served with ice cream",
          },
          {
            id: "kd-ds-toffee",
            tags: ["vegetarian"],
            label: "Sticky Toffee Pudding",
            description: "Served with warm custard",
          },
        ],
      },
    ],
  },
  {
    id: "coeliac-adult",
    label: "Adult Coeliac Menu",
    // TODO: replace these placeholders with the venue's gluten-free
    // adult dishes when confirmed — same shape as the menus above.
    courses: [
      {
        id: "starter",
        label: "Starter",
        options: [
          {
            id: "ca-st-tbc",
            tags: ["gluten-free"],
            label: "Gluten-Free Starter (TBC)",
            description: "Being finalised with the venue",
          },
        ],
      },
      {
        id: "main",
        label: "Main",
        options: [
          {
            id: "ca-mn-tbc",
            tags: ["gluten-free"],
            label: "Gluten-Free Main (TBC)",
            description: "Being finalised with the venue",
          },
        ],
      },
      {
        id: "dessert",
        label: "Dessert",
        options: [
          {
            id: "ca-ds-tbc",
            tags: ["gluten-free"],
            label: "Gluten-Free Dessert (TBC)",
            description: "Being finalised with the venue",
          },
        ],
      },
    ],
  },
  {
    id: "coeliac-kids",
    label: "Kids Coeliac Menu",
    courses: [
      {
        id: "starter",
        label: "Starter",
        options: [
          {
            id: "ck-st-soup",
            tags: ["vegetarian", "gluten-free"],
            label: "Homemade Tomato Soup",
            description: "Gluten-free",
          },
          {
            id: "ck-st-hummus",
            tags: ["vegetarian", "vegan", "gluten-free"],
            label: "Hummus & Vegetable Crudités",
            description: "Gluten-free",
          },
        ],
      },
      {
        id: "main",
        label: "Main",
        options: [
          {
            id: "ck-mn-burger",
            tags: ["gluten-free"],
            label: "4oz Beef Burger with Fries",
            description: "Gluten-free",
            variants: [
              { id: "ck-mn-burger-cheese", label: "With cheese" },
              { id: "ck-mn-burger-plain", label: "Without cheese" },
            ],
          },
          {
            id: "ck-mn-chicken",
            tags: ["gluten-free"],
            label: "Grilled Chicken Breast",
            description:
              "Gluten-free — served with fries or mash and garden peas",
          },
        ],
      },
      {
        id: "dessert",
        label: "Dessert",
        options: [
          {
            id: "ck-ds-icecream",
            tags: ["vegetarian", "gluten-free"],
            label: "Ice Cream",
            description: "Vanilla, chocolate or strawberry — gluten-free",
          },
        ],
      },
    ],
  },
  {
    id: "vegetarian",
    label: "Vegetarian Menu",
    // TODO: replace these placeholders with the vegetarian dishes when
    // confirmed — same shape as the menus above.
    courses: [
      {
        id: "starter",
        label: "Starter",
        options: [
          {
            id: "vg-st-tbc",
            tags: ["vegetarian"],
            label: "Vegetarian Starter (TBC)",
            description: "Being finalised with the venue",
          },
        ],
      },
      {
        id: "main",
        label: "Main",
        options: [
          {
            id: "vg-mn-tbc",
            tags: ["vegetarian"],
            label: "Vegetarian Main (TBC)",
            description: "Being finalised with the venue",
          },
        ],
      },
      {
        id: "dessert",
        label: "Dessert",
        options: [
          {
            id: "vg-ds-tbc",
            tags: ["vegetarian"],
            label: "Vegetarian Dessert (TBC)",
            description: "Being finalised with the venue",
          },
        ],
      },
    ],
  },
];

export const site = {
  coupleNames: "Lauren Cain & Aaron Clayton",
  // Short one-liner shown under the names on the splash page
  tagline: "are getting married",
  dateDisplay: "Saturday, May 29th, 2027",
  venueName: "The Joshua Bradley and Bluebell Suite",
  venueLocation: "Stockport Rd, Hyde SK14 5EZ",
  rsvpDeadlineDisplay: "May 29th, 2027",
  // Email shown to guests who can't find their name
  contactEmail: "tom@sheps.me",
  // How each invitation tier is described to guests on the RSVP page
  inviteInfo: {
    full: "You are invited to the full day — ceremony, lunch, and evening celebration.",
    evening: "You are warmly invited to the evening celebration.",
  },
  /**
   * The wedding-lunch menus. Every guest is on the "adult" menu by
   * default; assign a different menu per guest from the admin dashboard.
   * Each menu has courses (starter/main/dessert) and guests pick one
   * dish per course. Dish ids must be unique across ALL menus.
   */
  menus: MENUS,
} as const;

export type Menu = MenuDef;

/**
 * Menu id every guest starts on. The menus themselves are editable from
 * the admin Settings page — server code reads them via lib/menus.ts,
 * which falls back to the definitions above when nothing is saved.
 */
export const DEFAULT_MENU = "adult";

/**
 * A guest's meal choices are stored as a JSON object mapping course id
 * to dish id, e.g. {"starter":"ad-st-soup","main":"ad-mn-lamb"}.
 * Parses defensively: legacy or malformed values become {}.
 */
export function parseMeals(meal: string | null | undefined): Record<string, string> {
  if (!meal || !meal.startsWith("{")) return {};
  try {
    const parsed = JSON.parse(meal) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
      return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === "string") out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}
