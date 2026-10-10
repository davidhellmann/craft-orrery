# Coding standards

What a reviewer judges, because no tool can. Everything a tool can check is in the CI workflow instead.

## Per-kind behaviour lives in one place

What differs between kinds belongs in the `KIND` map (`src/viewer/model.js`) or in a view's `registerView()` entry. It doesn't belong in another chain of `kind === '…'` checks.

*Why:* a new kind should be one entry, not a hunt through every view. Review-fixes 04 removed such chains, and new ones crept back in.
*Follows it:* the Table's `kinds`, `Object.keys(KIND).filter(k => isField(k) || isEntryType(k) || isLayoutOwner(k))`, which picks up any new field, entry type or layout owner by itself.

## One meaning, one wording

A thing has the same name everywhere in the UI, the README and the control panel. The kinds' names are their `KIND` labels, in headings and prose as well.

*Why:* a reader who sees two words assumes two things. Builder used to have three names.
*Follows it:* the "as “…”" note for a per-use name, written only in `perUseNote()` (`src/viewer/ui.js`).

## Viewer-only data goes behind `forViewer`

Data only the viewer needs, such as resolved environment values or dates, comes from `ContentModel::fromConfig()` with `forViewer: true`. The default stays the raw export.

*Why:* the JSON export is shared and kept in version control. It must hold no resolved secrets, and it should change only when the content model does.
*Follows it:* `dateModified` and the resolved site URLs, both added only for the viewer in `fromConfig()`.
