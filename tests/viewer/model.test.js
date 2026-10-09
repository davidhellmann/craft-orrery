// The viewer's model layer on the data of the fixture project (tests/fixtures/content-model.json).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadViewer } = require('./load');

const handles = list => list.map(item => item.handle);

test('entry types attached to a section are Pages, the others Blocks', () => {
  const { M } = loadViewer();

  assert.deepEqual(handles(M.entryTypes.filter(e => e.kind === 'page')), ['exhibition', 'page_article', 'page_link', 'page_person', 'page_product', 'single_home']);
  assert.deepEqual(handles(M.entryTypes.filter(e => e.kind === 'block')), ['block_columns', 'block_image', 'block_teaser', 'block_text', 'quote']);
});

test('an entry type attached to a section and to a Builder is a Page', () => {
  const { by } = loadViewer();

  assert.equal(by.et['et-link'].kind, 'page');
  assert.deepEqual(by.et['et-link'].builders.map(b => b.field.handle), ['pageBuilder']);
});

test('keys find every kind of node, and nothing for unknown ones', () => {
  const { nodeOf } = loadViewer();
  const found = key => { const n = nodeOf(key); return n && [n.kind, n.obj.handle || n.obj.name]; };

  assert.deepEqual(found('group:group-shop'), ['group', 'Shop']);
  assert.deepEqual(found('site:site-de'), ['site', 'de']);
  assert.deepEqual(found('section:section-news'), ['section', 'news']);
  assert.deepEqual(found('page:et-article'), ['page', 'page_article']);
  assert.deepEqual(found('block:et-quote'), ['block', 'quote']);
  assert.deepEqual(found('matrix:field-page-builder'), ['matrix', 'pageBuilder']);
  assert.deepEqual(found('field:field-body'), ['field', 'body']);
  assert.deepEqual(found('usergroup:ug-editors'), ['usergroup', 'editors']);
  assert.deepEqual(found('schema:gql-app'), ['schema', 'App']);
  assert.equal(nodeOf('section:section-archive'), null);
  assert.equal(nodeOf('volume:volume-images'), null);
  assert.equal(nodeOf(null), null);
});

test('site groups hold their sites, sites the sections on them', () => {
  const { by } = loadViewer();

  assert.deepEqual(handles(by.group['group-museum'].sites), ['en', 'de']);
  assert.deepEqual(handles(by.site['site-en'].sections), ['exhibitions', 'home', 'news', 'people']);
  assert.deepEqual(handles(by.site['site-shop'].sections), ['products']);
  assert.deepEqual(by.section['section-news'].groups, ['group-museum']);
  assert.equal(by.section['section-people'].hasUrls, false);
});

test('Matrix and ContentBlock fields are Builders', () => {
  const { M } = loadViewer();

  assert.deepEqual(handles(M.fields.filter(f => f.isBuilder)), ['columns', 'pageBuilder', 'seo']);
});

test('a Block knows the Builders it is in, with its name and group there', () => {
  const { by } = loadViewer();
  const builders = uid => by.et[uid].builders.map(b => [b.field.handle, b.context, b.group]);

  assert.deepEqual(builders('et-quote'), [['pageBuilder', 'Pull quote', 'Text']]);
  assert.deepEqual(builders('et-text'), [['columns', undefined, undefined], ['pageBuilder', undefined, 'Text']]);
  assert.deepEqual(builders('et-teaser'), [['columns', undefined, undefined], ['pageBuilder', undefined, undefined]]);
});

test('a field lists each layout it sits in, including ContentBlocks', () => {
  const { by } = loadViewer();
  const usedIn = uid => by.field[uid].usedIn.map(u => [u.ownerKind, u.owner.handle]);

  assert.deepEqual(usedIn('field-body'), [['block', 'block_text'], ['page', 'exhibition'], ['page', 'page_article'], ['page', 'page_link'], ['page', 'page_product'], ['block', 'quote']]);
  assert.deepEqual(usedIn('field-summary'), [['matrix', 'seo']]);
  assert.deepEqual(usedIn('field-image'), [['block', 'block_image'], ['page', 'page_person'], ['page', 'page_product'], ['matrix', 'seo']]);
  assert.equal(by.field['field-body'].usedIn.find(u => u.owner.handle === 'page_article').el.label, 'Introduction');
});

test('fields that no entry type or ContentBlock holds are unused', () => {
  const { unusedFields } = loadViewer();

  assert.deepEqual(handles(unusedFields), ['oldTeaser']);
});

test('an Entries field targets the sections it pulls from that still exist', () => {
  const { by } = loadViewer();

  assert.deepEqual(handles(by.field['field-related-news'].targets), ['news']);
  assert.deepEqual(handles(by.field['field-curators'].targets), ['people']);
  assert.deepEqual(handles(by.section['section-news'].referencedBy), ['relatedNews']);
  assert.deepEqual(handles(by.section['section-people'].referencedBy), ['curators']);
});

test('an Entries field open to every section targets none in particular', () => {
  const { by } = loadViewer();

  assert.equal(by.field['field-featured'].allSources, true);
  assert.deepEqual(by.field['field-featured'].targets, []);
  assert.equal(by.field['field-related-news'].allSources, false);
});

test('only Entries fields have relation targets', () => {
  const { by } = loadViewer();

  assert.deepEqual(by.field['field-image'].targets, []);
  assert.equal(by.field['field-image'].allSources, undefined);
});

test('a Block pulls content from the sections its fields target, through nested Builders too', () => {
  const { by, pullsFrom } = loadViewer();
  const pulls = uid => handles([...pullsFrom(by.et[uid])]);

  assert.deepEqual(pulls('et-teaser'), ['news']);
  assert.deepEqual(pulls('et-columns'), ['news']);
  assert.deepEqual(pulls('et-text'), []);
});

