
/* ======================================================================
   HELPERS
   ====================================================================== */

export const LANGS = { auto: "Auto-detect", "en-US": "English (US)", "en-GB": "English (UK)", es: "Español" };
export const KIND_LABEL = { spelling: "Spelling", grammar: "Grammar", punctuation: "Punctuation", style: "Style" };

export function normLang(v) {
  if (v == null || v === "") return null;
  const s = String(Array.isArray(v) ? v[0] : v).trim().toLowerCase();
  if (!s || s === "auto") return null;
  if (/^es|span|españ|castell/.test(s)) return "es";
  if (/^en[-_]gb|british|uk$/.test(s)) return "en-GB";
  if (/^en|engl|ingl/.test(s)) return "en-US";
  return null;
}
export const fmtN = (n) => Math.round(n).toLocaleString("en-US");
export function fmtMin(words, wpm) {
  const m = words / (wpm || 230);
  if (m < 1) return "< 1 min";
  if (m < 60) return Math.round(m) + " min";
  return Math.floor(m / 60) + " h " + Math.round(m % 60) + " min";
}
export function todayKey() { const d = new Date(); const p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; }
