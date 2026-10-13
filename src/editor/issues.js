import { Decoration, EditorView } from "@codemirror/view";
import { StateField, StateEffect } from "@codemirror/state";

/* ======================================================================
   EDITOR DECORATIONS: grammar underlines + "find" highlights
   ====================================================================== */

export const setIssues = StateEffect.define();
export const removeIssue = StateEffect.define();
export const setFind = StateEffect.define();

export const issueField = StateField.define({
  create: () => ({ issues: Decoration.none, find: Decoration.none }),
  update(v, tr) {
    let issues = v.issues, find = v.find;
    if (tr.docChanged) {
      issues = issues.map(tr.changes);
      const touched = [];
      tr.changes.iterChangedRanges((fA, tA, fB, tB) => touched.push([fB, tB]));
      issues = issues.update({ filter: (f, t) => t > f && !touched.some(([a, b]) => a <= t && b >= f) });
      find = Decoration.none;
    }
    for (const e of tr.effects) {
      if (e.is(setIssues)) {
        issues = Decoration.set(e.value.filter((x) => x.to > x.from).map((x) =>
          Decoration.mark({ class: `at-issue at-issue-${x.kind}`, issueId: x.id, attributes: { "data-at-issue": x.id } }).range(x.from, x.to)), true);
      } else if (e.is(removeIssue)) {
        issues = issues.update({ filter: (f, t, d) => d.spec.issueId !== e.value });
      } else if (e.is(setFind)) {
        find = Decoration.set(e.value.filter((x) => x.to > x.from).map((x, i) =>
          Decoration.mark({ class: i === e.value.current ? "at-find at-find-current" : "at-find" }).range(x.from, x.to)), true);
      }
    }
    return { issues, find };
  },
  provide: (f) => [EditorView.decorations.from(f, (v) => v.issues), EditorView.decorations.from(f, (v) => v.find)],
});

export function issueRange(cm, id) {
  let res = null;
  try {
    const st = cm.state.field(issueField, false);
    if (!st) return null;
    st.issues.between(0, cm.state.doc.length, (f, t, d) => { if (d.spec.issueId === id) { res = { from: f, to: t }; return false; } });
  } catch { /* field not installed */ }
  return res;
}
export function issueAt(cm, pos) {
  let res = null;
  try {
    const st = cm.state.field(issueField, false);
    if (!st) return null;
    st.issues.between(pos, pos, (f, t, d) => { if (f <= pos && t >= pos) { res = { from: f, to: t, id: d.spec.issueId }; return false; } });
  } catch { /* ignore */ }
  return res;
}
