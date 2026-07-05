/**
 * Single place to customize everything about the wedding.
 * Edit these values — no other code changes needed.
 */
export const site = {
  coupleNames: "Lauren Cain & Aaron Clayton",
  // Short one-liner shown under the names on the splash page
  tagline: "are getting married",
  dateDisplay: "Saturday, June 12, 2027",
  venueName: "The Pub Name",
  venueLocation: "Manchester",
  rsvpDeadlineDisplay: "May 1, 2027",
  // Email shown to guests who can't find their name
  contactEmail: "tom@sheps.me",
  // How each invitation tier is described to guests on the RSVP page
  inviteInfo: {
    full: "You are warmly invited to the full day — ceremony, lunch, and evening celebration.",
    evening: "You are warmly invited to the evening celebration.",
  },
  /**
   * The wedding-lunch menus. Every guest is on the "adult" menu by
   * default; they (or you, from the admin panel) can switch them to a
   * different menu, and they then choose a dish from that menu.
   * Meal ids must be unique across ALL menus.
   */
  menus: [
    {
      id: "adult",
      label: "Standard Menu",
      mealOptions: [
        {
          id: "beef",
          label: "Braised Short Rib",
          description:
            "Red wine braised beef, whipped potatoes, seasonal vegetables",
          vegetarian: false,
          glutenFree: false,
        },
        {
          id: "chicken",
          label: "Herb Roasted Chicken",
          description: "Lemon-thyme jus, roasted fingerlings, haricots verts",
          vegetarian: false,
          glutenFree: false,
        },
        {
          id: "fish",
          label: "Pan-Seared Salmon",
          description: "Citrus beurre blanc, wild rice pilaf, grilled asparagus",
          vegetarian: false,
          glutenFree: false,
        },
        {
          id: "vegetarian",
          label: "Wild Mushroom Risotto",
          description: "Parmesan, truffle oil, crispy sage",
          vegetarian: true,
          glutenFree: false,
        },
      ],
    },
    {
      id: "vegetarian",
      label: "Vegetarian Menu",
      mealOptions: [
        {
          id: "veg-wellington",
          label: "Roasted Squash Wellington",
          description: "Butternut squash, spinach & chestnut in golden pastry",
          vegetarian: true,
          glutenFree: false,
        },
        {
          id: "veg-risotto",
          label: "Wild Mushroom Risotto",
          description: "Parmesan-style cheese, truffle oil, crispy sage",
          vegetarian: true,
          glutenFree: false,
        },
        {
          id: "veg-parmigiana",
          label: "Aubergine Parmigiana",
          description: "Layered aubergine, rich tomato sugo, basil, mozzarella",
          vegetarian: true,
          glutenFree: false,
        },
      ],
    },
    {
      id: "coeliac",
      label: "Coeliac Menu",
      mealOptions: [
        {
          id: "gf-beef",
          label: "Braised Short Rib (GF)",
          description:
            "Red wine braised beef, whipped potatoes, seasonal vegetables — fully gluten-free",
          vegetarian: false,
          glutenFree: true,
        },
        {
          id: "gf-chicken",
          label: "Roast Chicken Breast (GF)",
          description:
            "Lemon-thyme jus, roasted potatoes, green beans — fully gluten-free",
          vegetarian: false,
          glutenFree: true,
        },
        {
          id: "gf-salmon",
          label: "Baked Salmon Fillet (GF)",
          description:
            "Citrus butter sauce, new potatoes, asparagus — fully gluten-free",
          vegetarian: false,
          glutenFree: true,
        },
      ],
    },
    {
      id: "children",
      label: "Children's Menu",
      mealOptions: [
        {
          id: "kids-goujons",
          label: "Chicken Goujons & Chips",
          description: "With peas or beans and a little pot of ketchup",
          vegetarian: false,
          glutenFree: false,
        },
        {
          id: "kids-sausage",
          label: "Sausage & Mash",
          description: "Pork sausages, buttery mash, gravy",
          vegetarian: false,
          glutenFree: false,
        },
        {
          id: "kids-pasta",
          label: "Tomato Pasta",
          description: "Penne in a mild tomato sauce with cheese on top",
          vegetarian: true,
          glutenFree: false,
        },
      ],
    },
  ],
} as const;

export type Menu = (typeof site.menus)[number];
export type MealOption = Menu["mealOptions"][number];

/** Lookup helpers used by the app and API */
export const MENU_IDS = new Set<string>(site.menus.map((m) => m.id));
export const DEFAULT_MENU = "adult";

export function menuById(id: string): Menu {
  return site.menus.find((m) => m.id === id) ?? site.menus[0];
}

/** meal id -> label, across every menu */
export const MEAL_LABELS = new Map<string, string>(
  site.menus.flatMap((menu) =>
    menu.mealOptions.map((o): [string, string] => [o.id, o.label])
  )
);

/** menu id -> set of its meal ids (for validation) */
export const MENU_MEALS = new Map<string, Set<string>>(
  site.menus.map((menu) => [
    menu.id,
    new Set<string>(menu.mealOptions.map((o) => o.id)),
  ])
);
