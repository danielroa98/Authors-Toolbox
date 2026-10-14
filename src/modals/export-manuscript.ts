import { Modal, Notice, Platform, Setting, TFile, TFolder, normalizePath } from "obsidian";
import type { App } from "obsidian";
import type { ExportPreset, ToolboxPrefs } from "../constants";
import { buildDocx } from "../export/docx";
import { buildEpub } from "../export/epub";
import { layoutManuscript, pageMarks } from "../export/layout";
import type { PageLayout } from "../export/layout";
import { labels, roundedWords } from "../export/manuscript";
import type { ExportOptions, Manuscript, SceneBreak } from "../export/manuscript";
import { buildPdf } from "../export/pdf";
import { buildText } from "../export/text";
import { TextPrompt } from "./prompts";

/* ======================================================================
   EXPORT MANUSCRIPT — options on one side, a live page preview on the other.
   The preview draws the exact page layout the PDF is printed from.
   ====================================================================== */

export interface ExportHost {
  prefs: ToolboxPrefs;
  saveSettings(): Promise<void>;
}

/** What is being exported: one note, or a compiled project. */
export interface ExportTarget {
  ms: Manuscript;
  /** Folder whose `Exports` subfolder receives the files. */
  folder: string;
  baseName: string;
  lang: "es" | "en";
  /** Pen name from the note's `pseudonym` property, if any. */
  pseudonym?: string;
  /** Short description for the summary line ("3 stories"). */
  note?: string;
}

const FORMATS: [string, string][] = [["docx", "Word"], ["pdf", "PDF"], ["epub", "EPUB"], ["txt", "Plain text"]];
const MAX_PREVIEW_PAGES = 40;

export class ExportManuscriptModal extends Modal {
  private previewEl!: HTMLElement;
  private summaryEl!: HTMLElement;
  private nameRow!: Setting;
  private contactRow!: Setting;
  private pseudonymRow!: Setting;
  private pseudonym: string;
  private renderTimer = 0;

  constructor(app: App, private host: ExportHost, private target: ExportTarget) {
    super(app);
    this.pseudonym = target.pseudonym?.trim() || host.prefs.exportPseudonym;
  }

  private options(): ExportOptions {
    const s = this.host.prefs;
    return {
      layout: s.exportLayout, font: s.exportFont, spacing: parseFloat(s.exportSpacing) || 2, page: s.exportPage,
      author: s.authorName, contact: s.exportContact, pseudonym: this.pseudonym,
      chapterBreaks: s.exportChapterBreaks, keepJustify: s.exportKeepJustify, sceneBreak: s.exportSceneBreak,
      coverPage: s.exportCoverPage, lang: this.target.lang,
    };
  }

  private formats(): Set<string> {
    return new Set(this.host.prefs.exportFormats.split(",").map((x) => x.trim()).filter(Boolean));
  }

  onOpen(): void {
    this.modalEl.addClass("at-export-modal");
    this.titleEl.setText(this.target.note ? "Export project" : "Export manuscript");
    this.build();
  }

  onClose(): void {
    window.clearTimeout(this.renderTimer);
    this.contentEl.empty();
  }

