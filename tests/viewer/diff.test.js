// The Diff view's comparisons on the data of the fixture project (tests/fixtures/content-model.json).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadViewer } = require('./load');

const compare = (viewer, a, b) => viewer.VIEWS.find(v => v.id === 'diff').compare(a, b);

test('two sites compare property by property', () => {
  const { props } = compare(loadViewer(), 'site:site-en', 'site:site-de');

  assert.deepEqual(props.map(p => [p.label, p.x, p.y, p.status]), [
    ['Handle', 'en', 'de', 'changed'],
    ['Site Group', 'Museum', 'Museum', 'same'],
    ['Language', 'en-GB', 'de-DE', 'changed'],
    ['Base URL', 'https://museum.test/', 'https://museum.test/de/', 'changed'],
    ['Primary', 'Yes', 'No', 'changed'],
  ]);
});
