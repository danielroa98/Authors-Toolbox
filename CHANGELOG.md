# Changelog

## 1.4.3 — 2026-10-13
- Requires Obsidian **1.7.2** or later. The plugin uses APIs added in 1.4.4–1.7.2, and the directory review checks that `minAppVersion` covers them.
- Internal: the plugin's settings object is now `prefs`. Obsidian 1.13 reserves `Plugin.settings`, so the old name clashed with it. Saved settings are unaffected.
- Lint mirrors the directory's type-aware checks (`tsconfig.json`, type-aware rules applied to the JavaScript sources).

## 1.4.2 — 2026-10-13
- Stylesheet cleaned up for the directory's CSS review:
  - No `!important`; overrides now use more specific selectors.
  - Grammar underlines are dotted borders instead of wavy text decoration, which older mobile WebKit only partly supports.
  - Print-only page-break rules were removed.

## 1.4.1 — 2026-10-13
- Display name changed to **Authors Toolbox**: the community directory doesn't allow apostrophes in plugin names. The plugin ID (`authors-toolbox`), settings and features are unchanged.

## 1.4.0 — 2026-10-13
First public release.
- Source split into ES modules and bundled with esbuild; passes Obsidian's official ESLint rules.
- No vault-specific defaults:
  - Uploaded images follow Obsidian's attachment location unless a folder is set.
  - The scripts folder, story folders and author name are settings.
- Styling moved from inline styles to CSS variables, so themes can override it.
- New script notes link to a "Screenplay Format Guide" note only when one exists in the vault.

## 1.3.1
- **Spanish dialogue dash:** in story notes, a `-` typed at the start of a line becomes `—` (no more accidental bullet lists), and `--` becomes `—`.
- New command: *Convert dialogue dashes (- → —) in this note*.

## 1.3.0
- **Screenplay mode (Fountain):**
  - Screenplay layout in the editor and in Reading view.
  - Smart Enter.
  - Suggestions for character names and locations.
  - *Format line as…* commands.
  - Script, Scenes, Cast and Notes tabs in the writing panel.
  - *New script*, *Adapt this story into a script* and *Export as .fountain*.
- Print / PDF styles for scripts.

## 1.2.0
- **Writing panel:** Stats, Outline (drag to reorder chapters and scenes), Style and Check tabs.
- **Spelling and grammar** in English and Spanish via LanguageTool, on demand, with editor underlines and quick fixes.
- Language per note (`lang` property) with auto-detection.

## 1.1.0
- Alignment uses one hidden marker per paragraph, so it works in Reading view and no longer groups paragraphs together.

## 1.0.0
- Center / right / left / justify selected paragraphs.
- Insert images into a note with width, alignment and caption.