  private build(): void {
    this.contentEl.empty();
    const wrap = this.contentEl.createDiv({ cls: "at-export" });
    const left = wrap.createDiv({ cls: "at-export-opts" });
    const right = wrap.createDiv({ cls: "at-export-preview" });
    const s = this.host.prefs;
    const changed = () => { void this.host.saveSettings(); this.updateRows(); this.schedulePreview(); };

    // presets
    const names = Object.keys(s.exportPresets).sort((a, b) => a.localeCompare(b));
    const presetRow = new Setting(left).setName("Preset");
    if (names.length) {
      presetRow.addDropdown((d) => {
        d.addOption("", "Choose…");
        for (const n of names) d.addOption(n, n);
        d.onChange((v) => { if (v) this.applyPreset(v); });
      });
      presetRow.addExtraButton((b) => b.setIcon("trash").setTooltip("Delete a preset").onClick(() => this.deletePreset()));
    } else presetRow.setDesc("Save the current options under a name, for example one per contest.");
    presetRow.addExtraButton((b) => b.setIcon("save").setTooltip("Save these options as a preset").onClick(() => this.savePreset()));

    new Setting(left).setName("Layout").addDropdown((d) => d
      .addOptions({ manuscript: "Standard manuscript", contest: "Contest (anonymous)" })
      .setValue(s.exportLayout).onChange((v) => { s.exportLayout = v === "contest" ? "contest" : "manuscript"; changed(); }));
    this.nameRow = new Setting(left).setName("Your name").addText((t) => t.setValue(s.authorName).onChange((v) => { s.authorName = v.trim(); changed(); }));
    this.contactRow = new Setting(left).setName("Contact details").setDesc("One item per line.")
      .addTextArea((t) => t.setValue(s.exportContact).onChange((v) => { s.exportContact = v; changed(); }));
    this.pseudonymRow = new Setting(left).setName("Pseudonym").setDesc("Your name appears nowhere in the files, not even in their properties.")
      .addText((t) => t.setValue(this.pseudonym).onChange((v) => { this.pseudonym = v.trim(); s.exportPseudonym = v.trim(); changed(); }));
    new Setting(left).setName("Font").addDropdown((d) => d
      .addOptions({ times: "Times New Roman", courier: "Courier", arial: "Arial" })
      .setValue(s.exportFont).onChange((v) => { s.exportFont = v === "courier" || v === "arial" ? v : "times"; changed(); }));
    new Setting(left).setName("Line spacing").addDropdown((d) => d
      .addOptions({ "2": "Double", "1.5": "1.5 lines" })
      .setValue(s.exportSpacing).onChange((v) => { s.exportSpacing = v; changed(); }));
    new Setting(left).setName("Page size").addDropdown((d) => d
      .addOptions({ letter: "Letter", a4: "A4" })
      .setValue(s.exportPage).onChange((v) => { s.exportPage = v === "a4" ? "a4" : "letter"; changed(); }));
    new Setting(left).setName("Scene breaks").addDropdown((d) => d
      .addOptions({ "#": "#", "* * *": "* * *", "—": "—", blank: "Blank line" })
      .setValue(s.exportSceneBreak).onChange((v) => { s.exportSceneBreak = (["#", "* * *", "—", "blank"].includes(v) ? v : "#") as SceneBreak; changed(); }));
    new Setting(left).setName("Keep justified paragraphs").setDesc("The contest layout always keeps them.").addToggle((t) => t
      .setValue(s.exportKeepJustify).onChange((v) => { s.exportKeepJustify = v; changed(); }));
    new Setting(left).setName("Cover page").addToggle((t) => t
      .setValue(s.exportCoverPage).onChange((v) => { s.exportCoverPage = v; changed(); }));
    new Setting(left).setName("Chapters on a new page").addToggle((t) => t
      .setValue(s.exportChapterBreaks).onChange((v) => { s.exportChapterBreaks = v; changed(); }));

    const fmtRow = new Setting(left).setName("Formats");
    const box = fmtRow.controlEl.createDiv({ cls: "at-formats" });
    const chosen = this.formats();
    for (const [id, label] of FORMATS) {
      const lab = box.createEl("label", { cls: "at-format" });
      const cb = lab.createEl("input", { type: "checkbox" });
      cb.checked = chosen.has(id);
      lab.appendText(label);
      cb.onchange = () => {
        const f = this.formats();
        if (cb.checked) f.add(id); else f.delete(id);
        s.exportFormats = FORMATS.map(([k]) => k).filter((k) => f.has(k)).join(",");
        void this.host.saveSettings();
      };
    }
    new Setting(left).addButton((b) => b.setButtonText("Export").setCta().onClick(() => { void this.export(); }));

    this.summaryEl = right.createDiv({ cls: "at-export-summary" });
    this.previewEl = right.createDiv({ cls: "at-export-pages" });
    this.updateRows();
    // wait for the modal to have a width before scaling the pages
    window.requestAnimationFrame(() => this.renderPreview());
  }

  /* ---------- presets ---------- */

  private currentPreset(): ExportPreset {
    const s = this.host.prefs;
    return {
      layout: s.exportLayout, font: s.exportFont, spacing: s.exportSpacing, page: s.exportPage, formats: s.exportFormats,
      keepJustify: s.exportKeepJustify, sceneBreak: s.exportSceneBreak, coverPage: s.exportCoverPage, chapterBreaks: s.exportChapterBreaks,
    };
  }

  private applyPreset(name: string): void {
    const p = this.host.prefs.exportPresets[name];
    if (!p) return;
    Object.assign(this.host.prefs, {
      exportLayout: p.layout, exportFont: p.font, exportSpacing: p.spacing, exportPage: p.page, exportFormats: p.formats,
      exportKeepJustify: p.keepJustify, exportSceneBreak: p.sceneBreak, exportCoverPage: p.coverPage, exportChapterBreaks: p.chapterBreaks,
    });
    void this.host.saveSettings();
    this.build();
    new Notice(`Preset “${name}” applied.`);
  }

  private savePreset(): void {
    new TextPrompt(this.app, "Save preset", "", (name) => {
      this.host.prefs.exportPresets[name] = this.currentPreset();
      void this.host.saveSettings();
      this.build();
      new Notice(`Preset “${name}” saved.`);
    }, "Saves layout, font, spacing, page size, scene breaks and formats. Your name and contact details are not saved in presets.").open();
  }

  private deletePreset(): void {
    const names = Object.keys(this.host.prefs.exportPresets);
    if (!names.length) return;
    new TextPrompt(this.app, "Delete preset", names.length === 1 ? names[0] : "", (name) => {
      if (!(name in this.host.prefs.exportPresets)) { new Notice(`No preset called “${name}”.`); return; }
      delete this.host.prefs.exportPresets[name];
      void this.host.saveSettings();
      this.build();
      new Notice(`Preset “${name}” deleted.`);
    }, "Type the name of the preset to delete: " + names.join(", ")).open();
  }

