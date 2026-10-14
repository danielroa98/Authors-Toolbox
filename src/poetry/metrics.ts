import { bodyStart, syllablesEn } from "../text/analysis";

/* ======================================================================
   POETRY METRICS — pure functions.
   Spanish: metrical syllables (sinalefa across words, hiato on accented weak vowels,
   ley del acento final) and rhyme from the stressed vowel (consonant and assonant).
   English: approximate syllable counts and rhyme from the last vowel sound.
   All counts are estimates: poets bend these rules (sinéresis, diéresis, licences).
   ====================================================================== */

export type PoemLang = "es" | "en";

export interface VerseLine {
  /** Line number in the note (0-based). */
  line: number;
  /** Text without markup. */
  text: string;
  stanza: number;
  /** Metrical syllables (Spanish) or syllables (English). */
  syllables: number;
  /** Spanish only: how the count was reached. */
  detail?: { raw: number; sinalefas: number; finalStress: "aguda" | "llana" | "esdrújula"; adjust: number };
  /** Rhyme of the last word: consonant (all sounds from the stressed vowel) and assonant (vowels only). */
  rhyme: string;
  assonance: string;
  /** Letter in the rhyme scheme ("A", "b", "-" for an unrhymed line); `′` marks assonant rhyme. */
  letter: string;
}

export interface PoemAnalysis {
  lang: PoemLang;
  lines: VerseLine[];
  stanzas: number;
  words: number;
  /** Rhyme scheme per stanza, e.g. ["ABBA", "ABBA", "CDC", "DCD"]. */
  scheme: string[];
  /** Most common syllable count and how many lines have it. */
  meter: { syllables: number; count: number; name: string } | null;
  form: string;
}

/* ---------- Spanish syllables ---------- */

const STRONG = "aeoáéóíú";   // í and ú break a diphthong (hiato), so they count as strong
const VOWELS = "aeiouáéíóúü";
const ACCENTED = "áéíóú";

/** Normalise a word for syllable counting: lowercase letters, silent h and u removed. */
function prepEs(w: string): string {
  return w.toLowerCase()
    .replace(/[^a-záéíóúüñ]/g, "")
    .replace(/h/g, "")
    .replace(/qu(?=[eiéí])/g, "q").replace(/gu(?=[eiéí])/g, "g");
}

/** Vowel nuclei of a Spanish word: each entry is the vowel group of one syllable. */
function nucleiEs(word: string): string[] {
  const w = prepEs(word).replace(/y$/, "i");   // final y is a vowel: rey, hoy, muy
  const out: string[] = [];
  let cur = "";
  for (const ch of w) {
    const isV = VOWELS.includes(ch) || (ch === "y" && w.length === 1);
    if (!isV) { if (cur) { out.push(cur); cur = ""; } continue; }
    if (cur) {
      const prev = cur[cur.length - 1];
      // two strong vowels (or an accented weak one) are separate syllables
      if (STRONG.includes(prev) && STRONG.includes(ch)) { out.push(cur); cur = ch; continue; }
    }
    cur += ch;
  }
  if (cur) out.push(cur);
  if (!out.length && w === "y") out.push("i");
  return out;
}

/** Which syllable of a word carries the stress, counted from the end (0 = last). */
function stressFromEnd(word: string): number {
  const n = nucleiEs(word);
  if (n.length <= 1) return 0;
  for (let k = n.length - 1; k >= 0; k--) if ([...n[k]].some((c) => ACCENTED.includes(c))) return n.length - 1 - k;
  const w = prepEs(word);
  return /[aeiouns]$/.test(w) ? 1 : 0;   // llana if it ends in a vowel, n or s; otherwise aguda
}

const startsWithVowel = (w: string) => { const p = prepEs(w); return p === "y" || VOWELS.includes(p[0] ?? ""); };
/** Ends in a vowel sound that can join the next word (a final y — hoy, soy — becomes a consonant before a vowel instead). */
const endsWithVowel = (w: string) => { const p = prepEs(w); return VOWELS.includes(p[p.length - 1] ?? "") || p === "y"; };

