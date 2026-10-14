import { ItemView, setIcon } from "obsidian";
import type { ViewStateResult, WorkspaceLeaf } from "obsidian";
import type { Analysis } from "../text/analysis";
import type { Comparison, Para, ParaOp, SectionRow } from "./diff";
import { compareTexts } from "./diff";
import { goalProgress } from "./modals";
import { draftWhen } from "./store";
import type { Draft, DraftFile } from "./store";
import type AuthorsToolbox from "../main";

/* ======================================================================
   REVISION VIEW — compare two versions of a note: summary, goal, chapters,
   style, the text with its changes, and the history of drafts.
   ====================================================================== */

export const VIEW_REVISION = "authors-toolbox-revision";

export interface RevisionViewState {
  path: string;
  /** Draft id of the older version. */
  base?: string;
  /** "current" (the note now) or a draft id. */
  target?: string;
}

const fmt = (n: number): string => Math.round(n).toLocaleString();
const signed = (n: number): string => (n > 0 ? "+" : n < 0 ? "−" : "±") + fmt(Math.abs(n));
const pct = (x: number): string => Math.round(x * 100) + "%";

/** How many untouched paragraphs to show around each change in "changes only" mode. */
const CONTEXT = 1;

export class RevisionView extends ItemView {
  path = "";
  private base = "";
  private target = "current";
  private df: DraftFile | null = null;
  private current: string | null = null;
  private cmp: Comparison | null = null;
  private styles: [Analysis, Analysis] | null = null;

  constructor(leaf: WorkspaceLeaf, private readonly plugin: AuthorsToolbox) { super(leaf); }
  getViewType(): string { return VIEW_REVISION; }
  getDisplayText(): string { return "Revision" + (this.path ? ": " + (this.path.split("/").pop() ?? "").replace(/\.md$/, "") : ""); }
  getIcon(): string { return "git-compare"; }

  override getState(): Record<string, unknown> { return { path: this.path, base: this.base, target: this.target }; }

  override async setState(state: unknown, result: ViewStateResult): Promise<void> {
    const s = (state ?? {}) as Partial<RevisionViewState>;
    if (typeof s.path === "string" && s.path !== this.path) { this.path = s.path; this.base = ""; this.target = "current"; }
    if (typeof s.base === "string" && s.base) this.base = s.base;
    if (typeof s.target === "string" && s.target) this.target = s.target;
    await super.setState(state, result);
    await this.reload();
  }

  async onOpen(): Promise<void> {
    this.contentEl.addClass("at-rev");
    this.render();
  }

  async onClose(): Promise<void> { this.contentEl.empty(); await Promise.resolve(); }

  private get rev() { return this.plugin.revision; }

  /** Read the drafts and the note again, then compare. */
  async reload(): Promise<void> {
    if (!this.path) { this.render(); return; }
    this.df = await this.rev.store.load(this.path);
    this.current = await this.rev.text(this.path);
    const drafts = this.df.drafts;
    if (!drafts.some((d) => d.id === this.base)) {
      // default: the latest draft that differs from what it is compared with
      const tgt = this.targetText();
      const pick = [...drafts].reverse().find((d) => d.text !== tgt) ?? drafts[drafts.length - 1];
      this.base = pick?.id ?? "";
    }
    if (this.target !== "current" && !drafts.some((d) => d.id === this.target)) this.target = "current";
    this.compare();
    this.render();
  }

  private draft(id: string): Draft | null { return this.df?.drafts.find((d) => d.id === id) ?? null; }
  private targetText(): string | null { return this.target === "current" ? this.current : this.draft(this.target)?.text ?? null; }

  private compare(): void {
    const b = this.draft(this.base), t = this.targetText();
    if (!b || t === null) { this.cmp = null; this.styles = null; return; }
    this.cmp = compareTexts(b.text, t);
    this.styles = [this.rev.analyze(b.text, this.path), this.rev.analyze(t, this.path)];
  }

  /* ---------- drawing ---------- */

