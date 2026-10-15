# The viewer

What the code doesn't say by itself. For what it does say, read the code: each script opens with what it's for.

## One shared scope

`Viewer::SCRIPTS` in `src/services/Viewer.php` lists the scripts in `src/viewer/`, and `Viewer::script()` joins them, in that order, into one function. So every top-level name of every script lives in one scope, and a script can use what an earlier one defines when it runs. A view script that runs before `model` breaks. Nothing is a module, and nothing is exported. The page sets `window.CONTENT_MODEL` before the scripts run, and that's all they get from outside.

The Node tests load the scripts the same way. `tests/viewer/load.js` reads the order from `Viewer::SCRIPTS`, so a new script is listed once, there.

`npm run check` type-checks the scripts as one scope too, with TypeScript on the plain JavaScript (`tsconfig.json`, and `src/viewer/page.d.ts` for `window.CONTENT_MODEL`). Where the checker can't tell an element's type, a JSDoc cast says it (`/** @type {HTMLInputElement} */ (ev.target)`). What it lets through:

- **Order.** A script that uses a later one's name while it loads passes the check and breaks the page.
- **Too few arguments.** To the checker, a JavaScript function's parameters are all optional. Too many arguments fail.
- **The browser's own names.** A name the scripts never define but the browser does, like `name` or `status`, resolves to the browser's.
- **Unused top-level names.** To the checker they're globals. `tests/viewer/scripts.test.js` catches them instead.

## Where things go

- **Something every kind has** (its name, its index, what it reaches, what owns a field layout) goes into the `KIND` map in `model.js`. Code that treats a group of kinds alike asks the map (`isEntryType`, `isField`, `isLayoutOwner`) instead of listing kind names, so a new kind is one entry there and lands in its group everywhere. Its key also goes into the list in `tests/viewer/links.test.js` (see Links).
- **A view** is one script that calls `registerView()` (described above it in `ui.js`) and gets its entry in `Viewer::SCRIPTS`. The header, the cross links between views and the routing come from the registrations. In the viewer nothing else needs an edit, and its id goes into the list in `tests/viewer/links.test.js` (see Links).
- **Something shared by several views** goes into `ui.js`.

## Two shapes of the data

`ContentModel::fromConfig()` gives the raw content model by default. That's what the JSON export writes: config values as written (`$PRIMARY_SITE_URL`, `@web`), with no timestamp, so the file only changes when the content model does, and never holds a resolved secret. With `forViewer: true` it gives what the viewer shows: references resolved, plus `dateModified`. `Viewer::render()` adds the handle prefixes from the plugin settings. Data only the viewer needs goes behind `forViewer`.

## The fixture

`tests/fixtures/project.yaml` is a made-up project config. `ContentModelTest` turns it into `tests/fixtures/content-model.json`, the viewer's data, and the Node tests run the scripts on that file. The PHP test fails when the JSON no longer matches the config or the code. After you change either, run `UPDATE_FIXTURES=1 composer test` and commit both files. Keep the fixture synthetic: it is never a real project's config.

## Links

A link is `#<view>/<kind>:<uid>`, for example `#graph/page:<uid>`. The Diff also takes two keys (`#diff/<key>/<key>`) or one of its types (`#diff/<type>`). The Graph also takes a field or entry type that a field layout, section or Matrix field gives a handle of its own, which is a node of its own there: `#graph/field:<uid>@<handle>`, `#graph/block:<uid>@<handle>`. Everywhere else it's the field's or entry type's key. People share and bookmark these links, so view ids, kind keys and the Diff's type ids stay as they are, even where the UI says something else: the kind `matrix` is labelled Builder, and `fieldlayout` is labelled Element Type. A new name goes into the label. `tests/viewer/links.test.js` pins the view ids and kind keys. The Diff's type ids live inside its script, so no test pins them.

## Before and after

`npm run snapshots -- <ref>` compares what the viewer shows in the working tree with what it showed at `<ref>` (`HEAD` by default): every view, and a deep link to every item in each view that has a place for it, in headless Chromium. Each page opens twice: plain, and with every access layer on and the info card open. It fails on any difference and on any console error. Run it after a change to the viewer: a refactor should leave it green, and a change that's meant to show should differ only where it's meant to. If it finds no Chromium, `npx playwright-core install chromium-headless-shell` gets one.

Both pages are built by the working tree's `tests/snapshots/page.php`, from each side's template, styles, scripts and fixture, the way `Viewer::render()` builds them. So a change to `render()` or `script()` itself doesn't show here, and `page.php` has to follow it.
