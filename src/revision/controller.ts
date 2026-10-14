import { MarkdownView, Notice, TFile, TFolder, normalizePath } from "obsidian";
import type { EditorView } from "@codemirror/view";
import type { Analysis } from "../text/analysis";
import { bodyStart } from "../text/analysis";
import { buildDocx } from "../export/docx";
import type { ExportOptions } from "../export/manuscript";
import { isPoemFM, isPoemText } from "../poetry/poem";
import { dayKey } from "../habits/log";
import { compareTexts, notePars } from "./diff";
import type { Comparison, ParaOp } from "./diff";
import { setRevisionBase, revisionBaseField } from "./editor";
import { ConfirmModal, DraftModal, GoalModal } from "./modals";
import { DraftStore, draftWhen } from "./store";
import type { Draft, DraftFile } from "./store";
import { trackedManuscript } from "./tracked";
import { RevisionView, VIEW_REVISION } from "./view";
import type { RevisionViewState } from "./view";
import type AuthorsToolbox from "../main";

/* ======================================================================
   REVISION MODE — drafts of a note, comparing versions, restoring text,
   marks in the editor and Word files with tracked changes.
   ====================================================================== */

/** Words in a note's body (the same count as the writing panel's). */
export const bodyWords = (text: string): number => notePars(text).reduce((n, p) => n + (p.heading ? 0 : p.words), 0);


export class Revision {
  readonly store: DraftStore;
  /** Drafts of notes, loaded for the writing panel (render is synchronous). */
  private loaded = new Map<string, DraftFile>();
  private loading = new Set<string>();
  /** Notes already checked for today's checkpoint: "YYYY-MM-DD|path". */
  private checked = new Set<string>();
  /** Recent comparisons for the panel: same draft and same text → same result. */
  private memo = new Map<string, { text: string; cmp: Comparison }>();

  constructor(private readonly plugin: AuthorsToolbox) {
    this.store = new DraftStore(plugin.app.vault.adapter, () => plugin.prefs.draftsFolder);
  }

  private get app() { return this.plugin.app; }

  /* ---------- reading notes ---------- */

  file(path: string): TFile | null {
    const f = this.app.vault.getAbstractFileByPath(path);
    return f instanceof TFile ? f : null;
  }

