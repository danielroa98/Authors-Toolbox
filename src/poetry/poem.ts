/* ======================================================================
   POEM NOTES — detection (pure functions).
   A note is a poem when its front matter says `type: poem` (or poema / poesía / verse),
   or when `cssclasses` includes `poem`.
   ====================================================================== */

const TYPES = ["poem", "poema", "poesía", "poesia", "verse", "verso"];

/** True when the text's front matter marks it as a poem. */
export function isPoemText(text: string): boolean {
  const m = /^---\n([\s\S]*?)\n---/.exec(text);
  if (!m) return false;
  const fm = m[1];
  const types = TYPES.join("|");
  return new RegExp(`^type:\\s*["']?(\\[\\[)?(${types})(\\]\\])?["']?\\s*$`, "mi").test(fm)
    || new RegExp(`^type:\\s*\\n\\s*-\\s*["']?(${types})["']?\\s*$`, "mi").test(fm)
    || /^cssclass(es)?:.*\bpoem\b/m.test(fm) || /^\s*-\s*["']?poem["']?\s*$/m.test(fm);
}

/** True when front matter from the metadata cache marks a poem. */
export function isPoemFM(fm: Record<string, unknown> | null | undefined): boolean {
  if (!fm) return false;
  const first = (v: unknown): string => (Array.isArray(v) ? first((v as unknown[])[0]) : typeof v === "string" ? v : "");
  const t = first(fm.type).toLowerCase().replace(/\[\[|\]\]/g, "");
  if (TYPES.includes(t)) return true;
  const c = fm.cssclasses ?? fm.cssclass;
  const list = Array.isArray(c) ? (c as unknown[]).map(first) : first(c).split(/[,\s]+/);
  return list.includes("poem");
}
