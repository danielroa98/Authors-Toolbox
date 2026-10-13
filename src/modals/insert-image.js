import { Modal, Setting, Notice, TFile, TFolder } from "obsidian";
import { IMG_EXT } from "../constants.js";

/* ---------- image modal ---------- */

export class InsertImageModal extends Modal {
  constructor(app, plugin, editor, view) {
    super(app);
    this.plugin = plugin; this.editor = editor; this.view = view;
    this.file = null;       // existing TFile from vault
    this.upload = null;     // File from disk
    this.width = plugin.prefs.defaultWidth;
    this.align = plugin.prefs.defaultAlign;
    this.caption = "";
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("at-modal");
    contentEl.createEl("h3", { text: "Insert image" });

    const up = new Setting(contentEl).setName("From your computer").setDesc("No file chosen");
    const input = createEl("input", { type: "file" });
    input.accept = "image/*";
    input.addClass("at-hidden");
    input.onchange = () => {
      if (input.files && input.files[0]) {
        this.upload = input.files[0]; this.file = null;
        up.setDesc(this.upload.name); this.list.value = "";
      }
    };
    up.addButton((b) => b.setButtonText("Choose file…").onClick(() => input.click()));
    contentEl.appendChild(input);

    // Browse the vault folder by folder (no vault-wide file listing): start in the image folder,
    // or the folder where Obsidian puts this note's attachments.
    contentEl.createDiv({ text: "…or pick an image already in the vault", cls: "setting-item-description" });
    const bar = contentEl.createDiv({ cls: "at-browse-bar" });
    const upBtn = bar.createEl("button", { text: "↑", attr: { "aria-label": "Parent folder" } });
    const where = bar.createSpan({ cls: "at-browse-path" });
    const search = contentEl.createEl("input", { type: "text", placeholder: "Filter this folder" });
    search.addClass("at-full");
    this.list = contentEl.createEl("select");
    this.list.size = 8;
    this.list.addClass("at-full");
    let folder = this.app.vault.getRoot();
    const show = () => {
      where.setText(folder.isRoot() ? "/" : folder.path);
      upBtn.disabled = folder.isRoot();
      const q = search.value.toLowerCase();
      this.list.empty();
      const kids = folder.children.filter((c) => c.name.toLowerCase().includes(q));
      kids.filter((c) => c instanceof TFolder).sort((a, b) => a.name.localeCompare(b.name))
        .forEach((c) => this.list.createEl("option", { text: "📁 " + c.name, value: "d:" + c.path }));
      kids.filter((c) => c instanceof TFile && IMG_EXT.includes(c.extension.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name))
        .forEach((c) => this.list.createEl("option", { text: c.name, value: "f:" + c.path }));
    };
    const go = (f) => { if (f instanceof TFolder) { folder = f; search.value = ""; show(); } };
    upBtn.onclick = () => go(folder.parent);
    search.oninput = show;
    this.list.onchange = () => {
      const v = this.list.value;
      const target = this.app.vault.getAbstractFileByPath(v.slice(2));
      if (v.startsWith("d:")) { go(target); return; }
      this.file = target instanceof TFile ? target : null;
      this.upload = null; up.setDesc("No file chosen");
    };
    show();
    void this.startFolder().then(go);

    new Setting(contentEl).setName("Width (px)").setDesc("Leave empty for original size").addText((t) =>
      t.setValue(String(this.width || "")).onChange((v) => (this.width = parseInt(v, 10) || 0)));
    new Setting(contentEl).setName("Alignment").addDropdown((d) =>
      d.addOptions({ none: "Inline (no wrapper)", center: "Centered", left: "Left", right: "Right" })
        .setValue(this.align).onChange((v) => (this.align = v)));
    new Setting(contentEl).setName("Caption").setDesc("Optional, shown in italics under the image")
      .addText((t) => t.onChange((v) => (this.caption = v)));
    new Setting(contentEl).addButton((b) =>
      b.setButtonText("Insert").setCta().onClick(() => this.insert()));
  }
  /** The image folder from settings, else the folder Obsidian uses for this note's attachments. */
  async startFolder() {
    const byPath = (p) => this.app.vault.getAbstractFileByPath(p);
    if (this.plugin.prefs.imageFolder) {
      const f = byPath(this.plugin.prefs.imageFolder);
      if (f instanceof TFolder) return f;
    }
    try {
      const src = this.view && this.view.file ? this.view.file.path : "";
      const p = await this.app.fileManager.getAvailablePathForAttachment("image.png", src);
      const dir = p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "";
      const f = dir ? byPath(dir) : this.app.vault.getRoot();
      if (f instanceof TFolder) return f;
    } catch { /* fall back to the note's folder */ }
    return this.view && this.view.file ? this.view.file.parent : this.app.vault.getRoot();
  }

  async insert() {
    try {
      let tfile = this.file;
      if (this.upload) tfile = await this.plugin.saveUpload(this.upload, this.view && this.view.file ? this.view.file.path : "");
      if (!tfile) { new Notice("Choose an image first."); return; }
      const src = this.view && this.view.file ? this.view.file.path : "";
      const link = this.app.metadataCache.fileToLinktext(tfile, src);
      const embed = `![[${link}${this.width ? "|" + this.width : ""}]]`;
      const cap = this.caption.trim();
      const ed = this.editor;
      if (this.align === "none" && !cap) {
        ed.replaceSelection(embed);
      } else {
        const tag = this.align !== "none" ? `%%${this.align}%%` : "";
        const lines = [tag + embed];
        if (cap) lines.push("", `${tag}*${cap}*`);
        const ln = ed.getCursor("to").line;
        const cur = ed.getLine(ln);
        const prefix = cur.trim() === "" ? "" : "\n\n";
        ed.replaceRange(prefix + lines.join("\n") + "\n", { line: ln, ch: cur.length });
      }
      this.close();
    } catch (e) {
      console.error(e);
      new Notice("Authors Toolbox: could not insert image — " + e.message);
    }
  }
  onClose() { this.contentEl.empty(); }
}