/** Metrical syllables of one line of Spanish verse. */
export function metricEs(text: string): Pick<VerseLine, "syllables" | "detail"> {
  const words = text.match(/[\p{L}]+/gu) ?? [];
  if (!words.length) return { syllables: 0 };
  let raw = 0, sinalefas = 0;
  // the conjunction "y" before a vowel is pronounced as a consonant ("rosa y azucena" → ro-sa-ya-zu-ce-na)
  const yOnset = (k: number) => prepEs(words[k] ?? "") === "y" && k + 1 < words.length && startsWithVowel(words[k + 1]) && prepEs(words[k + 1]) !== "y";
  words.forEach((w, k) => {
    if (yOnset(k)) return;
    raw += Math.max(1, nucleiEs(w).length);
    const next = words[k + 1];
    // sinalefa: a word ending in a vowel joins the next word starting with a vowel (h is silent)
    if (next && !yOnset(k + 1) && endsWithVowel(w) && startsWithVowel(next)) sinalefas++;
  });
  const last = words[words.length - 1];
  const s = stressFromEnd(last);
  const finalStress = s === 0 ? "aguda" : s === 1 ? "llana" : "esdrújula";
  const adjust = s === 0 ? 1 : s >= 2 ? -1 : 0;
  return { syllables: raw - sinalefas + adjust, detail: { raw, sinalefas, finalStress, adjust } };
}

/** Rhyme of a Spanish line: sounds from the stressed vowel of the last word. */
export function rhymeEs(text: string): { rhyme: string; assonance: string } {
  const words = text.match(/[\p{L}]+/gu) ?? [];
  const last = words[words.length - 1];
  if (!last) return { rhyme: "", assonance: "" };
  const n = nucleiEs(last);
  const w = prepEs(last).replace(/y$/, "i");
  if (!n.length) return { rhyme: w, assonance: "" };
  const idx = n.length - 1 - stressFromEnd(last);
  // position of the stressed nucleus in the word
  let pos = 0;
  for (let k = 0; k < idx; k++) pos = w.indexOf(n[k], pos) + n[k].length;
  pos = w.indexOf(n[idx], pos);
  // in a rising diphthong (cielo, nuevo) the rhyme starts at the strong vowel
  let nucleus = n[idx];
  const strongAt = [...nucleus].findIndex((c) => STRONG.includes(c));
  if (strongAt > 0) { pos += strongAt; nucleus = nucleus.slice(strongAt); }
  // drop accents but keep ñ (a different sound from n)
  const plain = (s: string) => s.replace(/ñ/g, "\uE001").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\uE001/g, "ñ").replace(/v/g, "b");
  const rhyme = plain(w.slice(pos));
  // assonance: the stressed vowel and the vowel of each following syllable (weak glides ignored)
  const vowels = [plain(nucleus)[0]];
  for (const nu of n.slice(idx + 1)) {
    const strong = [...plain(nu)].find((c) => "aeo".includes(c)) ?? plain(nu)[0];
    vowels.push(strong);
  }
  return { rhyme, assonance: vowels.join("-") };
}

/* ---------- English ---------- */

