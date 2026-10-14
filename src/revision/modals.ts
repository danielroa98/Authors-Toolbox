import { App, Modal } from "obsidian";
import type { Draft, RevisionGoal } from "./store";

/* ---------- name and note of a draft ---------- */

export class DraftModal extends Modal {
  constructor(app: App, private readonly opts: { title: string; name: string; note?: string; action: string; hint?: string; onDone: (name: string, note: string) => void }) { super(app); }

  onOpen(): void {
    this.titleEl.setText(this.opts.title);
    const c = this.contentEl;
    c.addClass("at-draft-modal");
    if (this.opts.hint) c.createDiv({ cls: "setting-item-description", text: this.opts.hint });
    c.createEl("label", { cls: "at-field-label", text: "Name" });
    const name = c.createEl("input", { type: "text", cls: "at-full" });
    name.value = this.opts.name;
    c.createEl("label", { cls: "at-field-label", text: "Note (optional)" });
    const note = c.createEl("textarea", { cls: "at-full at-draft-note", attr: { rows: "3", placeholder: "What is this draft? Before the editor's notes, sent to the contest…" } });
    note.value = this.opts.note ?? "";
    const row = c.createDiv({ cls: "at-modal-btns" });
    const ok = (): void => { const n = name.value.trim(); if (!n) { name.focus(); return; } this.close(); this.opts.onDone(n, note.value.trim()); };
    row.createEl("button", { text: "Cancel" }).onclick = () => this.close();
    row.createEl("button", { text: this.opts.action, cls: "mod-cta" }).onclick = ok;
    name.addEventListener("keydown", (e) => { if (e.key === "Enter") ok(); });
    window.setTimeout(() => { name.focus(); name.select(); }, 30);
  }

  onClose(): void { this.contentEl.empty(); }
}

/* ---------- yes / no ---------- */

export class ConfirmModal extends Modal {
  constructor(app: App, private readonly opts: { title: string; text: string; action: string; warning?: boolean; onYes: () => void }) { super(app); }

  onOpen(): void {
    this.titleEl.setText(this.opts.title);
    this.contentEl.createEl("p", { text: this.opts.text });
    const row = this.contentEl.createDiv({ cls: "at-modal-btns" });
    row.createEl("button", { text: "Cancel" }).onclick = () => this.close();
    const yes = row.createEl("button", { text: this.opts.action, cls: this.opts.warning ? "mod-warning" : "mod-cta" });
    yes.onclick = () => { this.close(); this.opts.onYes(); };
  }

  onClose(): void { this.contentEl.empty(); }
}

/* ---------- revision goal ---------- */

const when = (d: Draft): string => new Date(d.created).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

export class GoalModal extends Modal {
  constructor(app: App, private readonly opts: { drafts: Draft[]; goal: RevisionGoal | null; onDone: (goal: RevisionGoal | null) => void }) { super(app); }

  onOpen(): void {
    this.titleEl.setText("Revision goal");
    const c = this.contentEl;
    c.createDiv({ cls: "setting-item-description", text: "Measured from a draft, for example: cut 10% of the words, or bring the story to 5,000 words." });
    const g = this.opts.goal;
    c.createEl("label", { cls: "at-field-label", text: "Goal" });
    const row = c.createDiv({ cls: "at-goal-inputs" });
    const kind = row.createEl("select", { cls: "dropdown" });
    kind.createEl("option", { value: "cut", text: "Cut this percent of the words" });
    kind.createEl("option", { value: "words", text: "Reach this many words" });
    kind.value = g?.kind ?? "cut";
    const value = row.createEl("input", { type: "number", attr: { min: "1", inputmode: "numeric" } });
    value.value = String(g?.value ?? 10);
    c.createEl("label", { cls: "at-field-label", text: "Measured from" });
    const from = c.createEl("select", { cls: "dropdown at-full" });
    for (const d of [...this.opts.drafts].reverse()) from.createEl("option", { value: d.id, text: `${d.name} · ${when(d)} · ${d.words.toLocaleString()} words` });
    from.value = g && this.opts.drafts.some((d) => d.id === g.from) ? g.from : this.opts.drafts[this.opts.drafts.length - 1]?.id ?? "";
    const btns = c.createDiv({ cls: "at-modal-btns" });
    if (g) btns.createEl("button", { text: "Remove goal" }).onclick = () => { this.close(); this.opts.onDone(null); };
    btns.createEl("button", { text: "Cancel" }).onclick = () => this.close();
    btns.createEl("button", { text: "Save", cls: "mod-cta" }).onclick = () => {
      const v = parseFloat(value.value);
      if (!(v > 0) || (kind.value === "cut" && v >= 100) || !from.value) { value.focus(); return; }
      this.close();
      this.opts.onDone({ kind: kind.value === "words" ? "words" : "cut", value: v, from: from.value });
    };
  }

  onClose(): void { this.contentEl.empty(); }
}

/** Words the goal aims at, and how far along the note is (0–1). */
export function goalProgress(goal: RevisionGoal, baseWords: number, now: number): { target: number; done: number; label: string } {
  const target = goal.kind === "cut" ? Math.round(baseWords * (1 - goal.value / 100)) : Math.round(goal.value);
  const span = target - baseWords;
  const done = span === 0 ? 1 : Math.max(0, Math.min(1, (now - baseWords) / span));
  const label = goal.kind === "cut" ? `Cut ${goal.value}%: ${baseWords.toLocaleString()} → ${target.toLocaleString()} words` : `Reach ${target.toLocaleString()} words (from ${baseWords.toLocaleString()})`;
  return { target, done, label };
}
