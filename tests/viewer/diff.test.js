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

test('two sections compare where they save their entries', () => {
  const { props } = compare(loadViewer(), 'section:section-news', 'section:section-exhibitions');
  const propagation = props.find(p => p.label === 'Propagation');

  assert.deepEqual([propagation.x, propagation.y, propagation.status], [
    'Save entries to other sites in the same site group',
    'Save entries to all sites enabled for this section',
    'changed',
  ]);
});

test('two sections compare whether their new entries start out enabled on a site', () => {
  const { groups } = compare(loadViewer(), 'section:section-news', 'section:section-exhibitions');
  const deutsch = groups.find(g => g.key === 'sites').rows.find(r => r.ref.id === 'site:site-de');

  assert.deepEqual([deutsch.x.tags, deutsch.y.tags], [['aktuelles/{slug}', 'Disabled by default'], ['ausstellungen/{slug}', 'Enabled by default']]);
});
