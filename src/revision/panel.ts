import { goalProgress } from "./modals";
import { draftWhen } from "./store";
import type { Revision } from "./controller";

/* ---------- the Revise tab of the writing panel ---------- */

const fmt = (n: number): string => Math.round(n).toLocaleString();

export function renderRevise(el: HTMLElement, plugin: { revision: Revision }, st: { file: { path: string; basename: string }; text: string }): void {
  const rev = plugin.revision;
  const path = st.file.path;
  const df = rev.cached(path);
  if (!df) { el.createDiv({ cls: "at-empty", text: "Loading drafts…" }); return; }
  const drafts = df.drafts;
  const last = drafts[drafts.length - 1];

  const btns = el.createDiv({ cls: "at-rev-btns" });
  const save = btns.createEl("button", { cls: "mod-cta", text: "Save draft" });
  save.onclick = () => { void rev.saveDraft(rev.file(path)); };
  const open = btns.createEl("button", { text: "Compare…" });
  open.onclick = () => { void rev.open(rev.file(path)); };
  if (!last) {
    open.disabled = true;
    el.createDiv({ cls: "at-hint", text: "Save a draft before you start revising. Afterwards this tab shows what changed since: words added and cut, and rewritten paragraphs. The full comparison, chapter by chapter and with the style, opens with Compare." });
    return;
  }

  // changes since the latest draft that differs from the note
  const base = [...drafts].reverse().find((d) => d.text !== st.text);
  const box = el.createDiv({ cls: "at-rev-since" });
  if (!base) {
    box.createDiv({ cls: "at-label", text: `Since “${last.name}”` });
    box.createDiv({ cls: "at-hint", text: "No changes since this draft." });
  } else {
    const cmp = rev.compareWith(base, st.text);
    const s = cmp.stats;
    box.createDiv({ cls: "at-label", text: `Since “${base.name}” · ${draftWhen(base)}` });
    const row = box.createDiv({ cls: "at-rev-since-row" });
    row.createSpan({ cls: "is-add", text: "+" + fmt(s.added) });
    row.createSpan({ cls: "is-cut", text: "−" + fmt(s.removed) });
    row.createSpan({ text: `${fmt(s.before)} → ${fmt(s.after)} words` });
    const p = s.paras;
    box.createDiv({ cls: "at-hint", text: `Paragraphs: ${p.changed} rewritten · ${p.added} new · ${p.removed} cut · ${p.moved} moved` });
  }

  // goal
  const g = df.goal;
  const from = g ? drafts.find((d) => d.id === g.from) : undefined;
  if (g && from) {
    const now = rev.compareWith(from, st.text).stats.after;
    const pr = goalProgress(g, from.words, now);
    const goal = el.createDiv({ cls: "at-goal" });
    goal.createDiv({ cls: "at-bar" }).createDiv({ cls: "at-bar-fill" + (pr.done >= 1 ? " is-done" : "") }).setCssProps({ "--at-pct": Math.round(pr.done * 100) + "%" });
    const r = goal.createDiv({ cls: "at-goal-row" });
    r.createSpan({ text: `${pr.label} · ${Math.round(pr.done * 100)}%` });
  } else {
    const b = el.createEl("button", { cls: "at-link", text: "Set a revision goal…" });
    b.onclick = () => rev.setGoal(path);
  }

  const marks = rev.marksBase(path);
  const tg = el.createDiv({ cls: "at-rev-marks" });
  const t = tg.createEl("button", { text: marks ? `Hide changes in the editor` : "Show changes in the editor" });
  t.onclick = () => { void rev.toggleMarks(path); };
  if (marks) tg.createDiv({ cls: "at-hint", text: `Margin marks: new, rewritten and cut lines since “${marks}”.` });

  // recent drafts
  const sec = el.createDiv({ cls: "at-section" });
  sec.createDiv({ cls: "at-label", text: `Drafts (${drafts.length})` });
  for (const d of [...drafts].reverse().slice(0, 6)) {
    const row = sec.createDiv({ cls: "at-rev-mini" + (d.auto ? " is-auto" : "") });
    row.createSpan({ cls: "at-rev-mini-name", text: (d.auto ? "◦ " : "") + d.name });
    row.createSpan({ cls: "at-rev-mini-meta", text: `${draftWhen(d)} · ${fmt(d.words)}` });
    row.onclick = () => { void rev.open(rev.file(path), { base: d.id, target: "current" }); };
  }
}
