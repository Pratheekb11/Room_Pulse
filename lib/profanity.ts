// Profanity filter for team activities (leaves, sticky notes, stars and the names they're signed with).
// Used on the phone, so people see why straight away, and on the server, so nobody gets round it.
// No list is ever complete: the presenter can still hide an answer on the big screen.

/**
 * The words kept off a board, in lower case: swearing, insults aimed at people and slurs. How each one matches a word someone typed:
 * - `word`   only that word ("cock" blocks "cock", not "cocktail", "peacock" or "cocky")
 * - `word+`  that word or it with a usual ending (-s, -ed, -er, -ing, -y, -head, -face, -hole…)
 * - `word*`  any word starting with it ("cunt*" blocks "cunts", not "Scunthorpe")
 * - `*word*` anywhere inside a word ("*fuck*" blocks "motherfucker"), for words with no innocent look-alikes
 * Typed words are first undisguised: case, accents, numbers and symbols for letters (sh1t, a$$, @ss),
 * stretched letters (fuuuck), spaced or dotted letters (f u c k, s.h.i.t) and stars (f*ck, a**hole).
 */
export const BAD_WORDS: readonly string[] = [
  // English: anywhere inside a word
  "*fuck*", "*shit*", "*bitch*", "*whore*", "*slut*", "*asshole*", "*arsehole*", "*cocksuck*", "*jizz*", "*motherf*",
  // English: words that start with these
  "cunt*", "wank*", "bastard*", "bollock*", "twat*", "douche*", "dildo*", "blowjob*", "porn*", "skank*", "phuck*", "fcuk*",
  // English: the word, maybe with a usual ending
  "fuk+", "fck+", "fuq+", "fvck+", "fking", "fkin", "dick+", "piss+", "rape+", "retard+",
  // English: just the word
  "ass", "asses", "arse", "arses", "dumbass", "jackass", "smartass", "asswipe", "asshat", "cock", "cocks", "cockhead",
  "prick", "pricks", "tits", "titty", "titties", "boob", "boobs", "boobies", "cum", "cumshot", "pussy", "pussies",
  "raping", "rapist", "rapists", "jerkoff", "jackoff", "biatch", "biotch", "milf", "wtf", "stfu",
  // Insults aimed at people
  "idiot*", "stupid*", "stoopid*", "moron*", "imbecile*", "cretin*", "dimwit*", "nitwit*", "halfwit*",
  // Slurs
  "nigger*", "nigga*", "niggaz", "faggot*", "fag", "fags", "spic", "spics", "chink", "chinks", "kike", "kikes",
  "tranny", "trannies", "dyke", "dykes",
  // Hindi / Hinglish abuse
  "chutiya*", "chutiye*", "chutia*", "chut", "choot", "bhenchod*", "behenchod*", "benchod*", "bhanchod*", "bahenchod*",
  "bhencho", "madarchod*", "maderchod*", "maachod*", "bhosdi*", "bhosad*", "bhosda", "bsdk", "gandu", "gaandu",
  "gaand", "lauda", "lawda", "lavda", "lund", "lodu", "randwa", "harami*", "haramkhor*", "kamina", "kamine", "kaminey",
  "bewakoof*", "bevakoof*", "bewkoof*",
];

/** Ordinary words that would otherwise be caught once undisguised. */
const SAFE = new Set(["shiitake"]);

/** What the phone says when a leaf or name is kept off the board. */
export const BLOCKED_MESSAGE = "That has a word we keep off the board. Please put it another way.";

const ENDINGS = ["s", "es", "ed", "er", "ers", "ing", "in", "y", "ies", "head", "heads", "face", "hole", "holes", "bag", "wad"];

type Rule = { root: string; how: "word" | "ending" | "start" | "inside" };
const RULES: Rule[] = BAD_WORDS.map((w) => {
  if (w.startsWith("*")) return { root: w.slice(1, -1), how: "inside" };
  if (w.endsWith("*")) return { root: w.slice(0, -1), how: "start" };
  if (w.endsWith("+")) return { root: w.slice(0, -1), how: "ending" };
  return { root: w, how: "word" };
});

/** Numbers and symbols people use for letters. */
const LOOKS_LIKE: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b", "@": "a", $: "s", "!": "i", "|": "i", "+": "t" };

/** The words in a text, undisguised: lower case, no accents, look-alikes swapped back. `*` is kept as "some letter". */
function words(text: string): string[] {
  const plain = text.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const out: string[] = [];
  for (const raw of plain.split(/[^a-z0-9@$!|+*]+/)) {
    const w = raw.replace(/^[!|+]+|[!|+]+$/g, ""); // "Hello!" is just "hello"
    if (!/[a-z@$]/.test(w)) continue; // numbers and rows of stars on their own
    const swapped = [...w].map((c) => LOOKS_LIKE[c] ?? c).join("").replace(/[^a-z*]/g, "");
    if (/[a-z]/.test(swapped)) out.push(swapped);
  }
  return out;
}

/** Runs of single letters ("f u c k", "s.h.i.t") joined up, every stretch of 3 or more. */
function spelledOut(list: string[]): string[] {
  const joined: string[] = [];
  let run: string[] = [];
  const flush = () => {
    for (let i = 0; i < run.length; i++) for (let j = i + 3; j <= run.length; j++) joined.push(run.slice(i, j).join(""));
    run = [];
  };
  for (const w of list) {
    if (w.length === 1) run.push(w);
    else flush();
  }
  flush();
  return joined;
}

/** A word as typed, and with stretched letters squeezed (fuuuck → fuck, asssss → ass). */
function forms(w: string): string[] {
  return [...new Set([w, w.replace(/([a-z])\1+/g, "$1"), w.replace(/([a-z])\1{2,}/g, "$1$1")])];
}

/** Does `word` at `at` spell `root`? A `*` stands for any letter, but at least half must be real letters. */
function spells(word: string, at: number, root: string): boolean {
  if (at + root.length > word.length) return false;
  let real = 0;
  for (let k = 0; k < root.length; k++) {
    const c = word[at + k];
    if (c === "*") continue;
    if (c !== root[k]) return false;
    real++;
  }
  return real * 2 >= root.length;
}

function breaks(w: string, r: Rule): boolean {
  switch (r.how) {
    case "word":
      return w.length === r.root.length && spells(w, 0, r.root);
    case "ending":
      return [r.root, ...ENDINGS.map((e) => r.root + e)].some((f) => w.length === f.length && spells(w, 0, f));
    case "start":
      return spells(w, 0, r.root);
    case "inside":
      for (let i = 0; i + r.root.length <= w.length; i++) if (spells(w, i, r.root)) return true;
      return false;
  }
}

/** True when the text has a bad word in it, even a disguised one. */
export function hasBadWords(text: string | null | undefined): boolean {
  if (!text) return false;
  const list = words(text);
  for (const w of [...list.filter((x) => !SAFE.has(x)), ...spelledOut(list)]) {
    for (const f of forms(w)) if (RULES.some((r) => breaks(f, r))) return true;
  }
  return false;
}
