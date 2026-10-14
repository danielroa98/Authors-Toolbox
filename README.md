# Authors Toolbox

**Writing tools for fiction writers and screenwriters in [Obsidian](https://obsidian.md).** It adds a writing panel with statistics, a reorderable outline, style insights and an English/Spanish spelling and grammar check. It also covers paragraph alignment, images in the text, Spanish dialogue dashes, and a complete screenplay mode based on [Fountain](https://fountain.io).

It works on **macOS, Windows, Linux, iPhone and iPad** and requires Obsidian 1.7.2 or later. It uses no Node.js or Electron APIs, and every control is touch-friendly.

---

## Contents

- [Features](#features)
  - [Writing panel](#writing-panel)
  - [Spelling and grammar](#spelling-and-grammar)
  - [Paragraph alignment](#paragraph-alignment)
  - [Images in the text](#images-in-the-text)
  - [Spanish dialogue dash (raya)](#spanish-dialogue-dash-raya)
  - [Screenplay mode](#screenplay-mode)
  - [Manuscript export (Word, PDF, EPUB, text)](#manuscript-export-word-pdf-epub-text)
  - [Poetry mode](#poetry-mode)
- [Commands](#commands)
- [Note properties](#note-properties)
- [Settings](#settings)
- [Network use and privacy](#network-use-and-privacy)
- [Installation](#installation)
- [Roadmap: possible changes](#roadmap-possible-changes)
- [Known limitations](#known-limitations)
- [Development](#development)
- [License](#license)

---

## Features

### Writing panel

A sidebar for the note you're working on. Open it from the **pen icon** in the ribbon or with the command **Open writing panel**. It updates as you type.

| Tab | What it shows |
|---|---|
| **Stats** | Word count with a length label (flash fiction → short story → novelette → novella → novel); characters with and without spaces; paragraphs and sentences; average sentence and paragraph length; reading and read-aloud time; share of dialogue; lexical variety (moving-average type/token ratio); readability (Flesch / Flesch–Kincaid for English, INFLESZ for Spanish); a **sentence-rhythm chart** (one bar per sentence); a per-note **word goal** with a progress bar; **words written today**; live counts for the **selected text**. |
| **Outline** | Chapters (headings) and scenes (separated by `---`, `* * *`, `⁂` or `#`) with word counts. Tap to jump. Drag the ⠿ handle, or use the ⋯ menu, to **reorder chapters and scenes**. Each move is a single undo step. |
| **Style** | Long sentences; **words repeated close together**; three or more sentences in a row that start with the same word; adverbs (‑ly / ‑mente); your **crutch words**; most-used words; **names and places**; longest paragraphs. Tap any item to highlight it in the text, and tap again to step to the next occurrence. |
| **Check** | Spelling and grammar suggestions (see below). |

Headings, comments, callouts, code blocks and front matter are not counted, so the numbers reflect your prose.

### Spelling and grammar

Obsidian has no grammar checker of its own, and its spellcheck follows the operating system. On macOS it often offers no suggestions when you write in more than one language. Authors Toolbox adds an on-demand check powered by [LanguageTool](https://languagetool.org):

- Check the **selection**, the **current section** or the **whole note**.
- Problems are underlined in the editor by type: spelling, grammar, punctuation and style.
- Tap an underline, or a card in the panel, to **apply a suggestion**, **ignore** it, **add the word to your personal dictionary** (character names, invented words) or **turn the rule off**.
- **Language per note:** use the menu at the top of the panel (Auto-detect, English US/UK, Español). It is saved as a `lang` property and also sets hyphenation for justified text.
- Long notes are split into parts automatically, within the free service's limits.

Nothing is sent until you press **Check**, and the first check asks for permission. See [Network use and privacy](#network-use-and-privacy).

### Paragraph alignment

Center, right-align, left-align or justify **only the selected paragraphs**: right-click → *Center*, or use the commands. Each paragraph gets an invisible marker (`%%center%%`), so the alignment holds in Live Preview, Reading view and PDF export. Running the same command again toggles it off.

### Images in the text

**Insert image…** lets you browse your vault's folders for an image (it opens in your attachments folder) or upload one from your device. You can set its width, alignment and an optional italic caption.

### Spanish dialogue dash (raya)

In Markdown, a line that starts with `-` becomes a bullet list, which breaks Spanish-style dialogue. In story notes, Authors Toolbox handles this:

- A `-` typed at the **start of a line** becomes **—**, so `—¿Vienes? —preguntó.` stays dialogue.
- `--` anywhere becomes **—**.
- Hyphens inside words (*semi-dormida*) are left alone. Press undo right after if you really wanted a hyphen.
- **Convert dialogue dashes in this note** fixes text pasted from elsewhere.

Story notes are notes with `type: story`, or notes in the folders you list in the settings.

### Screenplay mode

Notes with `type: script` are written in **[Fountain](https://fountain.io)**, the plain-text screenplay format, and laid out as a screenplay. The layout uses Courier with standard indents and works in the editor, in Reading view and in PDF export.

- **Smart Enter:** after a character name, Enter starts the dialogue line. After dialogue or action, it leaves the blank line the next element needs. Shift+Enter always inserts a plain line break.
- **Suggestions:**
  - **Character names**, plus `(V.O.)`, `(O.S.)` and `(CONT'D)`.
  - **Locations** and **times of day** in scene headings (English and Spanish: `DAY`/`NIGHT`, `DÍA`/`NOCHE`…).
- **Format line as…:** scene heading, action, character, parenthetical, transition or centered text, from the right-click menu or as commands.
- **Writing panel tabs for scripts:**
  - **Script:** estimated pages and screen time, scenes, speaking characters, locations, dialogue share, INT/EXT and day/night breakdown, a scene-length chart, and a Fountain quick reference.
  - **Scenes:** a numbered scene board with lengths in eighths of a page. Drag to reorder scenes within an act; acts are `#` headings.
  - **Cast:** speeches, words spoken and scenes per character, plus every location.
  - **Notes:** coaching on screenwriting conventions:
    - dense action paragraphs and long speeches;
    - scene headings missing INT./EXT. or a time of day;
    - camera directions;
    - things the camera can't show ("thinks", "recuerda");
    - characters who speak before they're introduced in CAPS.
- **New script…** and **Adapt this story into a script**. The second creates a linked script and opens it next to the story.
- **Export as .fountain**, for Final Draft, Fade In, Highland, WriterSolo or Beat. The file is saved in an `Exports` folder next to the script.

The spelling and grammar check skips character names, scene headings and transitions in scripts.

### Manuscript export (Word, PDF, EPUB, text)

Turn a story, a poem or a whole project into submission-ready files: run *Export manuscript as a document or PDF…*, or choose **Export manuscript…** in the note's ⋯ menu or the file explorer. The export window shows a **live preview of every page** while you change the options, and the PDF is printed from exactly that layout.

- **Formats:** Word (.docx), PDF, EPUB 3 (validated with EPUBCheck) and plain text (.txt, for submission forms that ask you to paste the story). Pick any combination.
- **Two layouts:**
  - **Standard manuscript:** your name and contact details top left, the rounded word count top right, the title and byline just below (a subtitle that already names you replaces the byline), and *Surname / Title / page* at the top of every following page.
  - **Contest (anonymous):** title and *Pseudonym: …* only, with page numbers at the bottom. A subtitle that names you (*Un relato de …*) is left out. Your name appears nowhere in the files, not even in their document properties. A note's `pseudonym` property overrides the default pseudonym.
- **Options:** Times New Roman, Courier or Arial at 12 pt; double or 1.5 spacing; Letter or A4; scene-break symbol (`#`, `* * *`, `—` or a blank line); a **cover page**; chapters on a new page; **keep justified paragraphs**.
- **Presets:** save the current options under a name (for example one per contest) and apply them in one tap. Presets never store your name or contact details.
- **Whole projects:** export an **anthology note** (the stories whose `anthology` property links to it, plus any it links to in its text, in that order) or **a folder** (right-click → *Export folder as one manuscript…*). Notes are ordered by an `order` property, then `date_created`, then name. Each note becomes a chapter that starts on a new page, with the total word count on the first page.
- **What goes in:** the first `#` heading is the title and a heading right under it the subtitle (or your byline, which is dropped). Every line is a paragraph with a first-line indent. Italics and bold are kept, headings become section titles, scene-break lines become the chosen symbol, and the text ends with *FIN* / *END*. Callouts (concept art, author notes), comments, images, tables and code are left out. Centered and right-aligned paragraphs keep their alignment. Poems keep their lines, indentation and stanzas.
- Files are saved in an `Exports` folder next to the note (or inside the exported folder). Everything is generated inside Obsidian, with no internet connection, on desktop, iPhone and iPad.

### Poetry mode

Mark a note with `type: poem` (or `poema`, `poesía`), or add `poem` to its `cssclasses`, and it is treated as verse:

- **Layout:** every line stays a line and keeps its indentation, in the editor and in Reading view (indented lines are no longer turned into code blocks, and lines aren't merged even with "strict line breaks" on). Long lines wrap with a **hanging indent**, a blank line separates stanzas, and `%%center%%` / `%%right%%` still align a stanza.
- **Poem tab** in the writing panel:
  - **Syllables per line.** Spanish uses *métrica*: syllables with *sinalefa* between words, *hiato* on accented weak vowels and the *ley del acento final* (aguda +1, esdrújula −1). Hover a line to see how the count was reached. English counts are approximate.
  - **Rhyme scheme** by stanza (ABBA ABBA CDC DCD). In Spanish, consonant rhyme gets a letter and assonant rhyme a letter with ′; uppercase for *arte mayor*, lowercase for *arte menor*.
  - **Form:** sonnet, haiku (5‑7‑5), *décima espinela*, *romance*, couplets to octaves, isometric verse or free verse.
  - Tap a line to jump to it.
- **Export:** single-spaced lines with their indentation, a blank line between stanzas, never justified.

---`, `#`, `⁂`) become a centered `#`, and the story ends with *FIN* / *END*. Callouts (concept art, author notes), comments, images, tables and code are left out. Centered and right-aligned paragraphs keep their alignment; justified ones are justified in the contest layout.
- Files are saved in an `Exports` folder next to the note. Everything is generated inside Obsidian, with no internet connection, on desktop, iPhone and iPad.

---

## Commands

| Command | |
|---|---|
| Open writing panel | |
| Center / Align right / Align left / Justify selected text, Clear alignment | also in the right-click menu |
| Insert image… | also in the right-click menu |
| Check spelling & grammar: selection / current section / whole note | |
| Clear spelling & grammar underlines | |
| Set note language: Español / English / auto-detect | |
| Convert dialogue dashes (- → —) in this note | |
| Export manuscript as a document or PDF… | also in the note's ⋯ menu and the file explorer; anthology notes export as a project |
| Export folder as one manuscript… | right-click a folder in the file explorer |
| Screenplay: new script… / adapt this story into a script / export as .fountain | |
| Screenplay: format line as Scene heading / Action / Character / Parenthetical / Transition / Centered | also in the right-click menu in scripts |
| Screenplay: insert page break | |
| Screenplay: turn script formatting on/off for this note | |

On iPhone and iPad, add the commands you use most to the mobile toolbar (**Settings → Mobile**).

## Note properties

| Property | Used for |
|---|---|
| `type: story` | Marks a story: turns on the dialogue dash. |
| `type: script` (+ `cssclasses: [screenplay]`) | Turns on screenplay mode. |
| `lang: es` / `en-US` / `en-GB` | Language for statistics, readability, crutch words and the grammar check. |
| `word_goal: 3000` | Word goal shown in the Stats tab. |
| `format: short` / `feature` / `pilot` | Script length target shown in the Script tab. |
| `title`, `credit`, `author`, `adapted_from`, `draft_date`, `contact` | Title page of the `.fountain` export. |
| `title`, `pseudonym` | Title and pen name of an exported manuscript. |
| `order` | Position of a chapter or story in a project export. |
| `type: poem` (or `cssclasses: [poem]`) | Turns on poetry mode. |

## Settings

- **Images:**
  - Upload folder (defaults to Obsidian's attachment location).
  - Default width and alignment.
- **Writing panel:**
  - Default language and default word goal.
  - Reading and read-aloud speeds.
  - Long-sentence threshold and repetition window.
  - Crutch-word lists for English and Spanish.
  - Count each line as a paragraph.
- **Stories:**
  - Turn the dialogue dash on or off.
  - Story folders.
- **Manuscript export:**
  - Default layout.
  - Font, line spacing and page size.
  - Contact details and pseudonym.
  - Chapters on a new page, keep justified paragraphs, scene-break symbol and cover page.
- **Screenplays:**
  - Scripts folder and author name.
  - Smart Enter.
- **Spelling and grammar:**
  - Permission to use LanguageTool.
  - Server URL.
  - Optional LanguageTool Premium username and API key.
  - Picky mode.
  - Personal dictionary.
  - Turned-off rules.

## Network use and privacy

Authors Toolbox uses the network **only for the spelling and grammar check, and only when you ask for it.**

- **What is sent:** when you press **Check** (or run a *Check spelling & grammar* command), the text in the scope you chose (selection, current section or whole note) is sent to **LanguageTool**, by default `https://api.languagetool.org`.
- **When:** never automatically. The first check asks for your permission, which you can withdraw in the settings.
- **Why:** to get English and Spanish spelling and grammar suggestions that work the same on every device.
- **Which server:** you can use your own [LanguageTool server](https://dev.languagetool.org/http-server) instead. LanguageTool's handling of text is described in its [privacy policy](https://languagetool.org/legal/privacy).

The free LanguageTool service is limited to about 20 KB per request and 75 KB per minute. Authors Toolbox splits long notes and waits between parts when needed. **LanguageTool Premium** (a paid LanguageTool service) is optional.

Everything else runs entirely on your device: statistics, style insights, outline, alignment and screenplay layout. The plugin stores its settings and a small daily word count in its own `data.json` inside your vault. It includes no telemetry and no ads.

## Installation

**From Obsidian:** Settings → Community plugins → Browse → search **Authors Toolbox** → Install → Enable.

**Manually:**
1. Download `main.js`, `manifest.json` and `styles.css` from the [latest release](../../releases/latest).
2. Copy them to `<your vault>/.obsidian/plugins/authors-toolbox/`.
3. Reload Obsidian and enable **Authors Toolbox** under Settings → Community plugins.

**Beta versions:** install from this repository with the [BRAT](https://obsidian.md/plugins?id=obsidian42-brat) plugin.

---

## Roadmap: possible changes

Ideas under consideration, roughly in order of priority. Nothing here is promised; suggestions are welcome in the issues.

Recently done: the TypeScript rewrite and searchable settings (1.5.1), dialogue detection on every line (1.5.2), manuscript export with a live preview (1.6), and EPUB, plain text, project export, presets and the first part of poetry mode (1.7). The step-by-step plan is in [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md).

### Poetry mode (next steps)

The first part of poetry mode is in (layout, syllables, rhyme scheme, form, export). Next:

- **English meter:** stress patterns with a pronunciation dictionary (iambic pentameter and others).
- **Optional line numbers** every 5 lines, and styles for epigraphs and dedications.
- **Targets and warnings:** flag lines that break the poem's meter (for example a line of 10 in a sonnet of hendecasyllables).
- **Sound and repetition:** alliteration and repeated words in the Poem tab; villanelle and other refrain forms.
- **Collections:** poetry books through project export, one poem per page.

### Writing and manuscripts
- **Table of contents** in Word and PDF project exports, and an EPUB cover image.
- **Writing sprints:** a timer with a word target and a session summary.
- **Per-project goals and history:** words per day, streaks, a progress chart.
- **Revision mode:** compare two drafts, with word count differences per chapter.

### Screenplays
- **Exact pagination** and a screenplay-ready **PDF export** (Courier 12 pt, standard margins, title page, `(MORE)`/`(CONT'D)` across pages, scene numbers), reusing the PDF engine and live preview of the manuscript export.
- **Final Draft (`.fdx`) export**, generated from the same element detection as the screenplay layout.
- **Dual dialogue** shown side by side.
- **Title page** rendering inside Obsidian.
- **Production helpers:** scene numbering locks, revision colours, a character and location report.
- A **Fountain import** command for existing `.fountain` files.

### Language and checking
- **More languages** for statistics and checks (Portuguese and French first).
- **Spanish-language interface.**
- **Automatic checking** of the current paragraph after a pause, with the same consent and limits.

### Small improvements
- Dialogue-dash conversion for pasted text without running a command.
- Configurable scene-break symbols.
- Keyboard shortcuts for moving sections up and down in the outline.

## Known limitations

- The grammar check needs an internet connection, unless you run your own LanguageTool server.
- Page counts for scripts are estimates (55 lines per page with standard element widths), not exact pagination.
- Statistics and style insights support English and Spanish; other languages fall back to English rules.
- Obsidian's own spellcheck still runs alongside. On iPhone and iPad it follows the keyboard language.
- Syllable counts and rhyme are estimates: poets bend the rules (*sinéresis*, *diéresis*, licences), and English has no stress analysis yet.
- Exported PDFs use the PDF standard fonts (Times, Helvetica for Arial, Courier), which cover Spanish and Western European characters; other scripts print as "?". Word files use the real fonts.

---

## Development

```bash
npm install
npm run dev     # rebuild main.js on every change (copy or symlink the folder into a test vault)
npm run lint    # Obsidian's official ESLint rules (the same checks as the directory's automated review)
npm run typecheck  # TypeScript strict-mode check
npm run build   # type-check + production build → main.js
```

Source layout (TypeScript in strict mode, bundled by esbuild into `main.js`):

```
src/
├── main.ts                  # plugin entry: commands, events, panel state, grammar check, screenplay commands
├── constants.ts             # defaults and shared constants
├── settings.ts              # settings tab
├── text/analysis.ts         # pure text analysis: prose map, stats, readability, style, outline, LanguageTool chunks
├── screenplay/
│   ├── fountain.ts          # Fountain parser, script analysis, scene outline, .fountain export
│   ├── editor.ts            # editor formatting, smart Enter, suggestions, Reading view, script template
│   └── panel.ts             # writing-panel tabs for scripts
├── editor/
│   ├── alignment.ts         # per-paragraph alignment markers and decorations
│   ├── issues.ts            # grammar underlines and find highlights (CodeMirror state)
│   └── raya.ts              # Spanish dialogue dash
├── view/
│   ├── writing-view.ts      # the writing panel
│   └── helpers.ts           # formatting helpers and labels
├── export/
│   ├── manuscript.ts        # story note → manuscript (title, headings, paragraphs, emphasis, scene breaks)
│   ├── layout.ts            # page layout with font metrics, shared by the PDF and the preview
│   ├── pdf.ts               # PDF writer (standard fonts, no dependencies)
│   ├── docx.ts              # Word writer (Office Open XML)
│   ├── epub.ts              # EPUB 3 writer
│   ├── text.ts              # plain-text writer
│   ├── zip.ts               # minimal ZIP writer for .docx
│   └── widths.ts            # glyph widths of the PDF standard fonts
├── poetry/
│   ├── poem.ts              # poem-note detection
│   ├── metrics.ts           # syllables (Spanish métrica, English), rhyme scheme, form
│   ├── editor.ts            # verse layout in the editor and Reading view
│   └── panel.ts             # Poem tab of the writing panel
└── modals/
    ├── export-manuscript.ts # export window with live page preview
    ├── insert-image.ts
    └── prompts.ts
```

### Releasing

1. Update `version` in `manifest.json` and `package.json`, and add the version to `versions.json`.
2. Commit, then tag with the same version and push the tag:
   ```bash
   git tag -a 1.4.1 -m "1.4.1"
   git push origin 1.4.1
   ```
3. The GitHub Action builds the plugin and creates a **draft release** with `main.js`, `manifest.json` and `styles.css` and a build-provenance attestation. Review it and publish.

See [CHANGELOG.md](CHANGELOG.md) for the version history.

## License

[MIT](LICENSE) © 2026 Daniel Roa
