/**
 * Fuzzy name matching so guests still find themselves with typos,
 * nicknames, missing middle names, or swapped word order.
 *
 * Scoring combines Jaro-Winkler similarity (great for typos and short
 * strings) with token-level alignment (handles "Liz Smith" vs
 * "Elizabeth Anne Smith") and a nickname dictionary.
 */

const NICKNAMES: Record<string, string[]> = {
  abigail: ["abby", "abbie", "gail"],
  alexander: ["alex", "xander", "sasha", "al"],
  alexandra: ["alex", "lexi", "sandra", "sasha"],
  andrew: ["andy", "drew"],
  anthony: ["tony", "ant"],
  anton: ["tony", "ant"],
  benjamin: ["ben", "benny", "benji"],
  caitlin: ["cait", "caity", "katie", "kate"],
  catherine: ["cathy", "cat", "kate", "katie", "cate"],
  charles: ["charlie", "chuck", "chas"],
  christina: ["chris", "tina", "christy"],
  christopher: ["chris", "topher", "kit"],
  daniel: ["dan", "danny"],
  david: ["dave", "davey"],
  deborah: ["deb", "debbie"],
  dorothy: ["dot", "dottie"],
  edward: ["ed", "eddie", "ted", "ned"],
  eleanor: ["ellie", "nora", "el"],
  elizabeth: ["liz", "lizzie", "beth", "eliza", "libby", "betsy", "betty"],
  emily: ["em", "emmy"],
  frances: ["fran", "frannie"],
  francis: ["frank", "fran"],
  frederick: ["fred", "freddie"],
  gabriel: ["gabe"],
  gabriella: ["gabby", "ella"],
  gregory: ["greg"],
  henry: ["hank", "harry"],
  isabella: ["izzy", "bella", "belle"],
  jacob: ["jake"],
  james: ["jim", "jimmy", "jamie"],
  jennifer: ["jen", "jenny"],
  jessica: ["jess", "jessie"],
  john: ["jack", "johnny", "jon"],
  jonathan: ["jon", "johnny", "nathan"],
  joseph: ["joe", "joey"],
  joshua: ["josh"],
  katherine: ["kate", "katie", "kathy", "kat", "kitty"],
  kenneth: ["ken", "kenny"],
  kimberly: ["kim"],
  lawrence: ["larry"],
  leonard: ["leo", "lenny"],
  margaret: ["maggie", "meg", "peggy", "marge", "greta"],
  matthew: ["matt", "matty"],
  maximilian: ["max"],
  megan: ["meg"],
  michael: ["mike", "mikey", "mick"],
  natalie: ["nat"],
  nicholas: ["nick", "nicky"],
  nicole: ["nikki", "nic"],
  oliver: ["ollie"],
  olivia: ["liv", "livvy", "ollie"],
  pamela: ["pam"],
  patricia: ["pat", "patty", "tricia", "trish"],
  patrick: ["pat", "paddy", "rick"],
  peter: ["pete"],
  philip: ["phil"],
  rebecca: ["becca", "becky"],
  richard: ["rich", "rick", "ricky", "dick"],
  robert: ["rob", "bob", "bobby", "robbie", "bert"],
  ronald: ["ron", "ronnie"],
  samantha: ["sam", "sammy"],
  samuel: ["sam", "sammy"],
  sarah: ["sara", "sadie"],
  stephanie: ["steph"],
  stephen: ["steve", "stevie"],
  steven: ["steve", "stevie"],
  susan: ["sue", "susie", "suzy"],
  theodore: ["ted", "teddy", "theo"],
  thomas: ["tom", "tommy", "thom"],
  timothy: ["tim", "timmy"],
  victoria: ["vicky", "tori", "vic"],
  vincent: ["vince", "vinny"],
  virginia: ["ginny", "ginger"],
  william: ["will", "bill", "billy", "willy", "liam"],
  zachary: ["zach", "zack"],
};

