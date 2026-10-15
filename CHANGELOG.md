# Release Notes for Orrery

## 2.0.0-alpha.1 - Unreleased

### Changed
- Orrery now requires Craft CMS 6 and PHP 8.5. Orrery 1.x stays the version for Craft CMS 5.
- Orrery runs on Craft 6 directly, without the Yii 2 adapter.
- The export command is now `php artisan orrery:export`.
- Settings overrides go in `config/craft/orrery.php`, where Craft 6 looks for plugin config files.
- User group permissions are read whether the project config stores them lowercased, as Craft 5 did, or as Craft 6 names them.

## 1.0.3 - 2026-10-15

### Added
- Entry types show the colour Craft gives them: on the left edge of their node in the Graph, and in their glyph everywhere else.

### Changed
- Handles and labels in Graph nodes are smaller.
- Access marks in the Graph sit inside their node, in the bottom right.
- A user group’s and a schema’s access marks sit closer together.

## 1.0.2 - 2026-10-15

### Added
- Nodes in the Graph show their handle under their name.
- Entry types that a section or Matrix field renames are marked with the pencil too, under the name and handle they get there, in every view. In the Graph, one that gets a handle of its own there has a node of its own.

## 1.0.1 - 2026-10-15

### Added
- Fields that a field layout renames are marked with a pencil, the way Craft marks them, with the original field in a tooltip. Tables, details and layouts show them under the name they get there.
- In the Graph, a field that a field layout gives a handle of its own has a node of its own.
- In the Graph, a selected node moves to the middle and zooms in so it can be read.

### Changed
- In the Table, the row and the chip you picked stay marked while their details are open.
- Unselected nodes in the Graph are easier to read.
- Dropdowns have more room around their arrow.

### Fixed
- Double-clicking an empty spot in the Graph to zoom no longer clears the selection.
- Switching the site group in the Graph now updates it when nothing is selected, and while Isolate is on.

## 1.0.0 - 2026-10-13

### Added
- Control panel section with four views of the content model: Graph, Table, Layout and Diff.
- Fullscreen, open in a new tab, and download as a standalone HTML file.
- `orrery/export` console command that writes the viewer as HTML or the data as JSON.
- Settings to flag entry type handles without a given prefix.
- Access layer that shows what user groups and GraphQL schemas can reach, across every view.