test('an entry type ends up on the sites of its sections, or of the Pages that hold its Builder', () => {
  const { by, sitesOfEt } = loadViewer();
  const sites = uid => [...sitesOfEt(by.et[uid])];

  assert.deepEqual(sites('et-product'), ['site-shop']);
  assert.deepEqual(sites('et-article'), ['site-en', 'site-de']);
  assert.deepEqual(sites('et-quote'), ['site-en', 'site-de']);
  assert.deepEqual(sites('et-text'), ['site-en', 'site-de']);
});

test('a field ends up in the site groups of the Pages and Blocks that hold it, through Builders too', () => {
  const { by, groupsOfField } = loadViewer();
  const groups = uid => [...groupsOfField(by.field[uid])].sort();

  assert.deepEqual(groups('field-body'), ['group-museum', 'group-shop']);
  assert.deepEqual(groups('field-related-news'), ['group-museum']);
  assert.deepEqual(groups('field-columns'), ['group-museum']);
  assert.deepEqual(groups('field-summary'), ['group-museum']);
  assert.deepEqual(groups('field-old-teaser'), []);
});

test('a site group has the fields of its Pages and of the Blocks that end up there', () => {
  const { M, groupsOfField } = loadViewer();
  const fieldsIn = group => handles(M.fields.filter(f => groupsOfField(f).has(group)));

  assert.deepEqual(fieldsIn('group-shop'), ['body', 'image']);
  assert.deepEqual(fieldsIn('group-museum'), ['body', 'columns', 'curators', 'featured', 'image', 'layoutStyle', 'pageBuilder', 'relatedNews', 'seo', 'summary']);
});

test('a handle passes if it starts with any of the prefixes for its kind', () => {
  const { by, checksHandles, unprefixedEntryTypes } = loadViewer({ prefixes: { page: ['page_', 'single_'], block: ['block_'] } });

  assert.equal(checksHandles, true);
  assert.deepEqual(handles(unprefixedEntryTypes), ['exhibition', 'quote']);
  assert.equal(by.et['et-home'].conventionOk, true);
  assert.equal(by.et['et-exhibition'].prefix, 'page_ / single_');
  assert.equal(by.et['et-quote'].prefix, 'block_');
});

test('a kind without prefixes skips the check', () => {
  const { unprefixedEntryTypes } = loadViewer({ prefixes: { block: ['block_'] } });

  assert.deepEqual(handles(unprefixedEntryTypes), ['quote']);
});

test('without prefixes, no handle is checked', () => {
  const { checksHandles, unprefixedEntryTypes } = loadViewer();

  assert.equal(checksHandles, false);
  assert.deepEqual(unprefixedEntryTypes, []);
});

test('a user group may edit its sites and has its rights on the sections of a Page', () => {
  const { by, rightsOn } = loadViewer();
  const editors = by.usergroup['ug-editors'];

  assert.deepEqual(rightsOn(editors, 'usergroup', 'site:site-en'), ['edit']);
  assert.equal(rightsOn(editors, 'usergroup', 'site:site-shop'), null);
  assert.deepEqual(rightsOn(editors, 'usergroup', 'section:section-home'), ['view', 'save']);
  assert.deepEqual(rightsOn(editors, 'usergroup', 'page:et-article'), ['view', 'create', 'save', 'delete', 'viewPeer', 'savePeer', 'viewPeerDrafts', 'deletePeerDrafts']);
  assert.equal(rightsOn(editors, 'usergroup', 'page:et-product'), null);
});

test('user group rights stop at Pages', () => {
  const { by, rightsOn } = loadViewer();
  const editors = by.usergroup['ug-editors'];

  assert.equal(rightsOn(editors, 'usergroup', 'matrix:field-page-builder'), null);
  assert.equal(rightsOn(editors, 'usergroup', 'block:et-text'), null);
  assert.equal(rightsOn(editors, 'usergroup', 'field:field-body'), null);
});

test('a schema reads its sites and has its rights on the sections of a Page', () => {
  const { by, rightsOn } = loadViewer();
  const app = by.schema['gql-app'];

  assert.deepEqual(rightsOn(app, 'schema', 'site:site-shop'), ['read']);
  assert.equal(rightsOn(app, 'schema', 'site:site-en'), null);
  assert.deepEqual(rightsOn(app, 'schema', 'page:et-product'), ['read', 'create', 'save', 'delete']);
  assert.equal(rightsOn(app, 'schema', 'page:et-article'), null);
});

test('a schema has its rights on a Builder and on the Blocks in it', () => {
  const { by, rightsOn } = loadViewer();
  const app = by.schema['gql-app'], pub = by.schema['gql-public'];

  assert.deepEqual(rightsOn(app, 'schema', 'matrix:field-page-builder'), ['read', 'save']);
  assert.deepEqual(rightsOn(app, 'schema', 'block:et-quote'), ['read', 'save']);
  assert.deepEqual(rightsOn(pub, 'schema', 'block:et-quote'), ['read']);
  assert.equal(rightsOn(pub, 'schema', 'matrix:field-seo'), null);
  assert.equal(rightsOn(app, 'schema', 'field:field-body'), null);
});

test('a Block in several Builders gets the rights of all of them', () => {
  const { by, rightsOn } = loadViewer();

  assert.deepEqual(rightsOn(by.schema['gql-app'], 'schema', 'block:et-text'), ['read', 'save']);
  assert.deepEqual(rightsOn(by.schema['gql-public'], 'schema', 'block:et-text'), ['read']);
});
