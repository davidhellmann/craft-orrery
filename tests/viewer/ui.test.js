// The viewer's shared rendering helpers on the data of the fixture project (tests/fixtures/content-model.json).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadViewer } = require('./load');

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
