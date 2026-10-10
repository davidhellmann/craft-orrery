// Shared links carry a view id and a kind key (#<view>/<kind>:<uid>, see docs/viewer.md). People bookmark and send them,
// so those names stay as they are; a new name for something goes into its label. The lists here are the names links
// use, and a view or kind added later joins them, so it's pinned from its first release.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadViewer } = require('./load');

function assertPinned(what, names, pinned) {
  const gone = pinned.filter(name => !names.includes(name));
  const added = names.filter(name => !pinned.includes(name));
  assert.ok(!gone.length, `Gone from the ${what}: ${gone.join(', ')}. Links people shared with them would break: keep the old name, and put a new one in the label.`);
  assert.ok(!added.length, `New in the ${what}: ${added.join(', ')}. Add it to the list in this test, so it's pinned from its first release.`);
}

test('shared links keep their view ids', () => {
  const { VIEWS } = loadViewer();

  assertPinned('view ids', VIEWS.map(v => v.id), ['graph', 'table', 'layout', 'diff']);
});

test('shared links keep their kind keys', () => {
  const { KIND } = loadViewer();

  assertPinned('kind keys', Object.keys(KIND), [
    'group', 'site', 'section', 'page', 'matrix', 'block', 'field', 'unused', 'usergroup', 'schema',
    'globalset', 'volume', 'categorygroup', 'taggroup', 'fieldlayout',
  ]);
});