export function rhymeEn(text: string): { rhyme: string; assonance: string } {
  const last = (text.toLowerCase().match(/[a-z']+/g) ?? []).pop()?.replace(/'/g, "") ?? "";
  if (!last) return { rhyme: "", assonance: "" };
  let w = last, silentE = "";
  if (/[^aeiouy]e$/.test(w) && w.length > 3) { silentE = "e"; w = w.slice(0, -1); }
  const m = /[aeiouy]+[^aeiouy]*$/.exec(w);
  const rhyme = (m ? m[0] : w) + silentE;
  return { rhyme, assonance: (m ? m[0].replace(/[^aeiouy]/g, "") : "") };
}

/* ---------- whole poem ---------- */

const METER_ES: Record<number, string> = {
  2: "bisílabo", 3: "trisílabo", 4: "tetrasílabo", 5: "pentasílabo", 6: "hexasílabo", 7: "heptasílabo", 8: "octosílabo",
  9: "eneasílabo", 10: "decasílabo", 11: "endecasílabo", 12: "dodecasílabo", 13: "tridecasílabo", 14: "alejandrino",
};

/** Plain text of a verse line: markup, comments and alignment markers removed. */
export function verseText(line: string): string {
  return line.replace(/%%[^%]*%%/g, "").replace(/!\[\[[^\]]*\]\]/g, "").replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, "$2")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/(\*\*\*|\*\*|\*|__|_|~~|==)/g, "").replace(/\s\^[\w-]+\s*$/, "").trim();
}

