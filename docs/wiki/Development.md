# Development

## Building

```bash
git clone https://github.com/danielroa98/Authors-Toolbox.git
cd Authors-Toolbox
npm install
npm run dev        # rebuild main.js on every change
npm run build      # type-check + production build → main.js
npm run typecheck  # TypeScript strict-mode check
npm run lint       # Obsidian's official ESLint rules (the same checks as the plugin directory's review)
npm test           # behaviour tests
```

To try a build, copy or symlink the repository folder into a test vault's `.obsidian/plugins/authors-toolbox/` (it needs `main.js`, `manifest.json` and `styles.css`) and reload Obsidian.

## Source layout

```
src/
├── main.ts           plugin entry: commands, events, panel state, grammar check, export and screenplay commands
├── constants.ts      settings defaults and shared types
├── settings.ts       settings tab (one table drives the searchable settings of Obsidian 1.13+ and the classic tab)
├── text/analysis.ts  prose map, statistics, readability, style insights, outline, LanguageTool chunks
├── editor/           alignment markers, grammar underlines, Spanish dialogue dash
├── view/             the writing panel
├── screenplay/       Fountain parser and analysis, editor formatting, script tabs
├── poetry/           poem detection, métrica and rhyme, verse layout, Poem tab
├── export/           manuscript model, page layout, PDF, Word, EPUB, text and ZIP writers
├── habits/           daily log, genres, sprints, dashboard
├── revision/         drafts, comparison engine, revision page, Revise tab, editor marks, tracked changes
└── modals/           export window, image picker, prompts
```

See [How it works](How-it-works) for what each part does. The analysis, metrics, export and comparison modules are pure functions with no Obsidian APIs.

## Tests

`npm test` bundles the sources with esbuild (`tests/build.mjs`) and runs every `tests/*.test.cjs` with Node's built-in test runner. `npm test -- revision` runs only the files whose name contains *revision*.

- `tests/support/obsidian-mock.cjs` is a small stand-in for the Obsidian API: a vault in memory, a workspace, notes opened in a **real CodeMirror editor** on a jsdom DOM. Editor extensions, input handlers and decorations run for real.
- The tests drive the plugin like a writer: typing dialogue dashes, moving sections in the outline, running the grammar check against a fake LanguageTool, exporting (and checking the PDF structure, the ZIP entries and contest anonymity), writing sprints, saving and restoring drafts, comparing versions.
- The sample notes in `tests/fixtures/` were written for the tests (or are in the public domain).

| File | Covers |
|---|---|
| `plugin.test.cjs` | Writing panel tabs, outline moves, grammar check, note language, settings, dialogue dash, image picker. |
| `screenplay.test.cjs` | Script formatting, tabs, scene moves, smart Enter, suggestions, Reading view, Fountain export, templates. |
| `poetry.test.cjs` | Spanish syllable counts, rhyme, forms, Poem tab, verse in Reading view. |
| `export.test.cjs` | Manuscript model, PDF, Word, EPUB, plain text, projects, contest anonymity. |
| `habits.test.cjs` | Daily log, genres, streaks, sprints, dashboard. |
| `revision.test.cjs` | Diff engine (including a randomised check of Myers), sections, editor marks, performance on novel-length text, draft store, tracked changes, the revision flow in the plugin. |
| `analysis.test.cjs` | Words, language detection, dialogue, readability, outline reordering, LanguageTool chunks. |

## Continuous integration

- `.github/workflows/ci.yml` runs type checking, lint and the tests on every push to `main` and every pull request.
- `.github/workflows/release.yml` runs on a tag: it checks that the tag matches `manifest.json`, then lints, tests and builds, attests the build provenance and creates a **draft release** with `main.js`, `manifest.json` and `styles.css`.

## Releasing

1. Update `version` in `manifest.json`, `package.json` (and `package-lock.json`), and add the version to `versions.json` with the minimum Obsidian version.
2. Add the changes to `CHANGELOG.md`.
3. Commit, then tag with the same version and push the tag:
   ```bash
   git tag -a 1.9.0 -m "1.9.0"
   git push origin 1.9.0
   ```
4. Review the draft release on GitHub and publish it.

## This wiki

The wiki's source lives in the main repository under `docs/wiki/` (pages and `images/`), so it's reviewed and versioned with the code. To publish it to the GitHub wiki:

```bash
scripts/publish-wiki.sh        # clones the wiki repository, copies docs/wiki into it and commits
cd ../Authors-Toolbox.wiki && git push
```

The wiki repository must exist first: on GitHub, open the **Wiki** tab and save any first page once.

The screenshots are rendered from the plugin's own code: the sources are bundled for the browser with a stand-in for Obsidian, the sample notes are opened, each view is set up (a check run, a sprint started, drafts saved…) and captured in a headless Chromium. That way they always show the current interface with sample text, never a real vault.
