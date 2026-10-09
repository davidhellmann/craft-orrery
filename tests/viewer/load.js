// Runs the viewer's scripts in Node the way the page does (see src/services/Viewer.php): the data in the global CONTENT_MODEL, the
// language and messages in ORRERY_I18N, the scripts in one shared scope. The views only draw once the app shell mounts them, so they load too; the app shell starts
// drawing right away, so it stays out.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const VIEWER = path.join(__dirname, '../../src/viewer');
// The page's scripts in their order, as Viewer::SCRIPTS lists them, up to the app shell.
const PAGE_SCRIPTS = [...fs.readFileSync(path.join(__dirname, '../../src/services/Viewer.php'), 'utf8').match(/SCRIPTS = \[([^\]]*)\]/)[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
const SCRIPTS = PAGE_SCRIPTS.slice(0, PAGE_SCRIPTS.indexOf('app'));
// The data of tests/fixtures/project.yaml, written by the PHP tests.
const FIXTURE = path.join(__dirname, '../fixtures/content-model.json');

// Loads the scripts on a fresh copy of the fixture data, with handle prefixes as the plugin settings add them, in a
// language with the messages the server translated into it. Without messages, every message is its English.
// Returns the shared scope, so `const { model, rightsOn } = loadViewer()` reads those names from inside it.
function loadViewer({ prefixes = {}, language = 'en-US', messages = {} } = {}) {
  const data = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
  const window = { CONTENT_MODEL: { ...data, prefixes: { page: [], block: [], ...prefixes } }, ORRERY_I18N: { language, messages } };
  const sources = SCRIPTS.map(name => fs.readFileSync(path.join(VIEWER, `${name}.js`), 'utf8'));
  // Wrapped as Viewer::script() does, plus a way back into the scope.
  const source = `(window => {\n'use strict';\n${sources.join('\n')}\nreturn name => eval(name);\n})`;
  const scope = vm.runInThisContext(source, { filename: 'viewer.js' })(window);

  return new Proxy({}, { get: (_, name) => (typeof name === 'string' ? scope(name) : undefined) });
}

module.exports = { loadViewer };
