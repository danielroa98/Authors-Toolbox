import { StateEffect, StateField, RangeSetBuilder } from "@codemirror/state";
import type { Extension } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin } from "@codemirror/view";
import type { DecorationSet, ViewUpdate } from "@codemirror/view";
import { lineMarks } from "./diff";

/* ======================================================================
   CHANGES IN THE EDITOR — marks in the margin for lines that are new or
   rewritten since a draft, and for places where text was cut.
   ====================================================================== */

/** The draft the editor is compared with (null: no marks). */
export interface RevisionBase { text: string; label: string }

export const setRevisionBase = StateEffect.define<RevisionBase | null>();

export const revisionBaseField = StateField.define<RevisionBase | null>({
  create: () => null,
  update(value, tr) {
    for (const e of tr.effects) if (e.is(setRevisionBase)) return e.value;
    return value;
  },
});

const ADD = Decoration.line({ class: "at-rev-add", attributes: { title: "New since the draft" } });
const CHG = Decoration.line({ class: "at-rev-chg", attributes: { title: "Rewritten since the draft" } });
const CUT = Decoration.line({ class: "at-rev-cut", attributes: { title: "Text was cut above this line" } });
const CUT_END = Decoration.line({ class: "at-rev-cut-end", attributes: { title: "Text was cut after this line" } });

function build(view: EditorView): DecorationSet {
  const base = view.state.field(revisionBaseField, false);
  if (!base) return Decoration.none;
  const doc = view.state.doc;
  const m = lineMarks(base.text, doc.toString());
  const marks = new Map<number, Decoration>();
  for (const l of m.cutBefore) marks.set(l < doc.lines ? l : doc.lines - 1, l < doc.lines ? CUT : CUT_END);
  for (const l of m.changed) marks.set(l, CHG);
  for (const l of m.added) marks.set(l, ADD);
  const b = new RangeSetBuilder<Decoration>();
  for (const l of [...marks.keys()].sort((x, y) => x - y)) {
    const deco = marks.get(l);
    if (deco && l >= 0 && l < doc.lines) { const line = doc.line(l + 1); b.add(line.from, line.from, deco); }
  }
  return b.finish();
}

const revisionMarks = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) { this.decorations = build(view); }
    update(u: ViewUpdate): void {
      const before = u.startState.field(revisionBaseField, false);
      const after = u.state.field(revisionBaseField, false);
      if (u.docChanged || before !== after) this.decorations = build(u.view);
    }
  },
  { decorations: (v) => v.decorations },
);

const showsMarks = EditorView.editorAttributes.compute([revisionBaseField], (state): Record<string, string> =>
  state.field(revisionBaseField, false) ? { class: "at-rev-on" } : {});

export const revisionExtension: Extension = [revisionBaseField, revisionMarks, showsMarks];
