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
  aaron: ["az", "ronnie"],
  alexander: ["alex", "xander", "sasha", "al", "sandy", "lex"],
  alexandra: ["alex", "lexi", "sandra", "sasha", "sandy"],
  alfred: ["alf", "alfie", "fred", "freddie"],
  alastair: ["alistair", "alasdair", "alister", "al", "ali"],
  albert: ["bert", "bertie", "al"],
  amanda: ["mandy", "amy"],
  amelia: ["millie", "amy", "mia"],
  andrew: ["andy", "drew"],
  angela: ["angie", "ange"],
  angus: ["gus", "angie"],
  anthony: ["tony", "ant"],
  anton: ["tony", "ant"],
  antonia: ["toni", "annie"],
  archibald: ["archie", "arch"],
  arthur: ["art", "artie", "arty"],
  barbara: ["barb", "babs", "barbie"],
  barnaby: ["barney"],
  bartholomew: ["bart", "barty"],
  beatrice: ["bea", "beattie", "trixie"],
  benjamin: ["ben", "benny", "benji"],
  bernard: ["bernie", "bern"],
  bridget: ["bridie", "biddy"],
  caitlin: ["cait", "caity", "katie", "kate"],
  callum: ["cal"],
  cameron: ["cam"],
  caroline: ["carrie", "caro", "lyn"],
  catherine: ["cathy", "cat", "kate", "katie", "cate"],
  cecilia: ["cissy", "celia"],
  charles: ["charlie", "chuck", "chas", "chaz"],
  charlotte: ["lottie", "charlie", "lotte"],
  christina: ["chris", "tina", "christy"],
  christine: ["chris", "chrissie", "tina"],
  christopher: ["chris", "topher", "kit"],
  clementine: ["clemmie", "clem"],
  constance: ["connie"],
  cordelia: ["delia", "cordie"],
  cynthia: ["cindy"],
  daniel: ["dan", "danny"],
  david: ["dave", "davey", "davy"],
  deborah: ["deb", "debbie"],
  dominic: ["dom", "nick"],
  donald: ["don", "donnie"],
  dorothy: ["dot", "dottie", "dolly"],
  douglas: ["doug", "dougie"],
  duncan: ["dunc"],
  edith: ["edie"],
  edmund: ["ned", "ed", "eddie"],
  edward: ["ed", "eddie", "ted", "ned", "teddy"],
  edwin: ["ed", "eddie", "ted"],
  eleanor: ["ellie", "nora", "el", "nell", "nellie"],
  elizabeth: [
    "liz", "lizzie", "beth", "eliza", "libby", "betsy", "betty", "bess", "bessie",
  ],
  emily: ["em", "emmy", "millie"],
  emma: ["em", "emmy"],
  eugene: ["gene"],
  felicity: ["fliss", "flick", "fee"],
  fiona: ["fi", "fee"],
  florence: ["flo", "florrie", "floss", "flossie"],
  frances: ["fran", "frannie", "fanny"],
  francesca: ["frankie", "fran", "chessie"],
  francis: ["frank", "fran", "frankie"],
  frederick: ["fred", "freddie", "freddy"],
  gabriel: ["gabe"],
  gabriella: ["gabby", "ella"],
  gareth: ["gaz", "gary"],
  gemma: ["gem"],
  geoffrey: ["geoff", "jeff"],
  george: ["georgie", "geordie"],
  georgina: ["gina", "georgie", "george"],
  gerald: ["gerry", "ged"],
  gerard: ["gerry", "ged"],
  gilbert: ["gil", "bert"],
  gillian: ["gill", "jill", "gilly"],
  gordon: ["gordy", "don"],
  graham: ["graeme", "gray"],
  gregory: ["greg"],
  gwendolyn: ["gwen", "wendy"],
  hamish: ["hame"],
  harold: ["harry", "hal"],
  harriet: ["hattie", "hatty"],
  helen: ["nell", "nellie", "lena"],
  henrietta: ["hettie", "etta"],
  henry: ["hank", "harry", "hal"],
  herbert: ["herb", "herbie", "bert"],
  horace: ["horrie"],
  hugh: ["hughie", "huw"],
  humphrey: ["humph"],
  imogen: ["immy", "genie"],
  isabella: ["izzy", "bella", "belle", "issy"],
  isabel: ["izzy", "bella", "belle", "issy"],
  isobel: ["izzy", "bella", "belle", "issy"],
  jacob: ["jake"],
  jacqueline: ["jackie", "jacqui", "jax"],
  james: ["jim", "jimmy", "jamie", "jem"],
  jennifer: ["jen", "jenny"],
  jeremy: ["jez", "jerry", "jem"],
  jessica: ["jess", "jessie"],
  joanna: ["jo", "joanie"],
  joanne: ["jo", "joanie"],
  john: ["jack", "johnny", "jon"],
  jonathan: ["jon", "johnny", "jonny", "nathan"],
  joseph: ["joe", "joey"],
  josephine: ["jo", "josie", "posy"],
  joshua: ["josh"],
  judith: ["judy", "jude"],
  julia: ["jules", "julie"],
  julian: ["jules"],
  juliet: ["jules", "julie"],
  katherine: ["kate", "katie", "kathy", "kat", "kitty"],
  kathryn: ["kate", "katie", "kathy", "kat"],
  kenneth: ["ken", "kenny"],
  kimberly: ["kim"],
  kirsten: ["kirsty"],
  lachlan: ["lachie", "lockie"],
  laura: ["lauri", "lolly"],
  lauren: ["loz", "lozza", "laur"],
  laurence: ["laurie", "larry"],
  lawrence: ["laurie", "larry"],
  leonard: ["leo", "lenny", "len"],
  lesley: ["les"],
  leslie: ["les"],
  lillian: ["lily", "lil", "lily"],
  louis: ["lou", "louie"],
  louisa: ["lou", "lulu"],
  louise: ["lou", "lulu"],
  lucinda: ["lucy", "cindy", "lu"],
  mabel: ["mabs", "may"],
  malcolm: ["malc", "mal"],
  margaret: ["maggie", "meg", "peggy", "marge", "greta", "madge", "peg", "rita"],
  marjorie: ["marge", "madge", "margie"],
  martin: ["marty"],
  mary: ["molly", "polly", "mamie", "may"],
  matilda: ["tilly", "mattie", "tilda"],
  matthew: ["matt", "matty"],
  maurice: ["mo", "maurie"],
  maximilian: ["max"],
  megan: ["meg"],
  michael: ["mike", "mikey", "mick", "micky"],
  michelle: ["shell", "chelle", "mich"],
  millicent: ["millie", "milly"],
  miranda: ["mandy", "randa"],
  montgomery: ["monty"],
  natalie: ["nat"],
  nathaniel: ["nat", "nate"],
  nicholas: ["nick", "nicky", "nico"],
  nicola: ["nikki", "nic", "nicky"],
  nicole: ["nikki", "nic"],
  nigel: ["nige"],
  norman: ["norm"],
  oliver: ["ollie", "ol"],
  olivia: ["liv", "livvy", "ollie"],
  oswald: ["ozzie", "oz"],
  pamela: ["pam"],
  patricia: ["pat", "patty", "tricia", "trish", "patsy"],
  patrick: ["pat", "paddy", "rick", "patch"],
  penelope: ["penny", "pen"],
  percival: ["percy"],
  peter: ["pete"],
  philip: ["phil", "pip"],
  philippa: ["pippa", "pip", "phil"],
  priscilla: ["cilla", "prissy"],
  prudence: ["pru", "prue"],
  rachel: ["rach", "rae"],
  raymond: ["ray"],
  rebecca: ["becca", "becky", "bex"],
  reginald: ["reg", "reggie"],
  richard: ["rich", "rick", "ricky", "dick", "richie"],
  robert: ["rob", "bob", "bobby", "robbie", "bert", "rab"],
  roderick: ["rod", "roddy"],
  roger: ["rodge", "rog"],
  ronald: ["ron", "ronnie"],
  rosemary: ["rosie", "rose", "romy"],
  rupert: ["ru", "roo"],
  russell: ["russ", "rusty"],
  samantha: ["sam", "sammy"],
  samuel: ["sam", "sammy"],
  sarah: ["sara", "sadie", "sally"],
  sebastian: ["seb", "bastian"],
  sidney: ["sid", "syd"],
  simon: ["si", "sim"],
  sophia: ["sophie", "soph"],
  stephanie: ["steph", "stevie"],
  stephen: ["steve", "stevie", "ste"],
  steven: ["steve", "stevie", "ste"],
  stuart: ["stu", "stew"],
  susan: ["sue", "susie", "suzy"],
  susannah: ["susie", "sue", "sukie"],
  sylvia: ["sylv", "sylvie"],
  tabitha: ["tabby", "tabs"],
  terence: ["terry", "tel"],
  theodore: ["ted", "teddy", "theo"],
  thomas: ["tom", "tommy", "thom"],
  timothy: ["tim", "timmy"],
  tobias: ["toby", "tobes"],
  tristan: ["tris"],
  valerie: ["val"],
  vanessa: ["ness", "nessa"],
  veronica: ["ronnie", "vron", "vronny"],
  victor: ["vic"],
  victoria: ["vicky", "tori", "vic", "vickie", "plum"],
  vincent: ["vince", "vinny"],
  virginia: ["ginny", "ginger"],
  vivian: ["viv"],
  vivienne: ["viv"],
  walter: ["walt", "wally"],
  wilfred: ["wilf", "fred"],
  william: ["will", "bill", "billy", "willy", "liam", "wills"],
  winifred: ["winnie", "freda", "win"],
  yvonne: ["vonnie", "evie"],
  zachary: ["zach", "zack", "zac"],
};

