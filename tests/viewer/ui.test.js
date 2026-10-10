// The viewer's shared rendering helpers on the data of the fixture project (tests/fixtures/content-model.json).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadViewer } = require('./load');

// The row that leads to a key, with the label a field gets there.
const rowWithLabel = (key, label) => new RegExp(`data-go="${key}">(?:(?!data-go).)*“${label}”`);

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

test('a name of its own that a section or Builder gives an entry type counts only if it differs', () => {
  const { byUid, perUseName } = loadViewer();
  const quote = byUid.et['et-quote'];

  assert.equal(perUseName(quote, 'Pull quote'), 'Pull quote');
  assert.equal(perUseName(quote, 'Quote'), '');
  assert.equal(perUseName(quote, undefined), '');
});

test('an entry type with a name of its own somewhere is noted as that name there', () => {
  const { byUid, perUseNote } = loadViewer();
  const quote = byUid.et['et-quote'];

  assert.equal(perUseNote(quote, 'Pull quote'), 'as “Pull quote”');
  assert.equal(perUseNote(quote, 'Quote'), '');
});

test('a section lists its entry types under the name it gives them, the others with their handle', () => {
  const { byUid, sectionEntryTypes } = loadViewer();
  const html = sectionEntryTypes(byUid.section['section-news']);

  assert.match(html, /data-go="page:et-article">(?:(?!data-go).)*<span class="note">as “News article”<\/span>/);
});

test('a Block’s details name the Builders it is in, under the name it gets there, or its group', () => {
  const { nodeOf, detailHTML } = loadViewer();
  const html = detailHTML(nodeOf('block:et-quote'));

  assert.match(html, /data-go="matrix:field-page-builder">(?:(?!data-go).)*<span class="note">as “Pull quote”<\/span>/);
  assert.match(detailHTML(nodeOf('block:et-text')), /data-go="matrix:field-page-builder">(?:(?!data-go).)*<span class="note">Text<\/span>/);
});

test('a Builder’s details list its Blocks by group, under the name each gets there', () => {
  const { nodeOf, detailHTML } = loadViewer();
  const html = detailHTML(nodeOf('matrix:field-page-builder'));
  const groups = [...html.matchAll(/<div class="sub-label"[^>]*>([^<]*)<\/div>/g)].map(m => m[1]);
  const blocks = [...html.slice(html.indexOf('<h3>Blocks')).matchAll(/data-go="(block|page):([^"]+)"/g)].map(m => m[2]);

  assert.deepEqual(groups, ['Text', 'Media', 'Layout']);
  assert.deepEqual(blocks.slice(0, 6), ['et-text', 'et-quote', 'et-image', 'et-link', 'et-teaser', 'et-columns']);
  assert.match(html, /data-go="block:et-quote">(?:(?!data-go).)*<span class="note">as “Pull quote”<\/span>/);
});

test('a count agrees with its number', () => {
  const { count } = loadViewer();

  assert.deepEqual([0, 1, 2].map(n => count(n, 'field', 'fields')), ['0 fields', '1 field', '2 fields']);
  assert.equal(count(1, 'differs', 'differ'), '1 differs');
});
