# Implementation plan: manuscripts, poetry, habits and revision

How the "Writing and manuscripts" items of the roadmap and poetry mode are built. Each phase ships on its own,
keeps the plugin working on desktop, iPhone and iPad, and adds no runtime dependencies or network use.

Status: ✅ done · 🚧 in progress · ⏳ planned

---

## Architecture

All exports go through one pipeline, so every new format or layout reuses the same parsing and the same rules:

```
story note(s) ──► manuscript model ──► page layout ──► PDF writer
  (Markdown)      export/manuscript.ts  export/layout.ts   export/pdf.ts
                         │                    └──────────► live preview (modals/export-manuscript.ts)
                         ├──► Word writer (export/docx.ts, zip.ts)
                         ├──► EPUB writer (export/epub.ts, zip.ts)
                         └──► plain text  (export/text.ts)
```

- **Manuscript model** (`Manuscript`): title, subtitle, and a list of blocks — paragraphs with styled runs,
  headings, scene breaks, and verse lines for poems. It is pure (no Obsidian APIs) so it can be tested in Node.
- **Options** (`ExportOptions`) hold every layout choice. Saved presets are just named option sets.
- **Projects** (anthologies or folders) are compiled into one `Manuscript` before rendering, so every format
  supports them for free.

---

## Phase 1 — Manuscript options ✅ (1.7.0)

| Item | Where | Done when |
|---|---|---|
| **Keep justified paragraphs** | `ExportOptions.keepJustify`; `layout.ts`, `docx.ts` | `%%justify%%` text is justified in the standard layout when the option is on; contest layout keeps justifying by default. |
| **Scene-break symbol** | `ExportOptions.sceneBreak` (`#`, `* * *`, `—`, blank line) | All writers print the chosen symbol; the preview shows it. |
| **Cover page** | `ExportOptions.coverPage` | Title page on its own (title, subtitle, byline or pseudonym, word count); the story starts on page 2. Page numbering counts the cover. |
| **Presets** | `prefs.exportPresets`; export window | Save, apply and delete named option sets (font, spacing, page, layout, symbols…). Presets never store names or contact details. |
| **Plain text** | `export/text.ts`; format option | `.txt` without markers, comments or callouts; emphasis dropped; scene breaks kept. Written to `Exports/`, never to the clipboard. |

## Phase 2 — More formats and whole projects ✅ (1.7.0)

| Item | Where | Done when |
|---|---|---|
| **EPUB 3** | `export/epub.ts` | Valid package (`mimetype` stored first, container, OPF, nav, NCX for older readers, XHTML, CSS) that passes EPUBCheck. One XHTML file per chapter; title page; language and author/pseudonym metadata. |
| **Project export** | `compileProject` in `export/manuscript.ts`; gathering in `main.ts`; command and file-menu entries | From an **anthology note** (stories whose `anthology` property links to it) or a **folder** of notes. Order: `order` property, then `date_created`, then name. Each note becomes a chapter (its title as the chapter heading, its byline/subtitle dropped). Total word count. Chapters start on a new page. Works with every format and layout. |

## Phase 3 — Statistics ✅ (1.7.0)

| Item | Where | Done when |
|---|---|---|
| **Count each line as a paragraph** | `AnalyzeOptions.linesAsParagraphs`; setting | Paragraph count, words per paragraph and longest paragraphs use lines, matching how text reads in Obsidian. Off by default (Markdown paragraphs). |

## Phase 4 — Poetry mode, first slice ✅ (1.7.0)

| Item | Where | Done when |
|---|---|---|
| **Poem notes** | `poetry/poem.ts` (`isPoemText`, `isPoemFM`) | `type: poem` / `poema` / `poesía`, or `cssclasses: poem`. Template-free: any note can opt in. |
| **Layout in the editor** | `poetry/editor.ts` (CodeMirror line decorations) | Lines keep their indentation; long lines wrap with a hanging indent; stanza gaps visible. |
| **Layout in Reading view** | `poetry/editor.ts` (post-processor) | Each line is its own line, leading spaces preserved (no code blocks from indented lines), hanging indent, emphasis kept. |
| **Syllables** | `poetry/metrics.ts` | Spanish *métrica*: phonological syllables with *sinalefa* across words and the *ley del acento final* (aguda +1, esdrújula −1). English: approximate syllable count. Marked as estimates. |
| **Rhyme scheme** | `poetry/metrics.ts` | Rhyme of each line's last word from its stressed vowel: consonant rhyme letters (A, B…) and, in Spanish, assonant rhyme (vowels only) shown when lines share only vowels. |
| **Form** | `poetry/metrics.ts` | Recognises sonnet, haiku (5‑7‑5), décima (abbaaccddc, octosyllables), romance (octosyllables, assonant even lines), quatrains, free verse. |
| **Poem tab** | `poetry/panel.ts` | Lines, stanzas, words, form; each line with its syllable count and rhyme letter; tap a line to jump to it. |
| **Poem-aware export** | `export/manuscript.ts` (`verse` blocks), all writers | Lines kept as written, indentation preserved, single-spaced within stanzas, a blank line between stanzas, never justified. |

## Phase 5 — Writing habits ✅ (1.8.0; revision mode 1.9.0)

