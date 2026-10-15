// The viewer's views as they register themselves, on the data of the fixture project (tests/fixtures/content-model.json).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadViewer } = require('./load');

// The buttons in a node's details that lead to other views: [where to, what it says].
const links = html => [...html.matchAll(/href="#(\w+)\/[^"]*">([^<]+)</g)].map(m => [m[1], m[2]]);

test('every view registers itself, in the order of the scripts', () => {
  const { VIEWS } = loadViewer();

  assert.deepEqual(VIEWS.map(v => [v.id, v.label]), [['graph', 'Graph'], ['table', 'Table'], ['layout', 'Layout'], ['diff', 'Diff']]);
});

test('each view says what it is and how to read it', () => {
  const { VIEWS } = loadViewer();

  assert.deepEqual(VIEWS.map(v => /<h2>([^<]+)<\/h2>/.exec(v.info())[1]), ['Reading the map', 'The content model as lists', 'Field layouts', 'Reading a comparison']);
});

test('details lead to the other views that have a place for their kind', () => {
  const { crossLinks } = loadViewer();

  assert.deepEqual(links(crossLinks('page:et-article', 'graph')), [['table', 'Show in table'], ['layout', 'Open layout'], ['diff', 'Compare']]);
  assert.deepEqual(links(crossLinks('field:field-body', 'layout')), [['graph', 'Show in graph'], ['table', 'Show in table'], ['diff', 'Compare']]);
  assert.deepEqual(links(crossLinks('section:section-news', 'table')), [['graph', 'Show in graph'], ['layout', 'Open layout'], ['diff', 'Compare']]);
  assert.deepEqual(links(crossLinks('site:site-de', 'graph')), [['table', 'Show in table'], ['diff', 'Compare']]);
  assert.deepEqual(links(crossLinks('group:group-shop', 'graph')), [['table', 'Show in table']]);
  assert.deepEqual(links(crossLinks('unused:et-promo', 'diff')), [['table', 'Show in table'], ['layout', 'Open layout']]);
  assert.deepEqual(links(crossLinks('usergroup:ug-editors', 'layout')), [['graph', 'Show in graph'], ['table', 'Show in table'], ['diff', 'Compare']]);
  assert.deepEqual(links(crossLinks('globalset:global-footer', 'graph')), [['table', 'Show in table'], ['layout', 'Open layout']]);
});

test('something no view knows leads nowhere', () => {
  const { crossLinks } = loadViewer();

  assert.equal(crossLinks('nope:nothing', 'graph'), '');
});

test('a view added later leads from the details of the kinds it has a place for, with nothing else to change', () => {
  const { registerView, crossLinks, VIEWS } = loadViewer();
  registerView({ id: 'sitemap', label: 'Sitemap', crossLink: 'Show in sitemap', kinds: ['site', 'section'], info: () => '<h2>Sitemap</h2>', mount() {}, show() {} });

  assert.deepEqual(links(crossLinks('site:site-de', 'graph')), [['table', 'Show in table'], ['diff', 'Compare'], ['sitemap', 'Show in sitemap']]);
  assert.deepEqual(links(crossLinks('page:et-article', 'graph')), [['table', 'Show in table'], ['layout', 'Open layout'], ['diff', 'Compare']]);
  assert.equal(VIEWS.at(-1).label, 'Sitemap');
});

test('the graph’s legend only shows what is on the map', () => {
  const { VIEWS } = loadViewer();
  const legend = /<div class="legend">(.*?)<\/div>/s.exec(VIEWS.find(v => v.id === 'graph').info())[1];

  assert.deepEqual([...legend.matchAll(/<\/span>([^<]+)<\/span>/g)].map(m => m[1]), ['Site Groups', 'Sites', 'Sections', 'Pages', 'Builders', 'Blocks', 'Fields']);
});
