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

// A language may say two things with one word, like German "Volumen" for one volume and for several.
test('properties stay apart when the language words them alike', () => {
  const { props } = compare(loadViewer({ language: 'de', messages: { Handle: 'Kennung', Language: 'Kennung' } }), 'site:site-en', 'site:site-de');

  assert.deepEqual(props.slice(0, 3).map(p => [p.label, p.x, p.y]), [['Kennung', 'en', 'de'], ['Site Group', 'Museum', 'Museum'], ['Kennung', 'en-GB', 'de-DE']]);
});

test('groups stay apart when the language words them alike', () => {
  const { groups } = compare(loadViewer({ language: 'de', messages: { 'Lives in': 'Inhalt', Fields: 'Inhalt' } }), 'page:et-article', 'page:et-person');

  assert.deepEqual(groups.slice(0, 2).map(g => [g.title, g.rows.length]), [['Inhalt', 3], ['Inhalt', 4]]);
});