  render(): void {
    const el = this.contentEl;
    const scroll = el.scrollTop;
    el.empty();
    const name = (this.path.split("/").pop() ?? "").replace(/\.md$/, "");
    const head = el.createDiv({ cls: "at-h-head" });
    const h = head.createEl("h2");
    h.createSpan({ text: "Revision · " });
    const link = h.createEl("a", { text: name || "No note", cls: "at-rev-note" });
    link.onclick = () => { void this.rev.openAt(this.path, 0); };
    const actions = head.createDiv({ cls: "at-h-actions" });
    const save = actions.createEl("button", { text: "Save draft", cls: "mod-cta" });
    save.onclick = () => { void this.rev.saveDraft(this.rev.file(this.path)); };
    const refresh = actions.createEl("button", { attr: { "aria-label": "Refresh" } });
    setIcon(refresh, "refresh-cw");
    refresh.onclick = () => { void this.reload(); };

    if (!this.path || !this.df) { el.createDiv({ cls: "at-empty", text: "Open a note and choose Compare drafts." }); return; }
    const drafts = this.df.drafts;
    if (!drafts.length) {
      const empty = el.createDiv({ cls: "at-rev-empty" });
      empty.createEl("p", { text: "No drafts of this note yet." });
      empty.createEl("p", { cls: "at-hint", text: "Save a draft before you start revising. Then this page shows what you changed since: words added and cut, rewritten and moved paragraphs, chapter by chapter, and how the style changed. A draft is also kept automatically the first time you open a writing note each day." });
      return;
    }

    this.renderPicker(el, drafts);
    const cmp = this.cmp;
    if (cmp && this.styles) {
      this.renderSummary(el, cmp);
      this.renderGoal(el);
      this.renderSections(el, cmp.sections);
      this.renderStyle(el, this.styles[0], this.styles[1]);
      this.renderText(el, cmp);
    }
    this.renderHistory(el, drafts);
    el.scrollTop = scroll;
  }

  private renderPicker(el: HTMLElement, drafts: Draft[]): void {
    const bar = el.createDiv({ cls: "at-rev-picker" });
    const label = (d: Draft) => `${d.auto ? "◦ " : ""}${d.name} · ${draftWhen(d)} · ${fmt(d.words)} words`;
    const from = bar.createEl("select", { cls: "dropdown", attr: { "aria-label": "Older version" } });
    for (const d of [...drafts].reverse()) from.createEl("option", { value: d.id, text: label(d) });
    from.value = this.base;
    from.onchange = () => { this.base = from.value; this.compare(); this.render(); };
    const arrow = bar.createSpan({ cls: "at-rev-arrow" });
    setIcon(arrow, "arrow-right");
    const to = bar.createEl("select", { cls: "dropdown", attr: { "aria-label": "Newer version" } });
    to.createEl("option", { value: "current", text: "The note now" });
    for (const d of [...drafts].reverse()) to.createEl("option", { value: d.id, text: label(d) });
    to.value = this.target;
    to.onchange = () => { this.target = to.value; this.compare(); this.render(); };
    const tools = bar.createDiv({ cls: "at-rev-tools" });
    const marks = tools.createEl("button", { text: this.rev.marksBase(this.path) ? "Hide marks in editor" : "Show in editor" });
    marks.title = "Mark new, rewritten and cut lines in the margin of the editor";
    marks.onclick = () => { void this.rev.toggleMarks(this.path, this.rev.marksBase(this.path) ? undefined : this.base).then(() => this.render()); };
    const word = tools.createEl("button", { text: "Export with tracked changes" });
    word.title = "A manuscript (.docx) where the changes since the older version are tracked changes an editor can accept or reject";
    word.onclick = () => { void this.rev.exportTracked(this.path, this.base); };
    if (this.target !== "current") word.disabled = true;
  }

  private renderSummary(el: HTMLElement, cmp: Comparison): void {
    const s = cmp.stats;
    const tiles = el.createDiv({ cls: "at-grid at-rev-tiles" });
    const tile = (v: string, l: string, cls = "", tip = ""): void => {
      const t = tiles.createDiv({ cls: "at-tile " + cls });
      t.createDiv({ cls: "at-tile-v", text: v });
      t.createDiv({ cls: "at-tile-l", text: l });
      if (tip) t.title = tip;
    };
    tile(`${fmt(s.before)} → ${fmt(s.after)}`, `words (${signed(s.after - s.before)})`);
    tile("+" + fmt(s.added), "words added", "is-add");
    tile("−" + fmt(s.removed), "words cut", "is-cut");
    tile(pct(s.changed), "of the text changed", "", "Words added and cut, over the words of both versions");
    const p = s.paras;
    tile(`${p.changed} rewritten · ${p.added} new`, `paragraphs · ${p.removed} cut · ${p.moved} moved`);
    if (s.added + s.removed + s.moved === 0) el.createDiv({ cls: "at-hint", text: "No changes between these two versions." });
  }