/** Lines of verse in a note (front matter, headings, callouts, comments and code left out). */
export function poemLines(text: string): { line: number; text: string; stanza: number }[] {
  const lines = text.split("\n");
  const out: { line: number; text: string; stanza: number }[] = [];
  let stanza = 0, gap = true, fence = false, comment = false, callout = false;
  for (let n = bodyStart(lines); n < lines.length; n++) {
    const L = lines[n];
    if (comment) { if (L.includes("%%")) comment = false; continue; }
    if (/^\s*(```|~~~)/.test(L)) { fence = !fence; continue; }
    if (fence) continue;
    if (/^\s*%%/.test(L) && (L.match(/%%/g) || []).length % 2 === 1) { comment = true; continue; }
    if (!L.trim()) { gap = true; callout = false; continue; }
    if (/^\s*>\s*\[!/.test(L)) { callout = true; continue; }
    if (callout && /^\s*>/.test(L)) continue;
    if (/^\s{0,3}#{1,6}\s/.test(L) || /^\s*!\[\[[^\]]*\]\]\s*$/.test(L) || /^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(L)) { gap = true; continue; }
    const t = verseText(L.replace(/^\s*>\s?/, ""));
    if (!t) continue;
    if (gap && out.length) stanza++;
    gap = false;
    out.push({ line: n, text: t, stanza });
  }
  return out;
}

export function analyzePoem(text: string, lang: PoemLang): PoemAnalysis {
  const raw = poemLines(text);
  const lines: VerseLine[] = raw.map((r) => {
    const m = lang === "es" ? metricEs(r.text) : { syllables: (r.text.match(/[a-zA-Z']+/g) ?? []).reduce((t, w) => t + syllablesEn(w), 0) };
    const rh = lang === "es" ? rhymeEs(r.text) : rhymeEn(r.text);
    return { ...r, ...m, ...rh, letter: "-" };
  });

  // rhyme letters: consonant rhyme first; in Spanish, lines left over can share assonance
  const letters = new Map<string, string>();
  let next = 0;
  const letterFor = (key: string) => {
    if (!letters.has(key)) letters.set(key, String.fromCharCode(65 + (next++ % 26)));
    return letters.get(key) ?? "?";
  };
  const count = (key: (l: VerseLine) => string, v: string) => lines.filter((l) => key(l) === v).length;
  for (const l of lines) {
    if (l.rhyme && count((x) => x.rhyme, l.rhyme) > 1) l.letter = letterFor("c:" + l.rhyme);
    else if (lang === "es" && l.assonance && count((x) => x.assonance, l.assonance) > 1) l.letter = letterFor("a:" + l.assonance) + "′";
  }
  // Spanish convention: lowercase letters for arte menor (8 syllables or fewer)
  if (lang === "es") for (const l of lines) if (l.letter !== "-" && l.syllables <= 8) l.letter = l.letter.toLowerCase();
  if (lang === "en") for (const l of lines) l.letter = l.letter.toLowerCase();

  const stanzas = lines.length ? lines[lines.length - 1].stanza + 1 : 0;
  const scheme: string[] = [];
  for (let s = 0; s < stanzas; s++) scheme.push(lines.filter((l) => l.stanza === s).map((l) => l.letter).join(""));

  const freq = new Map<number, number>();
  for (const l of lines) freq.set(l.syllables, (freq.get(l.syllables) ?? 0) + 1);
  const top = [...freq.entries()].sort((a, b) => b[1] - a[1])[0];
  const meter = top ? { syllables: top[0], count: top[1], name: lang === "es" ? METER_ES[top[0]] ?? `${top[0]} sílabas` : `${top[0]} syllables` } : null;

  return {
    lang, lines, stanzas, scheme, meter,
    words: lines.reduce((t, l) => t + (l.text.match(/[\p{L}\p{N}]+/gu) ?? []).length, 0),
    form: recogniseForm(lines, stanzas, lang),
  };
}

/** Name the form when the poem matches one (sonnet, haiku, décima, romance…). */
function recogniseForm(lines: VerseLine[], stanzas: number, lang: PoemLang): string {
  const n = lines.length;
  const es = lang === "es";
  if (!n) return es ? "Sin versos" : "No lines yet";
  const near = (v: number, target: number, tol = 1) => Math.abs(v - target) <= tol;
  const share = (pred: (l: VerseLine) => boolean) => lines.filter(pred).length / n;
  const scheme = lines.map((l) => l.letter.toUpperCase().replace("′", "")).join("");
  if (n === 3 && near(lines[0].syllables, 5) && near(lines[1].syllables, 7) && near(lines[2].syllables, 5)) return "Haiku (5‑7‑5)";
  if (n === 14) {
    const hendeca = share((l) => near(l.syllables, es ? 11 : 10)) >= 0.7;
    if (hendeca) {
      if (es) return /^ABBAABBA/.test(scheme) ? "Soneto (endecasílabos, ABBA ABBA…)" : "Soneto (endecasílabos)";
      return /^ABABCDCDEFEFGG$/.test(scheme) ? "Shakespearean sonnet (abab cdcd efef gg)" : /^ABBAABBA/.test(scheme) ? "Petrarchan sonnet (abba abba…)" : "Sonnet (14 lines)";
    }
    return es ? "Catorce versos (¿soneto libre?)" : "Fourteen lines (free sonnet?)";
  }
  if (es && n === 10 && share((l) => l.syllables === 8) >= 0.8 && /^ABBAACCDDC$/.test(scheme)) return "Décima espinela (abbaaccddc)";
  if (es && n >= 8 && share((l) => near(l.syllables, 8, 0)) >= 0.75) {
    const even = lines.filter((_, k) => k % 2 === 1), odd = lines.filter((_, k) => k % 2 === 0);
    const asson = even[0]?.assonance;
    if (asson && even.every((l) => l.assonance === asson) && odd.every((l) => l.assonance !== asson)) return `Romance (octosílabos, asonancia ${asson} en los pares)`;
  }
  const sizes = new Set<number>();
  for (let s = 0; s < stanzas; s++) sizes.add(lines.filter((l) => l.stanza === s).length);
  if (stanzas > 1 && sizes.size === 1) {
    const size = [...sizes][0];
    const names: Record<number, [string, string]> = { 2: ["Pareados", "Couplets"], 3: ["Tercetos", "Tercets"], 4: ["Cuartetas / cuartetos", "Quatrains"], 5: ["Quintillas", "Quintains"], 6: ["Sextillas / sextetos", "Sestets"], 8: ["Octavas", "Octaves"] };
    if (names[size]) return names[size][es ? 0 : 1];
  }
  const iso = lines.length >= 4 && share((l) => l.syllables === lines[0].syllables) >= 0.8;
  if (iso && es) return `Versos isométricos (${METER_ES[lines[0].syllables] ?? lines[0].syllables + " sílabas"})`;
  return es ? "Verso libre" : "Free verse";
}
