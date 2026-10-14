# Note properties

Authors Toolbox reads a few properties from a note's front matter. None are required; each one switches on or tunes a feature.

```yaml
---
type: story            # story, poem, script, article, anthology…
lang: es               # es, en-US, en-GB (empty: auto-detect)
genre: [terror, cuento urbano]
anthology: "[[Ciudad perdida]]"
order: 3
word_goal: 3000
status: draft
---
```

## What each property does

| Property | Values | Used by |
|---|---|---|
| `type` | `story` | Turns on the [dialogue dash](Formatting-tools#spanish-dialogue-dash-raya). Counted as the form *Story* in [writing habits](Writing-habits). |
| | `poem` (or `poema`, `poesía`) | Turns on [poetry mode](Poetry). |
| | `script` (or `screenplay`, `guion`) | Turns on [screenplay mode](Screenplays). Scripts made by the plugin also get `cssclasses: [screenplay]`. |
| | `anthology` | Makes the note a project: exporting it exports its stories ([Manuscript export](Manuscript-export#whole-projects)). |
| | anything else (`article`, `essay`…) | The form in the habits breakdown. |
| `cssclasses` | `poem` / `screenplay` | Another way to turn on poetry or screenplay layout. |
| `lang` | `es`, `en`, `en-US`, `en-GB` | The language of the note for statistics, readability, style rules, the grammar check, hyphenation and export labels (*FIN* / *END*). Set it from the panel's language menu. |
| `genre` (or `genres`, `género`) | one value or a list | Genres in [writing habits](Writing-habits#genres-what-you-write-most). |
| `anthology` | a link or a list of links | The project(s) the work belongs to, for project export and the habits breakdown. |
| `order` | a number | Position of the note in a project export. Then `date_created`, then name. |
| `date_created` | a date | Second sort key in project exports. |
| `word_goal` | a number | Word goal in the Stats tab; on a project note, the project's goal. |
| `title` | text | The title in exports and on a script's title page (instead of the first heading). |
| `pseudonym` | text | Pen name for the contest layout of this note (overrides the setting). |
| `format` | `short`, `feature`, `pilot` (`corto`, `largo`, `piloto`, `tv`) | Typical page range in a script's Script tab. |
| `credit`, `author`, `adapted_from`, `draft_date`, `contact` | text | Title page of a `.fountain` export. |
| `status` | anything | Not used by the plugin; shown here because the templates include it, and it's kept when you restore a draft. |

## Folders instead of properties

If you'd rather not add properties:

- notes in the **story folders** (setting) count as stories;
- **writing folders** decide which notes the habits breakdowns and daily drafts cover.