/**
 * Common British surname spelling variants — treated as equivalent so
 * "Clark" finds "Clarke", "Smyth" finds "Smith", "Stuart" finds
 * "Stewart", and so on.
 */
const SURNAME_VARIANTS: string[][] = [
  ["smith", "smyth", "smythe"],
  ["clark", "clarke"],
  ["thompson", "thomson"],
  ["johnston", "johnstone"],
  ["brown", "browne"],
  ["gray", "grey"],
  ["reid", "read", "reed", "reade"],
  ["stewart", "stuart"],
  ["macdonald", "mcdonald", "macdonell", "mcdonnell"],
  ["mackenzie", "mckenzie"],
  ["macleod", "mcleod"],
  ["mackay", "mckay"],
  ["maclean", "mclean"],
  ["macgregor", "mcgregor"],
  ["cook", "cooke"],
  ["pearce", "pierce"],
  ["davies", "davis"],
  ["lloyd", "loyd"],
  ["griffiths", "griffith"],
  ["owen", "owens"],
  ["phillips", "philips", "philipps"],
  ["watts", "watt"],
  ["nicholls", "nichols", "nicolls", "nicols"],
  ["simpson", "simson"],
  ["hopkins", "hopkin"],
  ["jeffries", "jefferies", "jeffreys", "jefferys"],
  ["saunders", "sanders"],
  ["bailey", "baillie", "bayley", "baily"],
  ["dickinson", "dickenson"],
  ["dixon", "dickson"],
  ["foster", "forster"],
  ["haywood", "heywood"],
  ["jamieson", "jamison"],
  ["kavanagh", "cavanagh", "kavanaugh", "cavanaugh"],
  ["lee", "leigh", "lea"],
  ["marshall", "marshal"],
  ["matthews", "mathews"],
  ["neal", "neale", "neil", "neill"],
  ["pearson", "pierson"],
  ["ramsay", "ramsey"],
  ["shepherd", "sheppard", "shephard", "shepard", "shepperd"],
  ["spencer", "spenser"],
  ["taylor", "tayler"],
  ["walsh", "welsh", "welch"],
  ["white", "whyte"],
  ["wilson", "willson"],
  ["wood", "woods"],
  ["hughes", "hughs"],
  ["rhys", "reece", "rees", "reese"],
  ["evans", "evens"],
  ["harris", "harries"],
  ["morrison", "morison"],
  ["ferguson", "fergusson"],
  ["cochrane", "cochran"],
  ["kerr", "carr"],
  ["byrne", "burns", "byrnes"],
  ["o'brien", "obrien", "o'brian", "obrian"],
  ["o'connor", "oconnor", "o'conner", "oconner"],
  ["o'neill", "oneill", "o'neil", "oneil"],
  ["holmes", "homes"],
  ["chapman", "chatman"],
  ["hutchinson", "hutchison"],
  ["robertson", "robson"],
  ["waddington", "wadington"],
  ["whittaker", "whitaker"],
  ["worthington", "worthinton"],
];

