// Runs the viewer's scripts in Node the way the page does (see src/services/Viewer.php): the data in the global CONTENT_MODEL, the
// scripts in one shared scope. The views only draw once the app shell mounts them, so they load too; the app shell starts
// drawing right away, so it stays out.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '../..');

// The page's scripts in their order, as Viewer::SCRIPTS lists them in the plugin at `root`.
function pageScripts(root = ROOT) {
  const viewer = fs.readFileSync(path.join(root, 'src/services/Viewer.php'), 'utf8');
  return [...viewer.match(/SCRIPTS = \[([^\]]*)\]/)[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
}

// Loads the scripts up to the app shell on a fresh copy of the fixture data (tests/fixtures/content-model.json, written by
// the PHP tests), with handle prefixes as the plugin settings add them. `root` is the plugin to load, this one by default.
// Returns the shared scope, so `const { model, rightsOn } = loadViewer()` reads those names from inside it.
function loadViewer({ prefixes = {}, root = ROOT } = {}) {
  const data = JSON.parse(fs.readFileSync(path.join(root, 'tests/fixtures/content-model.json'), 'utf8'));
  const window = { CONTENT_MODEL: { ...data, prefixes: { page: [], block: [], ...prefixes } } };
  const scripts = pageScripts(root);
  const sources = scripts.slice(0, scripts.indexOf('app')).map(name => fs.readFileSync(path.join(root, 'src/viewer', `${name}.js`), 'utf8'));
  // Wrapped as Viewer::script() does, plus a way back into the scope.
  const source = `(window => {\n'use strict';\n${sources.join('\n')}\nreturn name => eval(name);\n})`;
  const scope = vm.runInThisContext(source, { filename: 'viewer.js' })(window);

  return new Proxy({}, { get: (_, name) => (typeof name === 'string' ? scope(name) : undefined) });
}

module.exports = { loadViewer, pageScripts };
