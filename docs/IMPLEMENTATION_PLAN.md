# Implementation plan: manuscripts and poetry

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

## Phase 5 — Poetry, next ⏳

- Stress patterns (meter) for English: iambic pentameter detection with a pronunciation dictionary.
- Optional line numbers every 5 lines; epigraph and dedication styles.
- Alignment per stanza; per-line syllable target with warnings (e.g. all lines of a sonnet at 11).
- Sound repetition (alliteration, repeated words) in the Poem tab.
- Poetry collections through project export (one poem per page).

## Phase 6 — Writing habits ⏳

- **Writing sprints:** a timer with a word target and a session summary.
- **Per-project goals and history:** words per day, streaks, a progress chart (builds on the daily word log).
- **Revision mode:** compare two drafts, with word-count differences per chapter.

---

## Testing approach

- Pure modules (`export/*`, `poetry/metrics.ts`, `text/analysis.ts`) are tested in Node against real notes.
- Every writer's output is checked by rendering it: PDFs with `pdftoppm`, Word files and EPUBs converted with
  LibreOffice / unpacked and validated, and the preview drawn in a headless browser.
- Contest exports are scanned to make sure the author's name never appears (text, file properties, metadata).
- `npm run lint` (the directory's own rules) and `npm run typecheck` must stay at zero warnings.