  /** An open editor showing the note, if any. */
  editorOf(path: string): MarkdownView | null {
    if (this.plugin.target?.file?.path === path && this.plugin.target.editor) return this.plugin.target;
    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      const v = leaf.view;
      if (v instanceof MarkdownView && v.file?.path === path) return v;
    }
    return null;
  }

  /** The note's current text: from its editor when open (unsaved typing included), else from the vault. */
  async text(path: string): Promise<string | null> {
    const v = this.editorOf(path);
    if (v?.editor) return v.editor.getValue();
    const f = this.file(path);
    return f ? this.app.vault.read(f) : null;
  }

  /* ---------- drafts for the panel ---------- */

  /** Drafts of a note if loaded (loads them in the background otherwise and re-renders). */
  cached(path: string): DraftFile | null {
    const df = this.loaded.get(path);
    if (df) return df;
    if (!this.loading.has(path)) {
      this.loading.add(path);
      void this.store.load(path).then((d) => { this.loaded.set(path, d); this.loading.delete(path); this.plugin.renderPanels(); });
    }
    return null;
  }

  /** Comparison of `text` with a draft, remembered between renders of the panel. */
  compareWith(d: Draft, text: string): Comparison {
    const hit = this.memo.get(d.id);
    if (hit && hit.text === text) return hit.cmp;
    const cmp = compareTexts(d.text, text);
    if (this.memo.size > 4) this.memo.clear();
    this.memo.set(d.id, { text, cmp });
    return cmp;
  }

  /** After drafts change: reload them for the panel and redraw everything that shows them. */
  private async changed(path: string): Promise<void> {
    this.loaded.set(path, await this.store.load(path));
    this.plugin.renderPanels();
    for (const v of this.views()) if (v.path === path) void v.reload();
  }

  views(): RevisionView[] {
    return this.app.workspace.getLeavesOfType(VIEW_REVISION).map((l) => l.view).filter((v): v is RevisionView => v instanceof RevisionView);
  }

  /** Forget loaded drafts (the drafts folder changed). */
  forget(): void { this.store.clear(); this.loaded.clear(); this.memo.clear(); }

  /* ---------- saving drafts ---------- */

  /** Ask for a name and save the note as a draft. */
  async saveDraft(file?: TFile | null): Promise<void> {
    const f = file ?? this.plugin.target?.file ?? this.app.workspace.getActiveFile();
    if (!f || f.extension !== "md") { new Notice("Open the note you want to keep a draft of first."); return; }
    const drafts = await this.store.list(f.path);
    const named = drafts.filter((d) => !d.auto).length;
    new DraftModal(this.app, {
      title: "Save a draft",
      hint: `A copy of “${f.basename}” as it is now, to compare with or go back to later.`,
      name: `Draft ${named + 1}`,
      action: "Save draft",
      onDone: (name, note) => { void this.addDraft(f.path, name, note); },
    }).open();
  }

  async addDraft(path: string, name: string, note?: string, auto?: boolean): Promise<Draft | null> {
    const text = await this.text(path);
    if (text === null) return null;
    const d = await this.store.add(path, text, bodyWords(text), { name, note, auto });
    if (!auto) new Notice(`Draft saved: ${name}`);
    await this.changed(path);
    return d;
  }

  /**
   * The first time a writing note is shown each day, keep its text as an automatic draft
   * (if it changed since the last draft), and drop automatic drafts older than the setting allows.
   */
  async checkpoint(path: string, text: string): Promise<void> {
    const s = this.plugin.prefs;
    if (!s.autoDrafts || !this.plugin.isWritingPath(path)) return;
    const key = `${dayKey(new Date())}|${path}`;
    if (this.checked.has(key)) return;
    this.checked.add(key);
    const last = await this.store.latest(path);
    if (bodyWords(text) === 0) return;
    if (!last || last.text !== text) {
      await this.store.add(path, text, bodyWords(text), { name: `Start of ${draftWhen(Date.now(), false)}`, auto: true });
    }
    await this.store.pruneAuto(path, Math.max(1, s.autoDraftDays));
    if (this.loaded.has(path) || this.views().some((v) => v.path === path)) await this.changed(path);
  }

  async rename(from: string, to: string): Promise<void> {
    await this.store.rename(from, to);
    this.loaded.delete(from);
    for (const v of this.views()) if (v.path === from) { v.path = to; void v.reload(); }
  }

  /* ---------- editing drafts ---------- */

  editDraft(path: string, d: Draft): void {
    new DraftModal(this.app, {
      title: "Rename draft", name: d.name, note: d.note, action: "Save",
      onDone: (name, note) => { void this.store.update(path, d.id, { name, note, auto: false }).then(() => this.changed(path)); },
    }).open();
  }

  deleteDraft(path: string, d: Draft): void {
    new ConfirmModal(this.app, {
      title: "Delete draft", text: `Delete “${d.name}” (${draftWhen(d)})? This can't be undone.`, action: "Delete", warning: true,
      onYes: () => { void this.store.remove(path, d.id).then(() => this.changed(path)); },
    }).open();
  }

  setGoal(path: string): void {
    void this.store.load(path).then((df) => {
      if (!df.drafts.length) { new Notice("Save a draft first: the goal is measured from one."); return; }
      new GoalModal(this.app, { drafts: df.drafts, goal: df.goal ?? null, onDone: (goal) => { void this.store.setGoal(path, goal).then(() => this.changed(path)); } }).open();
    });
  }

  /** Replace the note's text with a draft's (the current text is kept as a draft first; properties stay as they are now). */
  restoreDraft(path: string, d: Draft): void {
    new ConfirmModal(this.app, {
      title: "Restore draft",
      text: `Replace the text of the note with “${d.name}” (${draftWhen(d)})? The current text is saved as a draft first, and the note keeps its current properties.`,
      action: "Restore",
      onYes: () => { void this.doRestoreDraft(path, d); },
    }).open();
  }

  private async doRestoreDraft(path: string, d: Draft): Promise<void> {
    const cur = await this.text(path);
    if (cur === null) return;
    await this.store.add(path, cur, bodyWords(cur), { name: `Before restoring “${d.name}”` });
    const keepFm = (t: string): string => t.split("\n").slice(0, bodyStart(t.split("\n"))).join("\n");
    const draftBody = d.text.split("\n").slice(bodyStart(d.text.split("\n"))).join("\n");
    const fm = keepFm(cur);
    await this.write(path, (fm ? fm + "\n" : "") + draftBody);
    new Notice(`Restored “${d.name}”.`);
    await this.changed(path);
  }

  /** A new note with the draft's text, next to the original. */
  async copyToNote(path: string, d: Draft): Promise<void> {
    const f = this.file(path);
    const folder = f?.parent?.path && f.parent.path !== "/" ? f.parent.path + "/" : "";
    const base = `${f?.basename ?? "Note"} (${d.name.replace(/[\\/:*?"<>|#^[\]]/g, "-")})`;
    let p = normalizePath(`${folder}${base}.md`), n = 2;
    while (this.app.vault.getAbstractFileByPath(p)) p = normalizePath(`${folder}${base} ${n++}.md`);
    const created = await this.app.vault.create(p, d.text);
    await this.app.workspace.getLeaf("tab").openFile(created);
  }

  /* ---------- changing the note ---------- */

  /** Replace the whole note (in its editor when open, so it can be undone). */
  private async write(path: string, text: string): Promise<void> {
    const v = this.editorOf(path);
    if (v?.editor) {
      const ed = v.editor;
      const last = ed.lastLine();
      ed.replaceRange(text, { line: 0, ch: 0 }, { line: last, ch: ed.getLine(last).length });
      return;
    }
    const f = this.file(path);
    if (f) await this.app.vault.modify(f, text);
  }

  /**
   * Put a draft's version of one paragraph back into the note: a cut paragraph is inserted where it
   * was, a rewritten one replaces its new version. Only if the note still reads as compared.
   */
  async restoreParagraph(path: string, cmp: Comparison, opIndex: number, draftText: string): Promise<boolean> {
    const op = cmp.ops[opIndex];
    const cur = await this.text(path);
    if (cur === null || (op.kind !== "removed" && op.kind !== "changed")) return false;
    const lines = cur.split("\n");
    const oldLines = draftText.split("\n");
    const a = cmp.a[op.a];
    // the cut paragraph with the blank lines that followed it, so the spacing between paragraphs is kept
    let end = a.line + 1;
    while (end < oldLines.length && !oldLines[end].trim()) end++;
    const block = oldLines.slice(a.line, end);
    if (op.kind === "changed") {
      const b = cmp.b[op.b];
      if (lines[b.line] !== b.raw) { new Notice("The note has changed since the comparison. Refresh and try again."); return false; }
      return this.replaceLines(path, b.line, b.line + 1, [a.raw]);
    }
    // insert before the next paragraph that is still in the note
    const next = cmp.ops.slice(opIndex + 1).find((o): o is Extract<ParaOp, { b: number }> => "b" in o && o.kind !== "moved-away");
    if (next) {
      const b = cmp.b[next.b];
      if (lines[b.line] !== b.raw) { new Notice("The note has changed since the comparison. Refresh and try again."); return false; }
      return this.replaceLines(path, b.line, b.line, block);
    }
    const tail = lines.length && lines[lines.length - 1] === "" ? lines.length - 1 : lines.length;
    return this.replaceLines(path, tail, tail, ["", a.raw]);
  }

  /** Replace lines [from, to) of the note with `insert`. */
  private async replaceLines(path: string, from: number, to: number, insert: string[]): Promise<boolean> {
    const v = this.editorOf(path);
    if (v?.editor) {
      const ed = v.editor;
      const last = ed.lastLine();
      if (from > last) ed.replaceRange("\n" + insert.join("\n"), { line: last, ch: ed.getLine(last).length });
      else if (from === to) ed.replaceRange(insert.join("\n") + "\n", { line: from, ch: 0 });
      else ed.replaceRange(insert.join("\n"), { line: from, ch: 0 }, { line: to - 1, ch: ed.getLine(to - 1).length });
      return true;
    }
    const f = this.file(path);
    if (!f) return false;
    await this.app.vault.process(f, (t) => {
      const L = t.split("\n");
      L.splice(from, to - from, ...insert);
      return L.join("\n");
    });
    return true;
  }

  /* ---------- the revision view ---------- */

  async open(file?: TFile | null, state?: Partial<RevisionViewState>): Promise<void> {
    const f = file ?? this.plugin.target?.file ?? this.app.workspace.getActiveFile();
    if (!f || f.extension !== "md") { new Notice("Open the note you are revising first."); return; }
    const ws = this.app.workspace;
    const existing = this.views().find((v) => v.path === f.path);
    const leaf = existing?.leaf ?? ws.getLeaf("tab");
    await leaf.setViewState({ type: VIEW_REVISION, active: true, state: { path: f.path, ...state } });
    await ws.revealLeaf(leaf);
  }

  /** Open the note at a line. */
  async openAt(path: string, line: number): Promise<void> {
    let v = this.editorOf(path);
    if (!v) {
      const f = this.file(path);
      if (!f) return;
      const leaf = this.app.workspace.getLeaf("tab");
      await leaf.openFile(f);
      v = leaf.view instanceof MarkdownView ? leaf.view : null;
    } else {
      this.app.workspace.setActiveLeaf(v.leaf, { focus: true });
    }
    if (!v?.editor) return;
    v.editor.setCursor({ line, ch: 0 });
    v.editor.scrollIntoView({ from: { line, ch: 0 }, to: { line, ch: 0 } }, true);
  }

  /* ---------- marks in the editor ---------- */

  private cm(v: MarkdownView | null): EditorView | null { return this.plugin.cmOf(v); }

  /** The draft the editor of `path` is compared with, if marks are on. */
  marksBase(path: string): string | null {
    const cm = this.cm(this.editorOf(path));
    return cm?.state.field(revisionBaseField, false)?.label ?? null;
  }

  /** Show (or hide) marks for changes since a draft (the latest by default) in the note's editor. */
  async toggleMarks(path?: string, draftId?: string): Promise<void> {
    const p = path ?? this.plugin.target?.file?.path;
    if (!p) { new Notice("Open the note first."); return; }
    const cm = this.cm(this.editorOf(p));
    if (!cm) { new Notice("Open the note in the editor to see its changes."); return; }
    const on = cm.state.field(revisionBaseField, false);
    if (on && !draftId) { cm.dispatch({ effects: setRevisionBase.of(null) }); this.plugin.renderPanels(); return; }
    const d = draftId ? await this.store.get(p, draftId) : await this.store.latest(p);
    if (!d) { new Notice("Save a draft first: the marks show what changed since it."); return; }
    cm.dispatch({ effects: setRevisionBase.of({ text: d.text, label: d.name }) });
    this.plugin.renderPanels();
  }

  /* ---------- Word file with tracked changes ---------- */

  async exportTracked(path: string, draftId?: string): Promise<void> {
    const f = this.file(path);
    const cur = await this.text(path);
    const d = draftId ? await this.store.get(path, draftId) : await this.store.latest(path);
    if (!f || cur === null) return;
    if (!d) { new Notice("Save a draft first: the exported file shows the changes since it."); return; }
    const s = this.plugin.prefs;
    const fm = (this.app.metadataCache.getFileCache(f)?.frontmatter ?? {}) as Record<string, unknown>;
    const ms = trackedManuscript(d.text, cur, { fallbackTitle: f.basename, fmTitle: typeof fm.title === "string" ? fm.title : undefined, authorNames: [s.authorName], poem: isPoemFM(fm) || isPoemText(cur) });
    const o: ExportOptions = {
      layout: "manuscript", font: s.exportFont, spacing: parseFloat(s.exportSpacing) || 2, page: s.exportPage,
      author: s.authorName, contact: s.exportContact, pseudonym: s.exportPseudonym, chapterBreaks: s.exportChapterBreaks,
      keepJustify: s.exportKeepJustify, sceneBreak: s.exportSceneBreak, coverPage: false, lang: this.plugin.langOf(f, cur),
      track: { author: s.authorName.trim() || "Author", date: new Date().toISOString().replace(/\.\d+Z$/, "Z") },
    };
    const dir = f.parent?.path && f.parent.path !== "/" ? f.parent.path + "/" : "";
    const folder = normalizePath(`${dir}Exports`);
    const out = normalizePath(`${folder}/${f.basename} (${o.lang === "es" ? "cambios desde" : "changes since"} ${d.name.replace(/[\\/:*?"<>|#^[\]]/g, "-")}).docx`);
    try {
      if (!(this.app.vault.getAbstractFileByPath(folder) instanceof TFolder)) await this.app.vault.createFolder(folder);
      const buf = buildDocx(ms, o).slice().buffer;
      const existing = this.app.vault.getAbstractFileByPath(out);
      if (existing instanceof TFile) await this.app.vault.modifyBinary(existing, buf); else await this.app.vault.createBinary(out, buf);
      new Notice(`Saved ${out}`);
    } catch (e) {
      console.error("Authors Toolbox:", e);
      new Notice("Couldn't export: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  /* ---------- style ---------- */

  analyze(text: string, path: string): Analysis {
    return this.plugin.analyzeText(text, this.file(path));
  }
}
