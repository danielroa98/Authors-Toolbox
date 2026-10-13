
/* ======================================================================
   HELPERS
   ====================================================================== */

export type LangCode = "auto" | "en-US" | "en-GB" | "es";
export const LANGS: Record<LangCode, string> = { auto: "Auto-detect", "en-US": "English (US)", "en-GB": "English (UK)", es: "Español" };
export type IssueKind = "spelling" | "grammar" | "punctuation" | "style";
export const KIND_LABEL: Record<IssueKind, string> = { spelling: "Spelling", grammar: "Grammar", punctuation: "Punctuation", style: "Style" };

export function isLangCode(v: string): v is LangCode { return Object.prototype.hasOwnProperty.call(LANGS, v); }

/** Normalise a `lang` property / setting value to a concrete language, or null for auto/unknown. */
export function normLang(v: unknown): Exclude<LangCode, "auto"> | null {
  if (v == null || v === "") return null;
  const first: unknown = Array.isArray(v) ? (v as unknown[])[0] : v;
  const s = (typeof first === "string" || typeof first === "number" ? String(first) : "").trim().toLowerCase();
  if (!s || s === "auto") return null;
  if (/^es|span|españ|castell/.test(s)) return "es";
  if (/^en[-_]gb|british|uk$/.test(s)) return "en-GB";
  if (/^en|engl|ingl/.test(s)) return "en-US";
  return null;
}
export const fmtN = (n: number): string => Math.round(n).toLocaleString("en-US");
export function fmtMin(words: number, wpm: number): string {
  const m = words / (wpm || 230);
  if (m < 1) return "< 1 min";
  if (m < 60) return Math.round(m) + " min";
  return Math.floor(m / 60) + " h " + Math.round(m % 60) + " min";
}
export function todayKey(): string { const d = new Date(); const p = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; }
