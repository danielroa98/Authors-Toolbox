# Privacy and your data

## The network

Authors Toolbox uses the network for **one thing only: the spelling and grammar check, and only when you ask for it.**

- **What is sent:** when you press **Check** (or run a *Check spelling & grammar* command), the text in the scope you chose (selection, current section or whole note) is sent to **LanguageTool**, by default `https://api.languagetool.org`, with its language and, if you set them, your premium username and key. Front matter, comments and code are sent only as markup to skip, not as text to check.
- **When:** never automatically. The first check explains this and asks for permission, which you can withdraw in the settings.
- **Where:** the server in the settings. You can run your [own LanguageTool server](https://dev.languagetool.org/http-server) so text never leaves your network. LanguageTool's handling of text is described in its [privacy policy](https://languagetool.org/legal/privacy).

Everything else (statistics, style insights, outline, alignment, screenplay and poetry layout, metrics, export, habits, drafts and comparisons) runs entirely on your device. There is no telemetry, no analytics and no ads.

## What is stored, and where

| What | Where | Notes |
|---|---|---|
| Settings, export presets, panel state | `.obsidian/plugins/authors-toolbox/data.json` | Includes your name and contact details if you entered them, and the LanguageTool key if you set one. Don't share this file. |
| Words written per note per day (about 13 months) | same `data.json` | Note paths and word counts only, no text. |
| Sprint log | same `data.json` | Start time, length, target and words. |
| Drafts | `.authors-toolbox/drafts/` in your vault | Full copies of notes. One JSON file per note. |
| Exports | `Exports/` next to the note | Files you asked for. |
| Note language, genre, goals | the note's own properties | Written only when you set them. |

Nothing is stored outside your vault. Deleting the plugin removes `data.json`; drafts stay in your vault until you delete the `.authors-toolbox` folder.

## Contest anonymity

The contest layout of the [manuscript export](Manuscript-export#contest-anonymous) is built so your name appears nowhere in the files: not in the text, not in a subtitle that names you, and not in the document properties of the Word, PDF or EPUB files. The test suite checks every format for this on every release.
