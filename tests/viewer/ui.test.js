// The viewer's shared rendering helpers on the data of the fixture project (tests/fixtures/content-model.json).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadViewer } = require('./load');

// The row that leads to a key, with the label a field gets there and the pencil that marks it renamed.
const rowWithLabel = (key, label) => new RegExp(`data-go="${key}">(?=(?:(?!data-go).)*class="renamed")(?:(?!data-go).)*> ?${label}<`);

test('a page’s address is the site’s base URL with the URI', () => {
  const { byUid, siteUrl } = loadViewer();

  assert.equal(siteUrl(byUid.site['site-de'], 'aktuelles/{slug}'), 'https://museum.test/de/aktuelles/{slug}');
  assert.equal(siteUrl(byUid.site['site-shop'], 'products/{slug}'), 'https://shop.museum.test/products/{slug}');
});

test('the homepage’s address is the site’s base URL', () => {
  const { byUid, siteUrl } = loadViewer();

  assert.equal(siteUrl(byUid.site['site-en'], '__home__'), 'https://museum.test/');
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

  assert.match(html, /Element Type<\/span>/);
  assert.match(html, /<h2>Users<\/h2>/);
  assert.match(html, rowWithLabel('field:field-notes', 'Bio'));
});

test('a field a layout renames is listed under its name there, with the handle it gets there', () => {
  const { nodeOf, detailHTML } = loadViewer();
  const html = detailHTML(nodeOf('page:et-article'));

  assert.match(html, rowWithLabel('field:field-body', 'Introduction'));
  assert.match(html, /data-go="field:field-body">(?:(?!data-go).)*<code>intro<\/code>/);
  assert.doesNotMatch(html, rowWithLabel('field:field-page-builder', 'Page builder'));
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
  assert.match(chip('fieldlayout:addresses'), /Addresses <span class="faint">· Element Type<\/span>/);
  assert.doesNotMatch(chip('page:et-article'), /faint/);
});

