/* ======================================================================
   GENRES AND FORMS of a work, from its note properties.
   genre: terror            genre: [terror, cuento urbano]            (also genres / género)
   type:  story | poem | script | article | novel | chapter …
   ====================================================================== */

export const NO_GENRE = "No genre";

const GENRE_KEYS = ["genre", "genres", "género", "genero", "géneros", "generos"];

function strings(v: unknown): string[] {
  if (Array.isArray(v)) return (v as unknown[]).flatMap(strings);
  if (typeof v !== "string") return [];
  return v.split(",").map((x) => x.replace(/^\[\[|\]\]$/g, "").replace(/^#/, "").trim()).filter(Boolean);
}

/** Genre names written the same way regardless of case: "terror", "Terror" → "Terror". */
export function normaliseGenre(g: string): string {
  const t = g.trim().replace(/\s+/g, " ");
  return t ? t[0].toLocaleUpperCase() + t.slice(1).toLocaleLowerCase() : t;
}

export function genresOf(fm: Record<string, unknown> | undefined | null): string[] {
  if (!fm) return [];
  const out: string[] = [];
  for (const k of GENRE_KEYS) for (const g of strings(fm[k])) {
    const n = normaliseGenre(g);
    if (n && !out.includes(n)) out.push(n);
  }
  return out;
}

const FORMS: Record<string, string> = {
  story: "Story", relato: "Story", cuento: "Story", novel: "Novel", novela: "Novel", novella: "Novella", chapter: "Chapter",
  poem: "Poem", poema: "Poem", "poesía": "Poem", poesia: "Poem", script: "Screenplay", screenplay: "Screenplay", guion: "Screenplay",
  "guión": "Screenplay", article: "Article", "artículo": "Article", essay: "Essay", ensayo: "Essay",
};

/** The form of a work from its `type` property ("Story", "Poem", "Screenplay", "Article"…). */
export function formOf(fm: Record<string, unknown> | undefined | null): string {
  const t = strings(fm?.type)[0]?.toLowerCase() ?? "";
  if (!t) return "Other";
  return FORMS[t] ?? t[0].toUpperCase() + t.slice(1);
}

/** Projects (anthologies, collections) a work belongs to, from its `anthology` property. */
export function projectsOf(fm: Record<string, unknown> | undefined | null): string[] {
  return strings(fm?.anthology).map((x) => x.split("|")[0].split("#")[0].trim()).filter(Boolean);
}
