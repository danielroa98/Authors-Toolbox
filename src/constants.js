// Each aligned paragraph carries a hidden Obsidian comment at its start, e.g.  %%center%%Some text
export const MARK = /^(\s{0,3}(?:#{1,6}[ \t]+)?)%%(center|right|left|justify)%%/;
export const MODES = {
  center: { label: "Center", icon: "align-center" },
  right: { label: "Align right", icon: "align-right" },
  left: { label: "Align left", icon: "align-left" },
  justify: { label: "Justify", icon: "align-justify" },
};
export const IMG_EXT = ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "avif"];
export const VIEW_WRITING = "authors-toolbox-writing";
export const DEFAULTS = {
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
};
