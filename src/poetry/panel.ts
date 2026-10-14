import type { PoemAnalysis, VerseLine } from "./metrics";

/* ---------- Poem tab of the writing panel ---------- */

export interface PoemPanelHost {
  jumpToLine(line: number): void;
}

export function renderPoem(el: HTMLElement, p: PoemAnalysis, host: PoemPanelHost): void {
  const es = p.lang === "es";
  const hero = el.createDiv({ cls: "at-hero" });
  hero.createDiv({ cls: "at-hero-num at-poem-form", text: p.form });
  hero.createDiv({ cls: "at-hero-sub", text: es ? "forma estimada" : "estimated form" });
  if (!p.lines.length) {
    el.createDiv({ cls: "at-empty", text: es ? "Escribe algunos versos: cada línea es un verso y una línea en blanco separa las estrofas." : "Write a few lines: each line is a line of verse, and a blank line separates stanzas." });
    return;
  }
  const grid = el.createDiv({ cls: "at-grid" });
  const tile = (label: string, value: string, hint?: string) => {
    const d = grid.createDiv({ cls: "at-tile" });
    d.createDiv({ cls: "at-tile-v", text: value });
    d.createDiv({ cls: "at-tile-l", text: label });
    if (hint) d.setAttr("title", hint);
  };
  tile(es ? "Versos" : "Lines", String(p.lines.length));
  tile(es ? "Estrofas" : "Stanzas", String(p.stanzas));
  tile(es ? "Palabras" : "Words", String(p.words));
  if (p.meter) tile(es ? "Metro más común" : "Most common length", `${p.meter.syllables}`, `${p.meter.name}: ${p.meter.count} / ${p.lines.length}`);

  const sch = el.createDiv({ cls: "at-section" });
  sch.createDiv({ cls: "at-label", text: es ? "Esquema de rima" : "Rhyme scheme" });
  sch.createDiv({ cls: "at-poem-scheme", text: p.scheme.join("  ") });
  sch.createDiv({ cls: "at-hint", text: es
    ? "Mayúsculas: arte mayor (9 sílabas o más); minúsculas: arte menor. ′ = rima asonante. - = verso suelto."
    : "Letters group lines that rhyme; - = an unrhymed line." });

  const sec = el.createDiv({ cls: "at-section" });
  sec.createDiv({ cls: "at-label", text: es ? "Versos" : "Lines" });
  sec.createDiv({ cls: "at-hint", text: es
    ? "Sílabas métricas (con sinalefas y ley del acento final). Son estimaciones: toca un verso para ir a él."
    : "Approximate syllables per line. Tap a line to go to it." });
  const list = sec.createDiv({ cls: "at-poem-lines" });
  let stanza = -1;
  for (const l of p.lines) {
    if (l.stanza !== stanza && stanza >= 0) list.createDiv({ cls: "at-poem-gap" });
    stanza = l.stanza;
    const row = list.createDiv({ cls: "at-poem-line" });
    row.createSpan({ cls: "at-poem-syl", text: String(l.syllables) });
    row.createSpan({ cls: "at-poem-text", text: l.text });
    row.createSpan({ cls: "at-poem-letter", text: l.letter });
    row.setAttr("title", lineTip(l, es));
    row.onclick = () => host.jumpToLine(l.line);
  }
}

function lineTip(l: VerseLine, es: boolean): string {
  if (!l.detail) return `${l.syllables} syllables · rhyme “${l.rhyme}”`;
  const d = l.detail;
  const adj = d.adjust > 0 ? " +1 (aguda)" : d.adjust < 0 ? " −1 (esdrújula)" : " (llana)";
  return es
    ? `${d.raw} sílabas${d.sinalefas ? ` − ${d.sinalefas} sinalefa${d.sinalefas > 1 ? "s" : ""}` : ""}${adj} = ${l.syllables} · rima “-${l.rhyme}”, asonante ${l.assonance}`
    : `${l.syllables} syllables · rhyme “${l.rhyme}”`;
}