| Item | Where | Done when |
|---|---|---|
| **Long history** ✅ | `habits/log.ts`; `main.ts` (`trackDaily`) | Words written per note per day kept for about 13 months (was 14 days); renamed notes keep their history. |
| **Daily goal and streaks** ✅ | settings; `habits/log.ts` | A daily word goal; current and best streak (days that reach the goal, or any writing without a goal); shown in the Stats tab and the dashboard. |
| **Writing sprints** ✅ | `habits/sprint.ts` | Start a timed sprint (minutes + word target) from a command or the dashboard; live countdown and word count in the status bar and the writing panel; a summary at the end (words, words per minute, target met); a sprint log. |
| **Writing habits dashboard** ✅ | `habits/view.ts` | Words per day for the last 30 / 90 / 365 days with the goal line; totals for today, this week, this month; sprint statistics. |
| **Genres** ✅ | `habits/genres.ts`; dashboard; *Set genre of this note…* | Each work's `genre` property (one or several). The dashboard shows where your words go by genre (words written in the period) and how many works and words you have per genre, names the genre you write most, and lists untagged works so they can be tagged in place. |
| **Forms and projects** ✅ | dashboard | The same breakdown by form (story, poem, screenplay, article…) and per project (anthology): works, total words, `word_goal` progress, recent words. |
| **Revision mode** ✅ | `revision/*` | See Phase 5b. |

## Phase 5b — Revision mode ✅ (1.9.0)

Revising is a different kind of work from drafting: the word count may go down, and the question is *what changed*,
not *how much was written*. Revision mode keeps drafts of a note and shows the changes between any two of them.

```
note text ──► draft store (revision/store.ts) ──► compare (revision/diff.ts) ──► revision view, panel tab, editor marks
                                                          └──► tracked changes (revision/tracked.ts ► export/docx.ts)
```

| Item | Where | Done when |
|---|---|---|
| **Drafts** | `revision/store.ts`; *Save a draft of this note…* | A named copy of the note at a moment in time, with an optional note ("before the editor's comments"). Kept as one JSON file per note in a hidden folder of the vault (`.authors-toolbox/drafts`, a setting), so drafts never show up in search, the graph, Dataview queries or word counts, sync with the vault, and survive uninstalling the plugin. Renaming a note keeps its drafts. |
| **Daily checkpoint** | `main.ts` (`autoCheckpoint`) | The first time a writing note is opened each day, its text is kept as an automatic draft, if it changed since the last one. Automatic drafts are kept for a number of days (a setting); named drafts are kept until deleted. |
| **Comparison engine** | `revision/diff.ts` (pure) | Paragraph alignment (Myers diff on lines), pairing of rewritten paragraphs by similarity, word-level changes inside them, moved paragraphs, words added / cut / moved, share of the text rewritten. Fast enough for a novel (common ends trimmed, bounded search). |
| **Per chapter** | `revision/diff.ts` (`sections`) | Each heading is a section: words before and after, added and cut, and whether it is new, cut, rewritten, moved or untouched. |
| **Style changes** | revision view | Before → after for words, sentences, average sentence length, readability, dialogue, adverbs and crutch words per 1,000 words, long sentences and vocabulary variety. |
| **Revision view** | `revision/view.ts` | Pick any two versions (a draft and the current note, or two drafts). Summary, revision goal, chapters, style, then the text with additions, cuts and moves marked; *Changes only* hides untouched paragraphs. Tapping a paragraph opens it in the note. |
| **Undo a change** | revision view | Each cut or rewritten paragraph has *Restore*: puts the draft's version back in the note (only if the note still has the expected text there). |
| **Draft history** | revision view | Timeline of drafts with words and change from the previous one; compare, rename, add a note, copy to a new note, restore the whole draft (the current text is saved as a draft first, properties are kept), delete. |
| **Revision goal** | revision view; panel | "Cut 10%" or "reach 5,000 words", measured from a draft; progress bar in the revision view and the panel. |
| **Revise tab** | `revision/panel.ts` | In the writing panel: last draft, changes since it, goal progress, *Save draft*, *Compare*, *Show changes in the editor*, recent drafts. |
| **Changes in the editor** | `revision/editor.ts` | Optional marks in the margin of the editor: new lines, rewritten lines, and where text was cut, against the last draft (or the one being compared). Updated as you type. |
| **Tracked changes for editors** | `revision/tracked.ts`; `export/docx.ts` | Export a Word file in manuscript format where the changes since a draft are real Word revisions (insertions and deletions, author and date) that an editor can accept or reject. |

Later: words revised per day in the habits dashboard; recovering a deleted note from its drafts.

## Phase 6 — Poetry, next ⏳

- Stress patterns (meter) for English: iambic pentameter detection with a pronunciation dictionary.
- Optional line numbers every 5 lines; epigraph and dedication styles.
- Alignment per stanza; per-line syllable target with warnings (e.g. all lines of a sonnet at 11).
- Sound repetition (alliteration, repeated words) in the Poem tab.
- Poetry collections through project export (one poem per page).

---

## Testing approach

- Pure modules (`export/*`, `poetry/metrics.ts`, `text/analysis.ts`, `revision/diff.ts`) are tested in Node against sample notes.
- Every writer's output is checked by rendering it: PDFs with `pdftoppm`, Word files and EPUBs converted with
  LibreOffice / unpacked and validated, and the preview drawn in a headless browser.
- Contest exports are scanned to make sure the author's name never appears (text, file properties, metadata).
- `npm run lint` (the directory's own rules) and `npm run typecheck` must stay at zero warnings.
- `npm test` runs the behaviour tests in `tests/` (Node's test runner, Obsidian mocked, real CodeMirror and DOM)
  on every push, pull request and release.
