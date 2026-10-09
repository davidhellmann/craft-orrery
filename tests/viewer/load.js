// Runs the viewer's model layer in Node the way the page does (see src/services/Viewer.php): the data in the global
// CONTENT_MODEL, the scripts in one shared scope. The views draw on the page, so they stay out.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SCRIPTS = ['model'];
const VIEWER = path.join(__dirname, '../../src/viewer');
// The data of tests/fixtures/project.yaml, written by the PHP tests.
const FIXTURE = path.join(__dirname, '../fixtures/content-model.json');

// Loads the scripts on a fresh copy of the fixture data, with handle prefixes as the plugin settings add them.
// Returns the shared scope, so `const { M, rightsOn } = loadViewer()` reads those names from inside it.
function loadViewer({ prefixes = {} } = {}) {
  const data = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
  const window = { CONTENT_MODEL: { ...data, prefixes: { page: [], block: [], ...prefixes } } };
  const sources = SCRIPTS.map(name => fs.readFileSync(path.join(VIEWER, `${name}.js`), 'utf8'));
  // Wrapped as Viewer::script() does, plus a way back into the scope.
  const source = `(window => {\n'use strict';\n${sources.join('\n')}\nreturn name => eval(name);\n})`;
  const scope = vm.runInThisContext(source, { filename: 'viewer.js' })(window);

  return new Proxy({}, { get: (_, name) => (typeof name === 'string' ? scope(name) : undefined) });
}

module.exports = { loadViewer };
