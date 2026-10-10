// What the type check can't see in the viewer's scripts. They share one scope, so to the checker every top-level name is a
// global someone else might use, and an unused one passes (docs/viewer.md). This test reads the scripts instead.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pageScripts } = require('./load');

const VIEWER = path.join(__dirname, '../../src/viewer');
// Block comments, and line comments that don't start inside a URL or a string.
const withoutComments = source => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');

test('every top-level name of the viewer’s scripts is used', () => {
  const sources = pageScripts().map(name => [name, withoutComments(fs.readFileSync(path.join(VIEWER, `${name}.js`), 'utf8'))]);
  const all = sources.map(([, source]) => source).join('\n');
  const mentions = id => all.match(new RegExp(`(?<![\\w$.])${id.replace(/\$/g, '\\$')}(?![\\w$])`, 'g')).length;
  const unused = sources.flatMap(([name, source]) => [...source.matchAll(/^(?:const|let|function)\s+([\w$]+)/gm)]
    .map(m => m[1])
    .filter(id => mentions(id) < 2)
    .map(id => `${id} in ${name}.js`));

  assert.deepEqual(unused, [], `Declared but never used: ${unused.join(', ')}.`);
});
