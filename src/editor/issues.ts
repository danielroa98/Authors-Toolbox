import { Decoration, DecorationSet, EditorView } from "@codemirror/view";
import { StateField, StateEffect } from "@codemirror/state";
import type { IssueKind } from "../view/helpers";

/* ======================================================================
   EDITOR DECORATIONS: grammar underlines + "find" highlights
   ====================================================================== */

export interface DocRange { from: number; to: number }
/** One grammar/spelling underline. */
export interface IssueMark extends DocRange { kind: IssueKind; id: string }
/** Ranges to highlight, plus the index of the one to emphasise. */
export interface FindRanges { ranges: DocRange[]; current: number }

interface IssueState { issues: DecorationSet; find: DecorationSet }
interface IssueSpec { issueId?: string }

export const setIssues = StateEffect.define<IssueMark[]>();
export const removeIssue = StateEffect.define<string>();
export const setFind = StateEffect.define<FindRanges>();

/** Decoration specs are untyped in CodeMirror; read our issue id from them safely. */
function issueIdOf(d: Decoration): string | undefined {
  const spec = d.spec as IssueSpec | null;
  return spec ? spec.issueId : undefined;
}

export const issueField = StateField.define<IssueState>({
  create: () => ({ issues: Decoration.none, find: Decoration.none }),
  update(v, tr) {
    let issues = v.issues, find = v.find;
    if (tr.docChanged) {
      issues = issues.map(tr.changes);
      const touched: [number, number][] = [];
      tr.changes.iterChangedRanges((fA, tA, fB, tB) => touched.push([fB, tB]));
      issues = issues.update({ filter: (f, t) => t > f && !touched.some(([a, b]) => a <= t && b >= f) });
      find = Decoration.none;
    }
    for (const e of tr.effects) {
      if (e.is(setIssues)) {
        issues = Decoration.set(e.value.filter((x) => x.to > x.from).map((x) =>
          Decoration.mark({ class: `at-issue at-issue-${x.kind}`, issueId: x.id, attributes: { "data-at-issue": x.id } }).range(x.from, x.to)), true);
      } else if (e.is(removeIssue)) {
        const id = e.value;
        issues = issues.update({ filter: (f, t, d) => issueIdOf(d) !== id });
      } else if (e.is(setFind)) {
        const { ranges, current } = e.value;
        find = Decoration.set(ranges.filter((x) => x.to > x.from).map((x, i) =>
          Decoration.mark({ class: i === current ? "at-find at-find-current" : "at-find" }).range(x.from, x.to)), true);
      }
    }
    return { issues, find };
  },
  provide: (f) => [EditorView.decorations.from(f, (v) => v.issues), EditorView.decorations.from(f, (v) => v.find)],
});

export function issueRange(cm: EditorView, id: string): DocRange | null {
  let res: DocRange | null = null;
  try {
    const st = cm.state.field(issueField, false);
    if (!st) return null;
    st.issues.between(0, cm.state.doc.length, (f, t, d) => { if (issueIdOf(d) === id) { res = { from: f, to: t }; return false; } return undefined; });
  } catch { /* field not installed */ }
  return res;
}
export function issueAt(cm: EditorView, pos: number): (DocRange & { id: string }) | null {
  let res: (DocRange & { id: string }) | null = null;
  try {
    const st = cm.state.field(issueField, false);
    if (!st) return null;
    st.issues.between(pos, pos, (f, t, d) => {
      const id = issueIdOf(d);
      if (f <= pos && t >= pos && id !== undefined) { res = { from: f, to: t, id }; return false; }
      return undefined;
    });
  } catch { /* ignore */ }
  return res;
}
