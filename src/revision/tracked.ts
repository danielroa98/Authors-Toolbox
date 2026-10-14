import { buildManuscript, countWords, runsText } from "../export/manuscript";
import type { Block, Change, Manuscript, Run } from "../export/manuscript";
import { diffParas, diffSeq, tokenize } from "./diff";
import type { Para } from "./diff";

/* ======================================================================
   TRACKED CHANGES — a manuscript of the new version in which everything
   added or cut since the draft is marked, for a Word file whose changes an
   editor can accept or reject.
   ====================================================================== */

export interface TrackedOptions { fallbackTitle: string; fmTitle?: string; authorNames: string[]; poem?: boolean }

const runsOf = (b: Block): Run[] | null => ("runs" in b ? b.runs : null);

/** A block as a paragraph for the comparison (headings keep their level, so they only pair with headings). */
function asPara(b: Block, i: number): Para {
  const runs = runsOf(b);
  const text = b.kind === "break" ? "#" : b.kind === "stanza" ? "" : runs ? runs.map((r) => (r.b ? "**" : "") + (r.i ? "_" : "") + r.text).join("") : "";
  const key = b.kind + (b.kind === "verse" ? `:${b.indent}` : "") + ":" + text;
  return { raw: text, text: runs ? runsText(runs) : text, key, line: i, words: runs ? countWords([b]) : 0, heading: b.kind === "heading" ? Math.max(1, b.level) : 0 };
}

function mark(b: Block, change: Change): Block {
  const runs = runsOf(b);
  const flag = change === "ins" ? { ins: true } : { del: true };
  if (runs) return { ...b, change, runs: runs.map((r) => ({ ...r, ...flag })) } as Block;
  return { ...b, change };
}

/** Word-level tracked changes between two versions of a paragraph, keeping bold and italics. */
function trackRuns(oldRuns: Run[], newRuns: Run[]): Run[] {
  const toks = (runs: Run[]): Run[] => runs.flatMap((r) => tokenize(r.text).map((t) => ({ text: t, b: r.b, i: r.i })));
  const A = toks(oldRuns), B = toks(newRuns);
  const key = (r: Run): string => `${r.b ? 1 : 0}${r.i ? 1 : 0}${r.text}`;
  const out: Run[] = [];
  const push = (r: Run): void => {
    const last = out[out.length - 1];
    if (last && !!last.b === !!r.b && !!last.i === !!r.i && !!last.ins === !!r.ins && !!last.del === !!r.del) last.text += r.text;
    else out.push({ ...r });
  };
  const steps = diffSeq(A.map(key), B.map(key)).map((e) => ({ op: e.op, r: e.op === -1 ? A[e.a] : B[e.b] }));
  // a lone space kept between two changes joins the change, so each change reads as one cut and one addition
  for (let i = 1; i < steps.length - 1; i++) {
    if (steps[i].op === 0 && !steps[i].r.text.trim() && steps[i - 1].op !== 0 && steps[i + 1].op !== 0) {
      steps.splice(i, 1, { op: -1, r: steps[i].r }, { op: 1, r: steps[i].r });
      i++;
    }
  }
  let dels: Run[] = [], adds: Run[] = [];
  const flush = (): void => { for (const r of dels) push({ ...r, del: true }); for (const r of adds) push({ ...r, ins: true }); dels = []; adds = []; };
  for (const st of steps) {
    if (st.op === -1) dels.push(st.r);
    else if (st.op === 1) adds.push(st.r);
    else { flush(); push({ ...st.r }); }
  }
  flush();
  // strip false flags so the runs stay small
  return out.map((r) => { const x: Run = { text: r.text }; if (r.b) x.b = true; if (r.i) x.i = true; if (r.ins) x.ins = true; if (r.del) x.del = true; return x; });
}

/** The new version as a manuscript, with the changes since the old version marked. */
export function trackedManuscript(oldText: string, newText: string, opts: TrackedOptions): Manuscript {
  const A = buildManuscript(oldText, opts), B = buildManuscript(newText, opts);
  const ops = diffParas(A.blocks.map(asPara), B.blocks.map(asPara));
  const blocks: Block[] = [];
  for (const o of ops) {
    if (o.kind === "same") blocks.push(B.blocks[o.b]);
    else if (o.kind === "added" || o.kind === "moved") blocks.push(mark(B.blocks[o.b], "ins"));
    else if (o.kind === "removed" || o.kind === "moved-away") blocks.push(mark(A.blocks[o.a], "del"));
    else {
      const nb = B.blocks[o.b], ob = A.blocks[o.a];
      const nr = runsOf(nb), or = runsOf(ob);
      blocks.push(nr && or ? ({ ...nb, runs: trackRuns(or, nr) } as Block) : nb);
    }
  }
  return { title: B.title, subtitle: B.subtitle, blocks, words: B.words };
}
