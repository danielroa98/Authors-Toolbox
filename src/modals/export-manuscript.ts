import { Modal, Notice, Platform, Setting, TFile, TFolder, normalizePath } from "obsidian";
import type { App } from "obsidian";
import type { ToolboxPrefs } from "../constants";
import { buildDocx } from "../export/docx";
import { layoutManuscript, pageMarks } from "../export/layout";
import type { PageLayout } from "../export/layout";
import { buildManuscript, labels, roundedWords } from "../export/manuscript";
import type { ExportOptions, Manuscript } from "../export/manuscript";
import { buildPdf } from "../export/pdf";

/* ======================================================================
   EXPORT MANUSCRIPT — options on one side, a live page preview on the other.
   The preview draws the exact page layout the PDF is printed from.
   ====================================================================== */

export interface ExportHost {
  prefs: ToolboxPrefs;
  saveSettings(): Promise<void>;
}

const MAX_PREVIEW_PAGES = 40;

export class ExportManuscriptModal extends Modal {
  private ms: Manuscript;
  private previewEl!: HTMLElement;
  private summaryEl!: HTMLElement;
  private nameRow!: Setting;
  private contactRow!: Setting;
  private pseudonymRow!: Setting;
  private pseudonym: string;
  private renderTimer = 0;

  constructor(app: App, private host: ExportHost, private file: TFile, text: string, private lang: "es" | "en", fm: Record<string, unknown>) {
    super(app);
    const s = host.prefs;
    const fmTitle = typeof fm.title === "string" ? fm.title : undefined;
    this.pseudonym = typeof fm.pseudonym === "string" && fm.pseudonym.trim() ? fm.pseudonym.trim() : s.exportPseudonym;
    this.ms = buildManuscript(text, { fallbackTitle: file.basename, fmTitle, authorNames: [s.authorName] });
  }

  private options(): ExportOptions {
    const s = this.host.prefs;
    return {
      layout: s.exportLayout, font: s.exportFont, spacing: parseFloat(s.exportSpacing) || 2, page: s.exportPage,
      author: s.authorName, contact: s.exportContact, pseudonym: this.pseudonym,
      chapterBreaks: s.exportChapterBreaks, lang: this.lang,
    };
  }

  onOpen(): void {
    this.modalEl.addClass("at-export-modal");
    this.titleEl.setText("Export manuscript");
    const wrap = this.contentEl.createDiv({ cls: "at-export" });
    const left = wrap.createDiv({ cls: "at-export-opts" });
    const right = wrap.createDiv({ cls: "at-export-preview" });
    const s = this.host.prefs;
    const changed = () => { void this.host.saveSettings(); this.updateRows(); this.schedulePreview(); };

    new Setting(left).setName("Layout").addDropdown((d) => d
      .addOptions({ manuscript: "Standard manuscript", contest: "Contest (anonymous)" })
      .setValue(s.exportLayout).onChange((v) => { s.exportLayout = v === "contest" ? "contest" : "manuscript"; changed(); }));
    this.nameRow = new Setting(left).setName("Your name").addText((t) => t.setValue(s.authorName).onChange((v) => { s.authorName = v.trim(); changed(); }));
    this.contactRow = new Setting(left).setName("Contact details").setDesc("One item per line.")
      .addTextArea((t) => t.setValue(s.exportContact).onChange((v) => { s.exportContact = v; changed(); }));
    this.pseudonymRow = new Setting(left).setName("Pseudonym").setDesc("Your name appears nowhere in the file, not even in its properties.")
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
    new Setting(left).setName("Chapters on a new page").addToggle((t) => t
      .setValue(s.exportChapterBreaks).onChange((v) => { s.exportChapterBreaks = v; changed(); }));
    new Setting(left).setName("Format").addDropdown((d) => d
      .addOptions({ both: "Word and PDF", docx: "Word (.docx)", pdf: "PDF" })
      .setValue(s.exportFormat).onChange((v) => { s.exportFormat = v === "docx" || v === "pdf" ? v : "both"; void this.host.saveSettings(); }));
    new Setting(left).addButton((b) => b.setButtonText("Export").setCta().onClick(() => { void this.export(); }));

    this.summaryEl = right.createDiv({ cls: "at-export-summary" });
    this.previewEl = right.createDiv({ cls: "at-export-pages" });
    this.updateRows();
    // wait for the modal to have a width before scaling the pages
    window.requestAnimationFrame(() => this.renderPreview());
  }

  onClose(): void {
    window.clearTimeout(this.renderTimer);
    this.contentEl.empty();
  }

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
    const layout = layoutManuscript(this.ms, o);
    const L = labels(o.lang);
    const n = layout.pages.length;
    this.summaryEl.setText(`${this.ms.title} · ${this.ms.words.toLocaleString()} ${L.words} (${L.about} ${roundedWords(this.ms.words).toLocaleString()}) · ${n} ${n === 1 ? "page" : "pages"}`);
    renderPages(this.previewEl, layout, o, this.ms.title, MAX_PREVIEW_PAGES);
  }

  private async export(): Promise<void> {
    const o = this.options();
    const fmt = this.host.prefs.exportFormat;
    if (o.layout === "contest" && !o.pseudonym) { new Notice("Add a pseudonym for the contest layout first."); return; }
    const dir = this.file.parent && this.file.parent.path !== "/" ? this.file.parent.path + "/" : "";
    const folder = normalizePath(`${dir}Exports`);
    const base = this.file.basename + (o.layout === "contest" ? ` (${o.lang === "es" ? "concurso" : "contest"})` : "");
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
      if (fmt !== "pdf") await save("docx", buildDocx(this.ms, o));
      if (fmt !== "docx") await save("pdf", buildPdf(layoutManuscript(this.ms, o), o, this.ms.title));
    } catch (e) {
      console.error("Authors Toolbox:", e);
      new Notice("Couldn't export: " + (e instanceof Error ? e.message : String(e)));
      return;
    }
    this.close();
    new Notice(`Exported to ${written.join(" and ")}.`, 8000);
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