  /* ---------- preview ---------- */

  private updateRows(): void {
    const contest = this.host.prefs.exportLayout === "contest";
    this.nameRow.settingEl.toggleClass("at-hidden", contest);
    this.contactRow.settingEl.toggleClass("at-hidden", contest);
    this.pseudonymRow.settingEl.toggleClass("at-hidden", !contest);
  }

  private schedulePreview(): void {
    window.clearTimeout(this.renderTimer);
    this.renderTimer = window.setTimeout(() => this.renderPreview(), 250);
  }

  private renderPreview(): void {
    const o = this.options();
    const ms = this.target.ms;
    const layout = layoutManuscript(ms, o);
    const L = labels(o.lang);
    const n = layout.pages.length;
    const parts = [ms.title, this.target.note ?? "", `${ms.words.toLocaleString()} ${L.words} (${L.about} ${roundedWords(ms.words).toLocaleString()})`, `${n} ${n === 1 ? "page" : "pages"}`];
    this.summaryEl.setText(parts.filter(Boolean).join(" · "));
    renderPages(this.previewEl, layout, o, ms.title, MAX_PREVIEW_PAGES);
  }

  /* ---------- export ---------- */

  private async export(): Promise<void> {
    const o = this.options();
    const fmts = this.formats();
    if (!fmts.size) { new Notice("Choose at least one format."); return; }
    if (o.layout === "contest" && !o.pseudonym) { new Notice("Add a pseudonym for the contest layout first."); return; }
    const t = this.target;
    const dir = t.folder && t.folder !== "/" ? t.folder + "/" : "";
    const folder = normalizePath(`${dir}Exports`);
    const base = t.baseName + (o.layout === "contest" ? ` (${o.lang === "es" ? "concurso" : "contest"})` : "");
    const written: string[] = [];
    try {
      if (!(this.app.vault.getAbstractFileByPath(folder) instanceof TFolder)) await this.app.vault.createFolder(folder);
      const save = async (ext: string, data: Uint8Array) => {
        const path = normalizePath(`${folder}/${base}.${ext}`);
        const buf = data.slice().buffer;
        const existing = this.app.vault.getAbstractFileByPath(path);
        if (existing instanceof TFile) await this.app.vault.modifyBinary(existing, buf);
        else await this.app.vault.createBinary(path, buf);
        written.push(path);
      };
      if (fmts.has("docx")) await save("docx", buildDocx(t.ms, o));
      if (fmts.has("pdf")) await save("pdf", buildPdf(layoutManuscript(t.ms, o), o, t.ms.title));
      if (fmts.has("epub")) await save("epub", buildEpub(t.ms, o));
      if (fmts.has("txt")) await save("txt", new TextEncoder().encode(buildText(t.ms, o)));
    } catch (e) {
      console.error("Authors Toolbox:", e);
      new Notice("Couldn't export: " + (e instanceof Error ? e.message : String(e)));
      return;
    }
    this.close();
    new Notice(`Exported to ${written.join(", ")}.`, 8000);
    // open the PDF in Obsidian so it can be checked or shared right away
    const pdf = written.find((p) => p.endsWith(".pdf"));
    const f = pdf ? this.app.vault.getAbstractFileByPath(pdf) : null;
    if (f instanceof TFile && !Platform.isPhone) await this.app.workspace.getLeaf("tab").openFile(f);
  }
}

/** Draw pages of a layout as scaled-down sheets. */
export function renderPages(el: HTMLElement, layout: PageLayout, o: ExportOptions, title: string, max: number): void {
  el.empty();
  const width = el.clientWidth || 320;
  const scale = Math.min(1, (width - 8) / layout.width);
  layout.pages.slice(0, max).forEach((p, idx) => {
    const sheet = el.createDiv({ cls: "at-pv-sheet" });
    sheet.setCssProps({ "--at-pw": `${layout.width * scale}px`, "--at-ph": `${layout.height * scale}px` });
    const page = sheet.createDiv({ cls: `at-pv-page at-pv-${o.font}` });
    page.setCssProps({ "--at-pw": `${layout.width}px`, "--at-ph": `${layout.height}px`, "--at-scale": String(scale), "--at-size": `${layout.size}px` });
    for (const line of p.lines) {
      for (const seg of line.segments) {
        const span = page.createSpan({ cls: `at-pv-t at-pv-${seg.font}`, text: seg.text });
        span.setCssProps({ "--at-x": `${seg.x}px`, "--at-y": `${line.y}px`, "--at-ws": `${line.wordSpace}px` });
      }
    }
    const mark = pageMarks(o, title, idx + 1, layout);
    if (mark) page.createSpan({ cls: "at-pv-t at-pv-r", text: mark.text }).setCssProps({ "--at-x": `${mark.x}px`, "--at-y": `${mark.y}px`, "--at-ws": "0px" });
  });
  if (layout.pages.length > max) el.createDiv({ cls: "at-hint", text: `Preview shows the first ${max} of ${layout.pages.length} pages.` });
}
