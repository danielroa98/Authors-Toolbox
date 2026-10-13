# Authors Toolbox

**Writing tools for fiction writers and screenwriters in [Obsidian](https://obsidian.md).** It adds a writing panel with statistics, a reorderable outline, style insights and an English/Spanish spelling and grammar check. It also covers paragraph alignment, images in the text, Spanish dialogue dashes, and a complete screenplay mode based on [Fountain](https://fountain.io).

It works on **macOS, Windows, Linux, iPhone and iPad**. It uses no Node.js or Electron APIs, and every control is touch-friendly.

---

## Contents

- [Features](#features)
  - [Writing panel](#writing-panel)
  - [Spelling and grammar](#spelling-and-grammar)
  - [Paragraph alignment](#paragraph-alignment)
  - [Images in the text](#images-in-the-text)
  - [Spanish dialogue dash (raya)](#spanish-dialogue-dash-raya)
  - [Screenplay mode](#screenplay-mode)
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

**Insert image…** lets you pick an image from your vault or upload one from your device. You can set its width, alignment and an optional italic caption.

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
- **Export as .fountain**, for Final Draft, Fade In, Highland, WriterSolo or Beat. The export also copies the script to the clipboard.

The spelling and grammar check skips character names, scene headings and transitions in scripts.

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

## Settings

- **Images:**
  - Upload folder (defaults to Obsidian's attachment location).
  - Default width and alignment.
- **Writing panel:**
  - Default language and default word goal.
  - Reading and read-aloud speeds.
  - Long-sentence threshold and repetition window.
  - Crutch-word lists for English and Spanish.
- **Stories:**
  - Turn the dialogue dash on or off.
  - Story folders.
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

### Poetry mode (next)

Prose formatting gets in the way of poetry. Markdown merges lines, eats indentation and justifies text. The plan is a dedicated mode for notes with `type: poem`:

- **Layout:**
  - **Lines stay as written.** Every line break is preserved, regardless of Obsidian's "strict line breaks" setting.
  - **Stanzas** are separated by blank lines.
  - **Indentation and spacing are preserved** for drop lines, staggered verse and concrete or visual poetry.
  - **Hanging indent** for long lines that wrap, so wrapped text isn't mistaken for a new line.
  - **Alignment per poem or per stanza:** left, centered or right; never justified.
  - **Optional line numbers** (every 5 lines) for long poems and workshop drafts.
  - **Epigraphs and dedications** styled as such, plus a title-and-poet block.
- **Analysis:**
  - **Syllable count per line.** Spanish métrica would account for *sinalefa*, *hiato* and the *ley del acento final*; English would get approximate stress patterns.
  - **Rhyme scheme detection** (ABAB, ABBA…), with consonant and assonant rhyme in Spanish.
  - **Form recognition and checks:** sonnet, haiku (5‑7‑5), décima, romance, villanelle, free verse.
  - **A Poem tab** in the writing panel with stanzas, lines, the syllable count of each line, the rhyme scheme, and repeated sounds or words.
- **Export:** PDF and Markdown that keep the exact layout.

### Writing and manuscripts
- **Compile a manuscript** from several notes (chapters of a novel) into one document, with a word count for the whole book.
- **Standard manuscript format export** (Shunn) to DOCX and PDF for submissions and contests.
- **Writing sprints:** a timer with a word target and a session summary.
- **Per-project goals and history:** words per day, streaks, a progress chart.
- **Revision mode:** compare two drafts, with word count differences per chapter.

### Screenplays
- **Exact pagination** and a screenplay-ready **PDF export** (Courier 12 pt, margins, `(MORE)`/`(CONT'D)` across pages, scene numbers).
- **Dual dialogue** shown side by side.
- **Title page** rendering inside Obsidian.
- **Production helpers:** scene numbering locks, revision colours, a character and location report.
- A **Fountain import** command for existing `.fountain` files.

### Language and checking
- **More languages** for statistics and checks (Portuguese and French first).
- **Spanish-language interface.**
- **Automatic checking** of the current paragraph after a pause, with the same consent and limits.
- **Settings search** support (Obsidian 1.13+ setting definitions).

### Small improvements
- Dialogue-dash conversion for pasted text without running a command.
- Configurable scene-break symbols.
- Keyboard shortcuts for moving sections up and down in the outline.

## Known limitations

- The grammar check needs an internet connection, unless you run your own LanguageTool server.
- Page counts for scripts are estimates (55 lines per page with standard element widths), not exact pagination.
- Statistics and style insights support English and Spanish; other languages fall back to English rules.
- Obsidian's own spellcheck still runs alongside. On iPhone and iPad it follows the keyboard language.

---

## Development

```bash
npm install
npm run dev     # rebuild main.js on every change (copy or symlink the folder into a test vault)
npm run lint    # Obsidian's official ESLint rules (the same checks as the directory's automated review)
npm run build   # production build → main.js
```

Source layout (plain JavaScript ES modules, bundled by esbuild into `main.js`):

```
src/
├── main.js                  # plugin entry: commands, events, panel state, grammar check, screenplay commands
├── constants.js             # defaults and shared constants
├── settings.js              # settings tab
├── text/analysis.js         # pure text analysis: prose map, stats, readability, style, outline, LanguageTool chunks
├── screenplay/
│   ├── fountain.js          # Fountain parser, script analysis, scene outline, .fountain export
│   ├── editor.js            # editor formatting, smart Enter, suggestions, Reading view, script template
│   └── panel.js             # writing-panel tabs for scripts
├── editor/
│   ├── alignment.js         # per-paragraph alignment markers and decorations
│   ├── issues.js            # grammar underlines and find highlights (CodeMirror state)
│   └── raya.js              # Spanish dialogue dash
├── view/
│   ├── writing-view.js      # the writing panel
│   └── helpers.js           # formatting helpers and labels
└── modals/
    ├── insert-image.js
    └── prompts.js
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
