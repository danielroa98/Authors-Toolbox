import { Modal, Notice, Setting } from "obsidian";
import type { App } from "obsidian";
import type { Run } from "../export/manuscript";
import { safeHref } from "../export/substack";
import type { SubstackPost } from "../export/substack";

/* ======================================================================
   COPY FOR SUBSTACK — title, subtitle and text, each with its own copy button
   (Substack keeps the title and subtitle in fields of their own), and a preview
   of the text as it will paste.
   ====================================================================== */

/** Put rich text (with a plain-text twin) on the clipboard; plain text only where rich text isn't supported. */
export async function copyRich(html: string, text: string): Promise<boolean> {
  const clip = navigator.clipboard;
  if (!clip) return false;
  try {
    if (typeof ClipboardItem !== "undefined" && clip.write) {
      await clip.write([new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([text], { type: "text/plain" }),
      })]);
      return true;
    }
  } catch (e) {
    console.warn("Authors Toolbox: rich copy failed, copying plain text", e);
  }
  try { await clip.writeText(text); return true; } catch { return false; }
}

async function copyPlain(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

export class SubstackModal extends Modal {
  constructor(app: App, private post: SubstackPost, private notes: string[], private poem: boolean) { super(app); }

  onOpen(): void {
    this.modalEl.addClass("at-substack-modal");
    this.titleEl.setText("Copy for Substack");
    const p = this.post;
    const el = this.contentEl;
    el.createDiv({ cls: "at-hint", text: "In a new Substack post, paste each part into its own field." });

    const done = (ok: boolean, what: string) => new Notice(ok ? `${what} copied. Paste it into Substack.` : "Couldn't use the clipboard.");
    new Setting(el).setName("Title").setDesc(p.title)
      .addButton((b) => b.setButtonText("Copy").onClick(async () => done(await copyPlain(p.title), "Title")));
    if (p.subtitle) new Setting(el).setName("Subtitle").setDesc(p.subtitle)
      .addButton((b) => b.setButtonText("Copy").onClick(async () => done(await copyPlain(p.subtitle), "Subtitle")));
    new Setting(el).setName("Text").setDesc(`${p.words.toLocaleString()} words, with italics, bold, headings, links, quotes and dividers.`)
      .addButton((b) => b.setButtonText("Copy text").setCta().onClick(async () => done(await copyRich(p.html, p.text), "Text")));

    const tips = [...this.notes];
    if (this.poem) tips.push("Each stanza pastes as one paragraph with line breaks (like Shift+Enter), so the lines stay together. Check the post's preview on a phone too.");
    for (const t of tips) el.createDiv({ cls: "at-hint at-substack-note", text: t });

    this.renderPreview(el.createDiv({ cls: "at-substack-preview" }));
  }

  onClose(): void { this.contentEl.empty(); }

  private renderPreview(box: HTMLElement): void {
    box.createEl("h1", { text: this.post.title });
    if (this.post.subtitle) box.createEl("p", { cls: "at-substack-subtitle", text: this.post.subtitle });
    for (const b of this.post.blocks) {
      switch (b.kind) {
        case "p": {
          const p = box.createEl("p");
          b.lines.forEach((line, k) => { if (k) p.createEl("br"); runs(p, line); });
          break;
        }
        case "h": runs(box.createEl(`h${b.level}` as keyof HTMLElementTagNameMap), b.runs); break;
        case "quote": { const q = box.createEl("blockquote"); for (const para of b.paras) runs(q.createEl("p"), para); break; }
        case "hr": box.createEl("hr"); break;
      }
    }
  }
}

function runs(el: HTMLElement, rs: Run[]): void {
  for (const r of rs) {
    let host: HTMLElement = el;
    const href = safeHref(r.href);
    if (href) host = host.createEl("a", { attr: { href } });
    if (r.b) host = host.createEl("strong");
    if (r.i) host = host.createEl("em");
    host.appendText(r.text);
  }
}