  private renderGoal(el: HTMLElement): void {
    const g = this.df?.goal;
    const box = el.createDiv({ cls: "at-rev-goal" });
    if (!g) {
      const b = box.createEl("button", { cls: "at-link", text: "Set a revision goal…" });
      b.onclick = () => this.rev.setGoal(this.path);
      return;
    }
    const from = this.draft(g.from);
    const now = this.target === "current" ? this.cmp?.stats.after ?? 0 : this.draft(this.target)?.words ?? 0;
    if (!from) return;
    const pr = goalProgress(g, from.words, now);
    const row = box.createDiv({ cls: "at-goal-row" });
    row.createSpan({ text: `${pr.label} · now ${fmt(now)} (${Math.round(pr.done * 100)}%)` });
    const edit = row.createEl("button", { cls: "at-link", text: "Edit" });
    edit.onclick = () => this.rev.setGoal(this.path);
    box.createDiv({ cls: "at-bar" }).createDiv({ cls: "at-bar-fill" + (pr.done >= 1 ? " is-done" : "") }).setCssProps({ "--at-pct": Math.round(pr.done * 100) + "%" });
  }

  private renderSections(el: HTMLElement, rows: SectionRow[]): void {
    const shown = rows.filter((r) => r.before || r.after || r.added || r.removed);
    if (shown.length < 2) return;
    const sec = el.createDiv({ cls: "at-section" });
    sec.createEl("h4", { text: "Chapters and sections" });
    const t = sec.createDiv({ cls: "at-rev-table at-rev-sections" });
    const head = t.createDiv({ cls: "at-rev-tr at-rev-th" });
    for (const c of ["Section", "Before", "After", "Added", "Cut", ""]) head.createDiv({ text: c });
    const max = Math.max(1, ...shown.map((r) => Math.max(r.before, r.after)));
    const STATUS: Record<SectionRow["status"], string> = { new: "New", cut: "Cut", rewritten: "Revised", renamed: "Renamed", moved: "Moved", same: "" };
    for (const r of shown) {
      const tr = t.createDiv({ cls: "at-rev-tr is-" + r.status });
      const name = tr.createDiv({ cls: "at-rev-sname" });
      name.setCssProps({ "--at-lvl": String(Math.max(0, r.level - 1)) });
      name.createSpan({ text: r.title || "(Opening)" });
      const bar = name.createDiv({ cls: "at-rev-sbar" });
      bar.createDiv({ cls: "at-rev-sbar-a" }).setCssProps({ "--at-pct": Math.round((r.before / max) * 100) + "%" });
      bar.createDiv({ cls: "at-rev-sbar-b" }).setCssProps({ "--at-pct": Math.round((r.after / max) * 100) + "%" });
      tr.createDiv({ text: fmt(r.before), attr: { "data-label": "Before" } });
      tr.createDiv({ text: fmt(r.after), attr: { "data-label": "After" } });
      tr.createDiv({ cls: "is-add", text: r.added ? "+" + fmt(r.added) : "", attr: { "data-label": "Added" } });
      tr.createDiv({ cls: "is-cut", text: r.removed ? "−" + fmt(r.removed) : "", attr: { "data-label": "Cut" } });
      tr.createDiv({ cls: "at-rev-status", text: STATUS[r.status] });
    }
  }