test('field layouts outside the graph open in the Layout view', () => {
  const { crossLinks } = loadViewer();

  ['globalset:global-footer', 'volume:volume-images', 'categorygroup:catgroup-topics', 'taggroup:taggroup-keywords', 'fieldlayout:users', 'fieldlayout:addresses'].forEach(key => {
    assert.match(crossLinks(key, 'table'), new RegExp(`href="#layout/${key}">Open layout<`));
    assert.doesNotMatch(crossLinks(key, 'table'), /#graph\//);
  });
});

test('a search finds a name or a handle by any part of it, whatever its case', () => {
  const { byUid, matchesSearch } = loadViewer();
  const article = byUid.et['et-article'];

  assert.equal(matchesSearch(article, 'artic'), true);
  assert.equal(matchesSearch(article, 'page_'), true);
  assert.equal(matchesSearch(article, 'news'), false);
  assert.equal(matchesSearch(byUid.fieldlayout.users, 'user'), true);
});

test('an empty search finds everything', () => {
  const { byUid, matchesSearch } = loadViewer();

  assert.equal(matchesSearch(byUid.et['et-article'], ''), true);
});

test('a name or handle of its own that a section or Builder gives an entry type counts only if it differs', () => {
  const { byUid, usedName, usedHandle, isRenamed } = loadViewer();
  const quote = byUid.et['et-quote'];

  assert.equal(usedName({ label: 'Pull quote' }, quote), 'Pull quote');
  assert.equal(usedName({ label: 'Quote' }, quote), 'Quote');
  assert.equal(usedHandle({ handle: 'pullQuote' }, quote), 'pullQuote');
  assert.equal(usedHandle({ handle: 'quote' }, quote), '');
  assert.equal(isRenamed({ label: 'Quote', handle: 'quote' }, quote), false);
  assert.equal(isRenamed({}, quote), false);
});

test('a renamed entry type is noted as its name and handle there, in text', () => {
  const { byUid, renamedAs } = loadViewer();
  const teaser = byUid.et['et-teaser'];

  assert.equal(renamedAs({ label: 'Column teaser', handle: 'block_columnTeaser' }, teaser), 'as “Column teaser” block_columnTeaser');
  assert.equal(renamedAs({ label: 'Pull quote' }, byUid.et['et-quote']), 'as “Pull quote”');
  assert.equal(renamedAs({}, teaser), '');
});

test('the pencil of a renamed entry type says what it is', () => {
  const { byUid, renamedText } = loadViewer();

  assert.equal(renamedText({ label: 'Column teaser', handle: 'block_columnTeaser' }, byUid.et['et-teaser']), 'Renamed here to Column teaser (block_columnTeaser). The entry type is Teaser (block_teaser).');
});

test('a section lists its entry types under the name it gives them, with the pencil, and their handle', () => {
  const { byUid, sectionEntryTypes } = loadViewer();
  const html = sectionEntryTypes(byUid.section['section-news']);

  assert.match(html, rowWithLabel('page:et-article', 'News article'));
  assert.match(html, /data-go="page:et-link">(?:(?!data-go).)*<span class="note">page_link<\/span>/);
  assert.doesNotMatch(html, rowWithLabel('page:et-link', 'Link'));
});

test('a Block’s details name the Builders it is in, under the name and handle it gets there, or its group', () => {
  const { nodeOf, detailHTML } = loadViewer();

  assert.match(detailHTML(nodeOf('block:et-quote')), /data-go="matrix:field-page-builder">(?:(?!data-go).)*class="renamed"(?:(?!data-go).)* Pull quote<\/span>/);
  assert.match(detailHTML(nodeOf('block:et-teaser')), /data-go="matrix:field-columns">(?:(?!data-go).)*class="renamed"(?:(?!data-go).)* Column teaser <code>block_columnTeaser<\/code><\/span>/);
  assert.match(detailHTML(nodeOf('block:et-text')), /data-go="matrix:field-page-builder">(?:(?!data-go).)*<span class="note">Text<\/span>/);
});

test('a Builder’s details list its Blocks by group, under the name and handle each gets there', () => {
  const { nodeOf, detailHTML } = loadViewer();
  const html = detailHTML(nodeOf('matrix:field-page-builder'));
  const groups = [...html.matchAll(/<div class="sub-label"[^>]*>([^<]*)<\/div>/g)].map(m => m[1]);
  const blocks = [...html.slice(html.indexOf('<h3>Blocks')).matchAll(/data-go="(block|page):([^"]+)"/g)].map(m => m[2]);

  assert.deepEqual(groups, ['Text', 'Media', 'Layout']);
  assert.deepEqual(blocks.slice(0, 6), ['et-text', 'et-quote', 'et-image', 'et-link', 'et-teaser', 'et-columns']);
  assert.match(html, rowWithLabel('block:et-quote', 'Pull quote'));
  assert.match(detailHTML(nodeOf('matrix:field-columns')), /data-go="block:et-teaser">(?:(?!data-go).)*<code>block_columnTeaser<\/code>/);
});

test('a count agrees with its number', () => {
  const { count } = loadViewer();

  assert.deepEqual([0, 1, 2].map(n => count(n, 'field', 'fields')), ['0 fields', '1 field', '2 fields']);
  assert.equal(count(1, 'differs', 'differ'), '1 differs');
});

test('a section’s details say which sites it saves its entries to', () => {
  const { nodeOf, detailHTML } = loadViewer();

  assert.match(detailHTML(nodeOf('section:section-news')), /<h3>Propagation<\/h3><p[^>]*>Save entries to other sites in the same site group<\/p>/);
});

test('a section’s URLs say whether its new entries start out enabled on each site', () => {
  const { nodeOf, detailHTML } = loadViewer();
  const html = detailHTML(nodeOf('section:section-news'));

  assert.match(html, /English<\/span><code>news\/\{slug\}<\/code><span class="toggle on"[^>]*title="Enabled by default">/);
  assert.match(html, /Deutsch<\/span><code>aktuelles\/\{slug\}<\/code><span class="toggle"[^>]*title="Disabled by default">/);
});
