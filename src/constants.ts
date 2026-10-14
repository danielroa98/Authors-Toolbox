// Each aligned paragraph carries a hidden Obsidian comment at its start, e.g.  %%center%%Some text
export const MARK = /^(\s{0,3}(?:#{1,6}[ \t]+)?)%%(center|right|left|justify)%%/;

export type AlignMode = "center" | "right" | "left" | "justify";
/** An alignment target; "none" clears the marker. */
export type AlignTarget = AlignMode | "none";

export const MODES: Record<AlignMode, { label: string; icon: string }> = {
  center: { label: "Center", icon: "align-center" },
  right: { label: "Align right", icon: "align-right" },
  left: { label: "Align left", icon: "align-left" },
  justify: { label: "Justify", icon: "align-justify" },
};
export const IMG_EXT = ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "avif"];
export const VIEW_WRITING = "authors-toolbox-writing";

export type ImageAlign = "none" | "center" | "left" | "right";
export type CheckScope = "selection" | "section" | "note";

/** Words written in one note on one day: s = count at the start of the day, l = latest count. */
export interface DailyEntry { s: number; l: number }
/** daily[YYYY-MM-DD][notePath] */
export type DailyLog = Record<string, Record<string, DailyEntry>>;

/** A saved set of export options. Never holds names or contact details. */
export interface ExportPreset {
  layout: "manuscript" | "contest";
  font: "times" | "courier" | "arial";
  spacing: string;
  page: "letter" | "a4";
  formats: string;
  keepJustify: boolean;
  sceneBreak: "#" | "* * *" | "—" | "blank";
  coverPage: boolean;
  chapterBreaks: boolean;
}

export interface ToolboxPrefs {
  imageFolder: string;
  defaultWidth: number;
  defaultAlign: ImageAlign;
  // writing panel
  panelTab: string;
  panelAutoOpened: boolean;
  defaultLang: string;
  readingWpm: number;
  speakingWpm: number;
  longSentence: number;
  echoWindow: number;
  crutchEn: string;
  crutchEs: string;
  defaultGoal: number;
  daily: DailyLog;
  // grammar
  ltConsent: boolean;
  ltServer: string;
  ltUser: string;
  ltKey: string;
  ltPicky: boolean;
  ltDictionary: string;
  ltDisabledRules: string;
  checkScope: CheckScope;
  // screenplay
  panelTabScript: string;
  scriptsFolder: string;
  smartEnter: boolean;
  authorName: string;
  // stories
  autoRaya: boolean;
  storyFolders: string;
  // manuscript export
  exportLayout: "manuscript" | "contest";
  /** Comma-separated: docx, pdf, epub, txt */
  exportFormats: string;
  exportKeepJustify: boolean;
  exportSceneBreak: "#" | "* * *" | "—" | "blank";
  exportCoverPage: boolean;
  exportPresets: Record<string, ExportPreset>;
  /** Count every line as a paragraph in the statistics. */
  linesAsParagraphs: boolean;
  exportFont: "times" | "courier" | "arial";
  exportSpacing: string;
  exportPage: "letter" | "a4";
  exportContact: string;
  exportPseudonym: string;
  exportChapterBreaks: boolean;
}

export const DEFAULTS: ToolboxPrefs = {
  imageFolder: "", defaultWidth: 400, defaultAlign: "center",
  // writing panel
  panelTab: "overview", panelAutoOpened: false, defaultLang: "auto", readingWpm: 230, speakingWpm: 150,
  longSentence: 35, echoWindow: 40, crutchEn: "", crutchEs: "", defaultGoal: 0,
  daily: {},
  // grammar
  ltConsent: false, ltServer: "https://api.languagetool.org", ltUser: "", ltKey: "", ltPicky: false,
  ltDictionary: "", ltDisabledRules: "WHITESPACE_RULE", checkScope: "section",
  // screenplay
  panelTabScript: "sp-stats", scriptsFolder: "Scripts", smartEnter: true, authorName: "",
  // stories
  autoRaya: true, storyFolders: "",
  // manuscript export
  exportLayout: "manuscript", exportFormats: "docx,pdf", exportKeepJustify: false, exportSceneBreak: "#", exportCoverPage: false,
  exportPresets: {}, linesAsParagraphs: false, exportFont: "times", exportSpacing: "2", exportPage: "letter",
  exportContact: "", exportPseudonym: "", exportChapterBreaks: false,
};