  private renderStyle(el: HTMLElement, a: Analysis, b: Analysis): void {
    const sec = el.createDiv({ cls: "at-section" });
    sec.createEl("h4", { text: "Style" });
    const per1000 = (n: number, x: Analysis) => (x.words ? (n / x.words) * 1000 : 0);
    const crutch = (x: Analysis) => x.crutch.reduce((n, c) => n + c.hits.length, 0);
    const rows: [string, number, number, (n: number) => string, string][] = [
      ["Words", a.words, b.words, fmt, ""],
      ["Sentences", a.sentences, b.sentences, fmt, ""],
      ["Average sentence (words)", a.avgSentence, b.avgSentence, (n) => n.toFixed(1), ""],
      ["Long sentences", a.longSentences.length, b.longSentences.length, fmt, `Sentences longer than ${a.longThreshold} words`],
      [a.readability?.name ?? "Readability", a.readability?.score ?? 0, b.readability?.score ?? 0, (n) => n.toFixed(0), "Higher is easier to read"],
      ["Dialogue", a.dialogue, b.dialogue, pct, "Share of words in dialogue"],
      ["Adverbs per 1,000 words", per1000(a.adverbCount, a), per1000(b.adverbCount, b), (n) => n.toFixed(1), "Words ending in -ly / -mente"],
      ["Crutch words per 1,000 words", per1000(crutch(a), a), per1000(crutch(b), b), (n) => n.toFixed(1), "From your crutch-word lists in the settings"],
      ["Lexical variety", a.variety, b.variety, pct, "Moving-average type/token ratio. Higher = richer vocabulary."],
    ];
    const t = sec.createDiv({ cls: "at-rev-table at-rev-style" });
    for (const [label, x, y, f, tip] of rows) {
      const tr = t.createDiv({ cls: "at-rev-tr" });
      const l = tr.createDiv({ text: label });
      if (tip) l.title = tip;
      tr.createDiv({ text: f(x) });
      tr.createDiv({ cls: "at-rev-arrow", text: "→" });
      tr.createDiv({ text: f(y) });
      const same = f(x) === f(y);
      tr.createDiv({ cls: "at-rev-delta" + (same ? " is-same" : ""), text: same ? "" : (y > x ? "▲" : "▼") });
    }
  }

  private renderText(el: HTMLElement, cmp: Comparison): void {
    const P = this.plugin, s = P.prefs;
    const sec = el.createDiv({ cls: "at-section" });
    const head = sec.createDiv({ cls: "at-rev-texthead" });
    head.createEl("h4", { text: "Text" });
    const seg = head.createDiv({ cls: "at-seg" });
    for (const [v, l] of [["changes", "Changes only"], ["all", "Whole text"]] as const) {
      const b = seg.createEl("button", { text: l, cls: (s.revisionShow === v ? "is-active" : "") });
      b.onclick = () => { s.revisionShow = v; P.saveSettingsSoon(); this.render(); };
    }
    const legend = sec.createDiv({ cls: "at-rev-legend" });
    legend.createSpan({ cls: "at-ins", text: "added" });
    legend.createSpan({ cls: "at-del", text: "cut" });
    legend.createSpan({ cls: "at-rev-moved-tag", text: "moved" });
    if (this.target === "current") legend.createSpan({ cls: "at-hint", text: "Tap a paragraph to open it in the note." });

    const box = sec.createDiv({ cls: "at-rev-text" });
    const ops = cmp.ops;
    const changed = (o: ParaOp) => o.kind !== "same";
    const keep = new Set<number>();
    if (s.revisionShow === "changes") {
      ops.forEach((o, i) => { if (changed(o)) for (let k = i - CONTEXT; k <= i + CONTEXT; k++) keep.add(k); });
    }
    let skipped = 0;
    const flushSkip = (): void => {
      if (!skipped) return;
      box.createDiv({ cls: "at-rev-skip", text: `… ${skipped} unchanged paragraph${skipped === 1 ? "" : "s"} …` });
      skipped = 0;
    };
    const live = this.target === "current";
    const draftText = this.draft(this.base)?.text ?? "";
    ops.forEach((o, i) => {
      if (s.revisionShow === "changes" && !keep.has(i)) { skipped++; return; }
      flushSkip();
      const para = (p: Para, cls: string): HTMLElement => {
        const d = box.createDiv({ cls: "at-rev-p " + cls + (p.heading ? " is-heading" : "") });
        return d;
      };
      const clickable = (d: HTMLElement, p: Para): void => {
        if (!live) return;
        d.addClass("is-link");
        d.onclick = (e) => { if ((e.target as HTMLElement).closest("button")) return; void this.rev.openAt(this.path, p.line); };
      };
      const restore = (d: HTMLElement, label: string): void => {
        if (!live) return;
        const b = d.createEl("button", { cls: "at-rev-restore", text: label });
        b.onclick = (e) => {
          e.stopPropagation();
          void this.rev.restoreParagraph(this.path, cmp, i, draftText).then((ok) => { if (ok) window.setTimeout(() => { void this.reload(); }, 50); });
        };
      };
      switch (o.kind) {
        case "same": { const p = cmp.b[o.b]; const d = para(p, "is-same"); d.createSpan({ text: p.text }); clickable(d, p); break; }
        case "added": { const p = cmp.b[o.b]; const d = para(p, "is-added"); d.createSpan({ cls: "at-ins", text: p.text }); clickable(d, p); break; }
        case "removed": { const p = cmp.a[o.a]; const d = para(p, "is-removed"); d.createSpan({ cls: "at-del", text: p.text }); restore(d, "Restore"); break; }
        case "changed": {
          const p = cmp.b[o.b]; const d = para(p, "is-changed");
          const t = d.createSpan();
          for (const sg of o.segs) t.createSpan({ cls: sg.op === 1 ? "at-ins" : sg.op === -1 ? "at-del" : "", text: sg.text });
          d.createSpan({ cls: "at-rev-count", text: ` +${o.added} −${o.removed}` });
          clickable(d, p); restore(d, "Undo changes");
          break;
        }
        case "moved": {
          const p = cmp.b[o.b]; const d = para(p, "is-moved");
          d.createSpan({ cls: "at-rev-moved-tag", text: "moved here" });
          d.createSpan({ text: " " + p.text }); clickable(d, p);
          break;
        }
        case "moved-away": {
          const p = cmp.a[o.a];
          const d = para(p, "is-moved-away");
          d.createSpan({ cls: "at-rev-moved-tag", text: "moved" });
          d.createSpan({ text: " " + (p.text.length > 80 ? p.text.slice(0, 80) + "…" : p.text) });
          break;
        }
      }
    });
    flushSkip();
  }