// Build a bidirectional lookup: any name -> set of equivalent names.
// Nickname groups sharing a name (e.g. stephen/steven via "steve") merge.
const nicknameGroups = new Map<string, Set<string>>();
const allGroups: string[][] = [
  ...Object.entries(NICKNAMES).map(([formal, nicks]) => [formal, ...nicks]),
  ...SURNAME_VARIANTS,
];
for (const rawGroup of allGroups) {
  // Normalize entries the same way input tokens are normalized
  const group = new Set(rawGroup.map((n) => normalize(n)).filter(Boolean));
  const merged = new Set(group);
  for (const name of group) {
    const existing = nicknameGroups.get(name);
    if (existing) for (const n of existing) merged.add(n);
  }
  for (const name of merged) {
    nicknameGroups.set(name, merged);
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

/** "MacTavish" and "McTavish" are the same clan — fold Mac -> Mc */
function foldMacPrefix(t: string): string {
  return t.replace(/^mac(?=[a-z]{3})/, "mc");
}

/** Similarity of two single name tokens, nickname-aware, in [0,1] */
function tokenSimilarity(rawA: string, rawB: string): number {
  const a = foldMacPrefix(rawA);
  const b = foldMacPrefix(rawB);
  if (a === b) return 1;
  // Nickname / surname-variant equivalence ("liz" ~ "elizabeth", "clark" ~ "clarke")
  const group = nicknameGroups.get(rawA) ?? nicknameGroups.get(a);
  if (group && (group.has(rawB) || group.has(b))) return 0.97;
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
