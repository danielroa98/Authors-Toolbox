import { Modal, Setting, Notice } from "obsidian";
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

    contentEl.createDiv({ text: "…or pick an image already in the vault", cls: "setting-item-description" });
    const search = contentEl.createEl("input", { type: "text", placeholder: "Filter by name" });
    search.addClass("at-full");
    this.list = contentEl.createEl("select");
    this.list.size = 7;
    this.list.addClass("at-full");
    const imgs = this.app.vault.getFiles().filter((f) => IMG_EXT.includes(f.extension.toLowerCase()));
    const refill = () => {
      const q = search.value.toLowerCase();
      this.list.empty();
      imgs.filter((f) => f.path.toLowerCase().includes(q)).slice(0, 80)
        .forEach((f) => this.list.createEl("option", { text: f.path, value: f.path }));
    };
    search.oninput = refill; refill();
    this.list.onchange = () => {
      this.file = this.app.vault.getAbstractFileByPath(this.list.value);
      this.upload = null; up.setDesc("No file chosen");
    };

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