  private renderHistory(el: HTMLElement, drafts: Draft[]): void {
    const sec = el.createDiv({ cls: "at-section" });
    sec.createEl("h4", { text: `Drafts (${drafts.length})` });
    sec.createDiv({ cls: "at-hint", text: "◦ marks drafts kept automatically; they are removed after the number of days set in the settings unless you rename them." });
    const list = sec.createDiv({ cls: "at-rev-history" });
    const items = [...drafts].reverse();
    items.forEach((d, i) => {
      const prev = items[i + 1];
      const row = list.createDiv({ cls: "at-rev-draft" + (d.id === this.base ? " is-base" : "") + (d.auto ? " is-auto" : "") });
      const main = row.createDiv({ cls: "at-rev-draft-main" });
      const title = main.createDiv({ cls: "at-rev-draft-name" });
      title.createSpan({ text: (d.auto ? "◦ " : "") + d.name });
      main.createDiv({ cls: "at-rev-draft-meta", text: `${draftWhen(d)} · ${fmt(d.words)} words${prev ? ` (${signed(d.words - prev.words)})` : ""}` });
      if (d.note) main.createDiv({ cls: "at-rev-draft-note", text: d.note });
      const act = row.createDiv({ cls: "at-rev-draft-actions" });
      const btn = (icon: string, label: string, f: () => void): void => {
        const b = act.createEl("button", { cls: "clickable-icon", attr: { "aria-label": label } });
        setIcon(b, icon);
        b.onclick = f;
      };
      btn("git-compare", "Compare with the note now", () => { this.base = d.id; this.target = "current"; this.compare(); this.render(); this.contentEl.scrollTop = 0; });
      btn("pencil", "Rename or add a note", () => this.rev.editDraft(this.path, d));
      btn("history", "Restore this draft", () => this.rev.restoreDraft(this.path, d));
      btn("copy", "Copy to a new note", () => { void this.rev.copyToNote(this.path, d); });
      btn("trash-2", "Delete", () => this.rev.deleteDraft(this.path, d));
    });
  }
}
