import { Setting, PluginSettingTab } from "obsidian";
import { DEFAULTS } from "./constants.js";
import { SCRIPTS_FOLDER_DEFAULT } from "./screenplay/editor.js";
import { DEFAULT_CRUTCH } from "./text/analysis.js";
import { LANGS } from "./view/helpers.js";

/* ======================================================================
   SETTINGS
   ====================================================================== */

export class ToolboxSettings extends PluginSettingTab {
  constructor(app, plugin) { super(app, plugin); this.plugin = plugin; }
  display() {
    const { containerEl } = this;
    const P = this.plugin, S = P.prefs;
    const save = async () => { await P.saveSettings(); P.refreshSoon(); };
    containerEl.empty();

    new Setting(containerEl).setName("Images").setHeading();
    new Setting(containerEl).setName("Folder for uploaded images").setDesc("Images chosen from your device are copied here. Leave empty to use Obsidian's attachment location.")
      .addText((t) => t.setValue(S.imageFolder).onChange(async (v) => { S.imageFolder = v.trim(); await save(); }));
    new Setting(containerEl).setName("Default image width (px)")
      .addText((t) => t.setValue(String(S.defaultWidth)).onChange(async (v) => { S.defaultWidth = parseInt(v, 10) || 0; await save(); }));
    new Setting(containerEl).setName("Default image alignment")
      .addDropdown((d) => d.addOptions({ none: "Inline", center: "Centered", left: "Left", right: "Right" })
        .setValue(S.defaultAlign).onChange(async (v) => { S.defaultAlign = v; await save(); }));

    new Setting(containerEl).setName("Writing panel").setHeading();
    new Setting(containerEl).setName("Default language").setDesc("Used when a note has no “lang” property. Auto-detect picks English or Spanish from the text.")
      .addDropdown((d) => d.addOptions(LANGS).setValue(S.defaultLang).onChange(async (v) => { S.defaultLang = v; await save(); }));
    new Setting(containerEl).setName("Default word goal").setDesc("Applies to notes without a “word_goal” property. 0 = none.")
      .addText((t) => t.setValue(String(S.defaultGoal || 0)).onChange(async (v) => { S.defaultGoal = parseInt(v, 10) || 0; await save(); }));
    new Setting(containerEl).setName("Reading speed (words per minute)")
      .addText((t) => t.setValue(String(S.readingWpm)).onChange(async (v) => { S.readingWpm = parseInt(v, 10) || 230; await save(); }));
    new Setting(containerEl).setName("Reading-aloud speed (words per minute)")
      .addText((t) => t.setValue(String(S.speakingWpm)).onChange(async (v) => { S.speakingWpm = parseInt(v, 10) || 150; await save(); }));
    new Setting(containerEl).setName("Long sentence threshold (words)")
      .addText((t) => t.setValue(String(S.longSentence)).onChange(async (v) => { S.longSentence = parseInt(v, 10) || 35; await save(); }));
    new Setting(containerEl).setName("Repetition window (words)").setDesc("Flag a word that appears again within this many words.")
      .addText((t) => t.setValue(String(S.echoWindow)).onChange(async (v) => { S.echoWindow = parseInt(v, 10) || 40; await save(); }));
    new Setting(containerEl).setName("Crutch words — English").setDesc("Comma-separated words or phrases.")
      .addTextArea((t) => t.setPlaceholder(DEFAULT_CRUTCH.en).setValue(S.crutchEn || DEFAULT_CRUTCH.en).onChange(async (v) => { S.crutchEn = v; await save(); }));
    new Setting(containerEl).setName("Crutch words — Español").setDesc("Palabras o frases separadas por comas.")
      .addTextArea((t) => t.setPlaceholder(DEFAULT_CRUTCH.es).setValue(S.crutchEs || DEFAULT_CRUTCH.es).onChange(async (v) => { S.crutchEs = v; await save(); }));

    new Setting(containerEl).setName("Stories").setHeading();
    new Setting(containerEl).setName("Dialogue dash (raya)").setDesc("In story notes, a - typed at the start of a line becomes — (so Obsidian doesn't turn it into a bullet), and -- anywhere becomes —. Undo (Cmd/Ctrl+Z) right after gives you the plain hyphen back.")
      .addToggle((t) => t.setValue(S.autoRaya).onChange(async (v) => { S.autoRaya = v; await save(); }));
    new Setting(containerEl).setName("Story folders").setDesc("Notes in these folders (one per line) — or any note with type: story — count as stories.")
      .addTextArea((t) => t.setValue(S.storyFolders).onChange(async (v) => { S.storyFolders = v; await save(); }));

    new Setting(containerEl).setName("Screenplays").setHeading();
    new Setting(containerEl).setName("Scripts folder").setDesc("Where “New script” and “Adapt this story” create notes.")
      .addText((t) => t.setValue(S.scriptsFolder).onChange(async (v) => { S.scriptsFolder = v.trim() || SCRIPTS_FOLDER_DEFAULT; await save(); }));
    new Setting(containerEl).setName("Author name").setDesc("Written on the title page of new scripts.")
      .addText((t) => t.setValue(S.authorName).onChange(async (v) => { S.authorName = v.trim(); await save(); }));
    new Setting(containerEl).setName("Smart Enter in scripts").setDesc("After a character name or parenthetical, Enter starts the next dialogue line; after dialogue or action it starts a new element (blank line). Shift+Enter always inserts a plain line break. Reload the plugin after changing.")
      .addToggle((t) => t.setValue(S.smartEnter).onChange(async (v) => { S.smartEnter = v; await save(); }));

    new Setting(containerEl).setName("Spelling & grammar").setHeading();
    containerEl.createEl("p", { cls: "setting-item-description", text: "Checks run only when you ask (Check button, command, or right-click → Check spelling & grammar). The text in the chosen scope is sent to the LanguageTool server below. Obsidian's own spellcheck (Settings → Editor → Spellcheck) keeps working alongside — on macOS and iOS it follows your system/keyboard languages." });
    new Setting(containerEl).setName("Allow sending text to LanguageTool")
      .addToggle((t) => t.setValue(S.ltConsent).onChange(async (v) => { S.ltConsent = v; await save(); }));
    new Setting(containerEl).setName("Server").setDesc("Default: https://api.languagetool.org (free). You can point this to your own LanguageTool server.")
      .addText((t) => t.setValue(S.ltServer).onChange(async (v) => { S.ltServer = v.trim() || DEFAULTS.ltServer; await save(); }));
    new Setting(containerEl).setName("Premium username (email)").setDesc("Optional. With a LanguageTool Premium account you get higher limits and more checks.")
      .addText((t) => t.setValue(S.ltUser).onChange(async (v) => { S.ltUser = v.trim(); await save(); }));
    new Setting(containerEl).setName("Premium API key")
      .addText((t) => { t.inputEl.type = "password"; t.setValue(S.ltKey).onChange(async (v) => { S.ltKey = v.trim(); await save(); }); });
    new Setting(containerEl).setName("Picky mode").setDesc("Extra style and punctuation suggestions.")
      .addToggle((t) => t.setValue(S.ltPicky).onChange(async (v) => { S.ltPicky = v; await save(); }));
    new Setting(containerEl).setName("Personal dictionary").setDesc("One word per line (character names, places, invented words). These are never flagged as misspelled.")
      .addTextArea((t) => t.setValue(S.ltDictionary).onChange(async (v) => { S.ltDictionary = v; await save(); }));
    new Setting(containerEl).setName("Turned-off rules").setDesc("LanguageTool rule IDs, comma-separated.")
      .addTextArea((t) => t.setValue(S.ltDisabledRules).onChange(async (v) => { S.ltDisabledRules = v; await save(); }));
  }
}
