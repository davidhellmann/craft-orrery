# Release Notes for Orrery

## 2.0.0-alpha.1 - Unreleased

### Changed
- Orrery now requires Craft CMS 6 and PHP 8.5. Orrery 1.x stays the version for Craft CMS 5.
- Orrery runs on Craft 6 directly, without the Yii 2 adapter.
- The export command is now `php artisan orrery:export`.
- Settings overrides go in `config/craft/orrery.php`, where Craft 6 looks for plugin config files.
- User group permissions are read whether the project config stores them lowercased, as Craft 5 did, or as Craft 6 names them.

## 1.0.0 - 2026-10-13

### Added
- Control panel section with four views of the content model: Graph, Table, Layout and Diff.
- Fullscreen, open in a new tab, and download as a standalone HTML file.
- `orrery/export` console command that writes the viewer as HTML or the data as JSON.
- Settings to flag entry type handles without a given prefix.
- Access layer that shows what user groups and GraphQL schemas can reach, across every view.
