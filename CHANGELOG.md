# Changelog

## 1.10.0 — 2026-10-16
- **Copy for Substack** (command palette, the note's ⋯ menu or the file explorer): a story or poem ready to paste into a Substack post.
  - **Title** and **subtitle** copied separately, for Substack's own fields (from the first heading and the one under it, or the `title` and `subtitle` properties).
  - The text pastes with paragraphs, italics, bold, **links**, block quotes, section headings (from Heading 2) and **dividers** for scene breaks.
  - **Poems:** one paragraph per stanza with a line break after each line (like Shift+Enter in Substack), and indentation kept.
  - A preview of the post, and a list of what Substack can't receive (images, footnotes, centred text).
- **Manuscript export:** footnote text (`[^1]: …`) is no longer printed as a paragraph, and `<https://…>` links keep their address.

## 1.9.0 — 2026-10-14
- **Revision mode:**
  - **Drafts** of a note: save a named draft with a note, or let the plugin keep one automatically the first time you open a writing note each day.
  - **Compare** any two versions: words added and cut, rewritten, new, cut and moved paragraphs, a chapter-by-chapter table, and style before → after.
  - The text with changes marked word by word. **Restore** a cut paragraph or **undo** a rewrite in one tap.
  - **Draft history:** rename, restore a whole draft (keeping the note's properties), copy to a new note, delete.
  - **Revision goals** ("cut 10%", "reach 5,000 words").
  - **Changes in the editor:** margin marks for new, rewritten and cut lines.
  - **Word file with tracked changes** for your editor.
  - New **Revise** tab in the writing panel.
- **Manuscript export:** a story that opens with a section heading (`## Enero`) no longer turns it into the subtitle.
- Behaviour tests now live in the repository (`npm test`) and run on every push and release.

## 1.8.0 — 2026-10-14
- **Writing habits dashboard** (ribbon flame icon or *Open writing habits*): words per day for 30, 90 or 365 days with a daily goal line, totals for today, the week and the month, writing days, and current and best streaks.
- **Genre tracking:** a `genre` property on each work (or *Set genre of this note…*). The dashboard shows the genre you write most, words written per genre, works and words per genre, and lists untagged works to tag in place. The same breakdown by form (story, poem, screenplay, article) and by project, with project word goals.
- **Writing sprints:** a timer with a word target, a live countdown in the status bar and the writing panel, a summary at the end and a sprint log.
- **Daily goal and streak** in the Stats tab.
- History of words written now covers about 13 months (was 14 days), and survives renaming a note.
- **Fix:** poem lines use a hanging indent that works on every supported Obsidian version (no `text-indent`).

## 1.7.1 — 2026-10-14
- **Poems:** hidden `%% … %%` comments (like the one in the poem template) are no longer shown as lines of verse in Reading view or counted in the Poem tab.

## 1.7.0 — 2026-10-14
- **Poetry mode (first part)** for notes with `type: poem`:
  - Lines and indentation kept in the editor and Reading view, with a hanging indent for long lines.
  - **Poem tab:** syllables per line (Spanish *métrica* with *sinalefa*, *hiato* and the *ley del acento final*; approximate in English), rhyme scheme with consonant and assonant rhyme, and form recognition (sonnet, haiku, décima, romance…).
  - Poems keep their layout when exported.
- **Manuscript export:**
  - New formats: **EPUB 3** and **plain text**.
  - **Project export:** an anthology note or a folder becomes one manuscript, one chapter per note.
  - **Presets**, a **cover page**, a choice of **scene-break symbol**, and **keep justified paragraphs** in the standard layout.
- **Statistics:** optional *Count each line as a paragraph*.
- New: `docs/IMPLEMENTATION_PLAN.md` with the plan for manuscripts and poetry.

## 1.6.1 — 2026-10-14
- **Manuscript export:** the title now sits right under your name and contact details instead of a third of the way down the first page, so the story starts on page 1 without a large empty gap.
- A subtitle that already names you (for example *Un relato escrito por …*) replaces the "by …" line instead of repeating your name, and it's left out of anonymous contest entries.

## 1.6.0 — 2026-10-14
- **Manuscript export to Word (.docx) and PDF**, from the command palette, the note's ⋯ menu or the file explorer.
  - **Standard manuscript** layout: name, contact details, rounded word count, title page block and a *Surname / Title / page* header.
  - **Contest (anonymous)** layout: title and pseudonym only, page numbers at the bottom, and no trace of your name in the file or its properties.
  - Times New Roman, Courier or Arial; double or 1.5 spacing; Letter or A4; chapters on a new page.
  - Italics, bold, headings, scene breaks and alignment are kept; callouts, comments and images are left out.
- **Live preview** of every page in the export window, drawn from the same layout the PDF is printed from.
- Works offline on desktop, iPhone and iPad, with no added dependencies.

## 1.5.2 — 2026-10-14
- **Fix:** dialogue that starts with a raya (—) on its own line is now counted even when the line has no blank line before it (consecutive lines of one Markdown paragraph). Each line is checked separately, so narration after a closing raya ("—Ven. —dijo ella") still doesn't count as dialogue.

## 1.5.1 — 2026-10-13
- **Rewritten in TypeScript (strict mode).** Every value in the plugin now has a real type, which clears the 3,500 or so code warnings from the Obsidian directory review. `npm run build` type-checks before bundling.
- **Searchable settings:** on Obsidian 1.13 and later, every setting appears in the settings search box. Older versions keep the classic settings screen. Both are built from one list, so they always match.
- Settings fall back to sensible values again: a zero or empty reading speed, sentence threshold or repetition window goes back to its default, an empty scripts folder goes back to `Scripts`, and the crutch-word boxes show the built-in lists.
- Clearer wording for several settings and messages (for example *Smart line breaks in scripts*, *English crutch words*, *Spanish crutch words*).

## 1.4.4 — 2026-10-13
- **Privacy:** the plugin no longer lists every file in your vault. **Insert image…** now opens a folder browser that starts in your attachments folder (or the image folder from settings), and you can move up and down folders from there.
- **Privacy:** **Export as .fountain** no longer touches the clipboard. It only saves the file in `Exports/`.

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
