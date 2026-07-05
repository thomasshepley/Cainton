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
  mealOptions: [
    {
      id: "beef",
      label: "Braised Short Rib",
      description: "Red wine braised beef, whipped potatoes, seasonal vegetables",
    },
    {
      id: "chicken",
      label: "Herb Roasted Chicken",
      description: "Lemon-thyme jus, roasted fingerlings, haricots verts",
    },
    {
      id: "fish",
      label: "Pan-Seared Salmon",
      description: "Citrus beurre blanc, wild rice pilaf, grilled asparagus",
    },
    {
      id: "vegetarian",
      label: "Wild Mushroom Risotto",
      description: "Parmesan, truffle oil, crispy sage (vegetarian)",
    },
  ],
} as const;

export type MealOption = (typeof site.mealOptions)[number];
