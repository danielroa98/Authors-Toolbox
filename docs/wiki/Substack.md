# Copy for Substack

Write in Obsidian, publish on Substack. **Copy for Substack** turns a story or poem note into exactly what the Substack editor accepts, so the post looks like your note without fixing it by hand after pasting.

## How to use it

1. Open the note and run *Copy for Substack…* from the command palette, or choose **Copy for Substack…** in the note's ⋯ menu or in the file explorer.
2. In a new Substack post, click **Copy** next to *Title* and paste into the title field. Do the same for *Subtitle*.
3. Click **Copy text** and paste into the body of the post.

The window shows a preview of the post and lists anything that won't come across.

## What is kept

| In your note | In Substack |
|---|---|
| First `#` heading or the `title` property | Title field |
| A heading right under the title, or the `subtitle` property | Subtitle field |
| Every line of prose | A paragraph |
| `*italics*`, `**bold**` | Italics, bold |
| `[text](https://…)`, `<https://…>` | Links (web and email only) |
| `[[Note]]`, `[[Note\|shown]]` | Plain text |
| `> quote` lines | One block quote |
| Section headings | Heading 2 for the top level, Heading 3 and lower below it |
| Scene breaks (`***`, `---`, `#`, `⁂`…) | Dividers |
| Dialogue dashes (—) | Kept as written |

## Poems

Substack puts space between paragraphs, so a poem pasted line by line ends up double-spaced, and lines copied as one block can run together. Here each **stanza** becomes one paragraph with a **line break after every line** — the same thing Shift+Enter does in the Substack editor — so lines stay single-spaced and stanzas stay apart. Leading **indentation** is written with no-break spaces, which Substack doesn't strip.

Long lines still wrap on narrow screens; check the post's preview on a phone before publishing.

## What doesn't come across

- **Images:** add them in Substack with the image button. The window counts them.
- **Footnotes:** the footnote text is left out; add footnotes with Substack's footnote button.
- **Alignment:** Substack can't center or right-align text, so `%%center%%` and `%%right%%` paragraphs are left-aligned. The window counts them.
- **Callouts, comments, tables and code blocks** are left out, as in the manuscript export.
- **Your byline** (a heading with your name under the title) is dropped: Substack shows the author on every post.

If the app you paste into only takes plain text, it receives a plain version with the same lines and paragraphs and `* * *` for scene breaks.
