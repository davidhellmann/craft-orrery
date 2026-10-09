// The viewer's shared rendering helpers on the data of the fixture project (tests/fixtures/content-model.json).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadViewer } = require('./load');

// The row that leads to a key, with the label a field gets there.
const rowWithLabel = (key, label) => new RegExp(`data-go="${key}">(?:(?!data-go).)*“${label}”`);

test('a page’s address is the site’s base URL with the URI', () => {
  const { by, siteUrl } = loadViewer();

  assert.equal(siteUrl(by.site['site-de'], 'aktuelles/{slug}'), 'https://museum.test/de/aktuelles/{slug}');
  assert.equal(siteUrl(by.site['site-shop'], 'products/{slug}'), 'https://shop.museum.test/products/{slug}');
});

test('the homepage’s address is the site’s base URL', () => {
  const { by, siteUrl } = loadViewer();

  assert.equal(siteUrl(by.site['site-en'], '__home__'), 'https://museum.test/');
});

test('a site without a base URL shows its name instead', () => {
  const { siteUrl } = loadViewer();

  assert.equal(siteUrl({ name: 'Intranet', baseUrl: null }, 'news/{slug}'), 'Intranet/news/{slug}');
});

test('a global set’s details name what it is and list its fields, with the label they get there', () => {
  const { nodeOf, detailHTML } = loadViewer();
  const html = detailHTML(nodeOf('globalset:global-footer'));

  assert.match(html, /Global Set<\/span>/);
  assert.match(html, /<h2>Footer<\/h2>/);
  assert.match(html, /<h3>Fields \(1\)<\/h3>/);
  assert.match(html, rowWithLabel('field:field-copyright', 'Copyright line'));
});

test('the users’ field layout has details of its own', () => {
  const { nodeOf, detailHTML } = loadViewer();
  const html = detailHTML(nodeOf('fieldlayout:users'));

  assert.match(html, /Field Layout<\/span>/);
  assert.match(html, /<h2>Users<\/h2>/);
  assert.match(html, rowWithLabel('field:field-notes', 'Bio'));
});

test('a field’s details list every field layout it sits in, with the label it gets there', () => {
  const { nodeOf, detailHTML } = loadViewer();
  const html = detailHTML(nodeOf('field:field-notes'));

  assert.match(html, /<h3>Used in \(5\)<\/h3>/);
  ['volume:volume-images', 'categorygroup:catgroup-topics', 'taggroup:taggroup-keywords', 'fieldlayout:users', 'fieldlayout:addresses'].forEach(key => assert.match(html, new RegExp(`data-go="${key}"`)));
  assert.match(html, rowWithLabel('volume:volume-images', 'Caption'));
  assert.match(html, rowWithLabel('fieldlayout:addresses', 'Directions'));
});

test('a field layout that isn’t on the graph says what it is wherever it’s listed', () => {
  const { chip, row } = loadViewer();

  assert.match(chip('globalset:global-footer'), /Footer <span class="faint">· Global Set<\/span>/);
  assert.match(row('volume:volume-images'), /Images <span class="faint">· Volume<\/span>/);
  assert.match(chip('fieldlayout:addresses'), /Addresses <span class="faint">· Field Layout<\/span>/);
  assert.doesNotMatch(chip('page:et-article'), /faint/);
});

test('the graph’s legend only shows what is on the map', () => {
  const { legendHTML } = loadViewer();

  assert.deepEqual([...legendHTML().matchAll(/<\/span>([^<]+)<\/span>/g)].map(m => m[1]), ['Site Groups', 'Sites', 'Sections', 'Pages', 'Builders', 'Blocks', 'Fields']);
});