// Build a bidirectional lookup: any name -> set of equivalent names
const nicknameGroups = new Map<string, Set<string>>();
for (const [formal, nicks] of Object.entries(NICKNAMES)) {
  const group = new Set([formal, ...nicks]);
  for (const name of group) {
    const existing = nicknameGroups.get(name);
    if (existing) {
      for (const n of group) existing.add(n);
    } else {
      nicknameGroups.set(name, new Set(group));
    }
  }
}

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .replace(/[^a-z\s'-]/g, " ")
    .replace(/['-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(s: string): string[] {
  return normalize(s).split(" ").filter(Boolean);
}

/** Jaro similarity in [0,1] */
function jaro(a: string, b: string): number {
  if (a === b) return 1;
  const la = a.length;
  const lb = b.length;
  if (la === 0 || lb === 0) return 0;

  const matchWindow = Math.max(Math.floor(Math.max(la, lb) / 2) - 1, 0);
  const aMatched = new Array<boolean>(la).fill(false);
  const bMatched = new Array<boolean>(lb).fill(false);

  let matches = 0;
  for (let i = 0; i < la; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, lb);
    for (let j = start; j < end; j++) {
      if (bMatched[j] || a[i] !== b[j]) continue;
      aMatched[i] = true;
      bMatched[j] = true;
      matches++;
      break;
    }
  }
  if (matches === 0) return 0;

  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < la; i++) {
    if (!aMatched[i]) continue;
    while (!bMatched[k]) k++;
    if (a[i] !== b[k]) transpositions++;
    k++;
  }
  transpositions /= 2;

  return (
    (matches / la + matches / lb + (matches - transpositions) / matches) / 3
  );
}

/** Jaro-Winkler: boosts scores for shared prefixes (common in names) */
function jaroWinkler(a: string, b: string): number {
  const j = jaro(a, b);
  let prefix = 0;
  const maxPrefix = Math.min(4, a.length, b.length);
  while (prefix < maxPrefix && a[prefix] === b[prefix]) prefix++;
  return j + prefix * 0.1 * (1 - j);
}

/** Similarity of two single name tokens, nickname-aware, in [0,1] */
function tokenSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  // Nickname equivalence ("liz" ~ "elizabeth")
  const group = nicknameGroups.get(a);
  if (group && group.has(b)) return 0.97;
  // Initial matching ("j" ~ "james")
  if (a.length === 1 && b.startsWith(a)) return 0.75;
  if (b.length === 1 && a.startsWith(b)) return 0.75;
  return jaroWinkler(a, b);
}

/**
 * Score how well an input name matches a guest name, in [0,1].
 * Uses greedy best-pair token alignment so word order doesn't matter
 * and extra middle names aren't penalized much.
 */
export function nameMatchScore(input: string, guestName: string): number {
  const inputTokens = tokens(input);
  const guestTokens = tokens(guestName);
  if (inputTokens.length === 0 || guestTokens.length === 0) return 0;

  // Whole-string similarity as a floor (catches run-together names)
  const whole = jaroWinkler(normalize(input), normalize(guestName));

  // Greedy alignment: each input token grabs its best unused guest token
  const used = new Array<boolean>(guestTokens.length).fill(false);
  let total = 0;
  const pairScores: number[] = [];
  for (const it of inputTokens) {
    let best = 0;
    let bestIdx = -1;
    for (let j = 0; j < guestTokens.length; j++) {
      if (used[j]) continue;
      const s = tokenSimilarity(it, guestTokens[j]);
      if (s > best) {
        best = s;
        bestIdx = j;
      }
    }
    if (bestIdx >= 0) used[bestIdx] = true;
    total += best;
    pairScores.push(best);
  }
  let aligned = total / inputTokens.length;

  // Require the surname (last token) to plausibly match — otherwise
  // "John Smith" would match "John Miller" at a high score.
  const lastInput = inputTokens[inputTokens.length - 1];
  let bestLast = 0;
  for (const gt of guestTokens) {
    bestLast = Math.max(bestLast, tokenSimilarity(lastInput, gt));
  }
  if (inputTokens.length > 1 && bestLast < 0.78) {
    aligned *= 0.72;
  }

  // Single-word inputs are inherently ambiguous — cap their score so
  // they surface as "did you mean?" candidates rather than auto-matches.
  let score = Math.max(whole, aligned);
  if (inputTokens.length === 1) score = Math.min(score, 0.82);

  return score;
}

export interface Candidate<T> {
  item: T;
  score: number;
}

/**
 * Rank guests against the typed name.
 * Returns candidates above a floor, best first.
 */
export function rankMatches<T>(
  input: string,
  items: T[],
  getName: (item: T) => string,
  { floor = 0.6, limit = 5 }: { floor?: number; limit?: number } = {}
): Candidate<T>[] {
  return items
    .map((item) => ({ item, score: nameMatchScore(input, getName(item)) }))
    .filter((c) => c.score >= floor)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** Confidence tiers used by the lookup API to decide UX */
export const CONFIDENT_MATCH = 0.86; // proceed straight to confirmation
export const POSSIBLE_MATCH = 0.72; // show as "did you mean?"
