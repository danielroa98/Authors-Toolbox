# FAQ and troubleshooting

## General

**Does it work on iPhone and iPad?**
Yes, every feature. Open the writing panel by swiping from the right edge, and put the commands you use most in the mobile toolbar (Settings → Mobile).

**Does it work in languages other than English and Spanish?**
Layout, alignment, export, screenplays, habits and revision mode work in any language. Statistics and style insights know English and Spanish rules; other languages are analysed with the English rules. The grammar check supports whatever your LanguageTool server supports, but the panel only offers English and Spanish for now.

**Will it change my notes?**
Only when you ask: applying a suggestion, aligning a paragraph, typing a dialogue dash, moving a section, setting a language or genre, restoring a draft. Each of those is a normal edit you can undo. Exports and drafts are written to separate files.

## Writing panel

**The panel says "Flash fiction" but my story is longer.**
Only prose is counted: headings, front matter, comments, callouts and code are left out. If your note is long because of notes-to-self in callouts or comments, that's expected.

**The panel doesn't update.**
It follows the active note and updates after a short pause. If you closed it, open it again from the pen icon.

**Paragraph counts look wrong.**
By default a paragraph is a Markdown paragraph (separated by a blank line). If you write one paragraph per line with no blank lines, turn on *Count each line as a paragraph*.

## Spelling and grammar

**Nothing is underlined after a check.**
Check that the note's language is right (menu at the top of the panel), and that the check didn't stop with a message in the Check tab (for example a network error or the free service's limit). Names you added to the dictionary are never flagged.

**The check is slow on a long note.**
The free LanguageTool service accepts about 75 KB of text per minute, so a novel-length note is checked in parts with pauses. Check the current section instead, use a premium key, or run your own server.

**Obsidian's red squiggles are still there.**
That's the operating system's spellcheck, which keeps working alongside. You can turn it off in Settings → Editor → Spellcheck.

## Dialogue dash

**I wanted a bullet list in a story.**
Press undo right after the dash appears to get the hyphen back, or use `*` or `+` for list items. The dash only applies to story notes.

**The dash doesn't appear.**
The note must be a story: `type: story`, or inside one of the story folders in the settings. Check that *Dialogue dash (raya)* is on.

## Export

**My name appears in the contest file.**
It shouldn't: check that the layout is *Contest (anonymous)* and that the name isn't written in the story's text itself (the plugin removes a subtitle that names you, but not your name inside paragraphs). If it still appears, please open an issue.

**Special characters print as "?" in the PDF.**
The PDF uses the standard PDF fonts, which cover Western European languages. Export to Word for other scripts.

**Where are the files?**
In an `Exports` folder next to the note (or inside the exported folder). Obsidian lists PDFs, but `.docx`, `.epub` and `.fountain` files only appear in its file explorer if *Detect all file extensions* is on (Settings → Files and links). They're in the folder either way.

## Revision mode

**I don't see my drafts folder.**
`.authors-toolbox/drafts` starts with a dot, so Obsidian hides it on purpose. It's in your vault folder on disk. Change *Drafts folder* in the settings to a normal folder name if you want to see the files in Obsidian.

**A daily draft wasn't created.**
Daily drafts are only kept for notes in your writing folders, only once a day per note, and only when the text changed since the last draft. Check *Keep a daily draft automatically* and *Writing folders* in the settings.

**"The note has changed since the comparison."**
Restore and Undo changes only act when the note still has the text that was compared. Press refresh on the revision page and try again.

**Do drafts sync between my devices?**
Yes, if your vault syncs hidden folders: iCloud, Dropbox and Git sync everything. With Obsidian Sync, hidden folders may be excluded; use a visible drafts folder in that case.

## Still stuck?

Open an issue on [GitHub](https://github.com/danielroa98/Authors-Toolbox/issues) with your Obsidian version, device, and what you expected to happen.
