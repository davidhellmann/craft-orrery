// The viewer's model layer on the data of the fixture project (tests/fixtures/content-model.json).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadViewer } = require('./load');

const handles = list => list.map(item => item.handle);

test('entry types attached to a section are Pages, to a Matrix field Blocks, and to neither unused', () => {
  const { model } = loadViewer();

  assert.deepEqual(handles(model.entryTypes.filter(e => e.kind === 'page')), ['exhibition', 'page_article', 'page_link', 'page_person', 'page_product', 'single_home']);
  assert.deepEqual(handles(model.entryTypes.filter(e => e.kind === 'block')), ['block_columns', 'block_image', 'block_teaser', 'block_text', 'quote']);
  assert.deepEqual(handles(model.entryTypes.filter(e => e.kind === 'unused')), ['oldPromo']);
});

test('an entry type attached to a section and to a Builder is a Page', () => {
  const { byUid } = loadViewer();

  assert.equal(byUid.et['et-link'].kind, 'page');
  assert.deepEqual(byUid.et['et-link'].builders.map(b => b.field.handle), ['pageBuilder']);
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
  assert.deepEqual(found('unused:et-promo'), ['unused', 'oldPromo']);
  assert.deepEqual(found('usergroup:ug-editors'), ['usergroup', 'editors']);
  assert.deepEqual(found('schema:gql-app'), ['schema', 'App']);
  assert.deepEqual(found('globalset:global-footer'), ['globalset', 'footer']);
  assert.deepEqual(found('volume:volume-images'), ['volume', 'images']);
  assert.deepEqual(found('categorygroup:catgroup-topics'), ['categorygroup', 'topics']);
  assert.deepEqual(found('taggroup:taggroup-keywords'), ['taggroup', 'keywords']);
  assert.deepEqual(found('fieldlayout:users'), ['fieldlayout', 'Users']);
  assert.deepEqual(found('fieldlayout:addresses'), ['fieldlayout', 'Addresses']);
  assert.equal(nodeOf('section:section-archive'), null);
  assert.equal(nodeOf('producttype:producttype-shirts'), null);
  assert.equal(nodeOf(null), null);
});

test('each kind lists its own objects, in the order of the data', () => {
  const { ofKind } = loadViewer();

  assert.deepEqual(handles(ofKind('site')), ['en', 'de', 'shop']);
  assert.deepEqual(handles(ofKind('block')), ['block_columns', 'block_image', 'block_teaser', 'block_text', 'quote']);
  assert.deepEqual(handles(ofKind('field')), ['body', 'copyright', 'curators', 'featured', 'image', 'layoutStyle', 'notes', 'oldTeaser', 'photographer', 'relatedNews', 'summary']);
  assert.deepEqual(handles(ofKind('usergroup')), ['editors', 'members', 'shopStaff']);
});

test('Pages, Blocks and unused entry types are entry types, Builders and Fields are fields', () => {
  const { KIND, isEntryType, isField } = loadViewer();

  assert.deepEqual(Object.keys(KIND).filter(isEntryType), ['page', 'block', 'unused']);
  assert.deepEqual(Object.keys(KIND).filter(isField), ['matrix', 'field']);
});

test('site groups hold their sites, sites the sections on them', () => {
  const { byUid } = loadViewer();

  assert.deepEqual(handles(byUid.group['group-museum'].sites), ['en', 'de']);
  assert.deepEqual(handles(byUid.site['site-en'].sections), ['exhibitions', 'home', 'news', 'people']);
  assert.deepEqual(handles(byUid.site['site-shop'].sections), ['products']);
  assert.deepEqual(byUid.section['section-news'].groups, ['group-museum']);
  assert.equal(byUid.section['section-people'].hasUrls, false);
});

test('Matrix and ContentBlock fields are Builders, and so are field types built on them', () => {
  const { model } = loadViewer();

  assert.deepEqual(handles(model.fields.filter(f => f.kind === 'matrix')), ['columns', 'credits', 'gallery', 'pageBuilder', 'seo']);
});

test('a field type built on Matrix is a Builder with its Blocks', () => {
  const { byUid, fieldKey } = loadViewer();

  assert.equal(fieldKey(byUid.field['field-gallery']), 'matrix:field-gallery');
  assert.deepEqual(byUid.et['et-image'].builders.map(b => b.field.handle), ['gallery', 'pageBuilder']);
});

test('the fields in a field type built on ContentBlock are used there', () => {
  const { byUid } = loadViewer();

  assert.deepEqual(byUid.field['field-photographer'].usedIn.map(u => [u.ownerKind, u.owner.handle]), [['matrix', 'credits']]);
});

test('a Block knows the Builders it is in, with its name and group there', () => {
  const { byUid } = loadViewer();
  const builders = uid => byUid.et[uid].builders.map(b => [b.field.handle, b.context, b.group]);

  assert.deepEqual(builders('et-quote'), [['pageBuilder', 'Pull quote', 'Text']]);
  assert.deepEqual(builders('et-text'), [['columns', undefined, undefined], ['pageBuilder', undefined, 'Text']]);
  assert.deepEqual(builders('et-teaser'), [['columns', undefined, undefined], ['pageBuilder', undefined, undefined]]);
});

test('a field lists each layout it sits in, including ContentBlocks', () => {
  const { byUid } = loadViewer();
  const usedIn = uid => byUid.field[uid].usedIn.map(u => [u.ownerKind, u.owner.handle]);

  assert.deepEqual(usedIn('field-body'), [['block', 'block_text'], ['page', 'exhibition'], ['page', 'page_article'], ['page', 'page_link'], ['page', 'page_product'], ['block', 'quote']]);
  assert.deepEqual(usedIn('field-summary'), [['matrix', 'seo']]);
  assert.deepEqual(usedIn('field-image'), [['block', 'block_image'], ['unused', 'oldPromo'], ['page', 'page_person'], ['page', 'page_product'], ['matrix', 'seo']]);
  assert.equal(byUid.field['field-body'].usedIn.find(u => u.owner.handle === 'page_article').el.label, 'Introduction');
});

test('unused entry types are listed apart, and Pages and Blocks are counted without them', () => {
  const { ofKind, unusedEntryTypes } = loadViewer();

  assert.deepEqual(handles(unusedEntryTypes), ['oldPromo']);
  assert.equal(ofKind('page').length, 6);
  assert.equal(ofKind('block').length, 5);
});

test('a field that only sits in a global set is used there, with the label it gets there', () => {
  const { byUid } = loadViewer();

  assert.deepEqual(byUid.field['field-copyright'].usedIn.map(u => [u.ownerKind, u.owner.handle, u.el.label]), [['globalset', 'footer', 'Copyright line']]);
});

test('volumes, category and tag groups, users and addresses list the fields in them, with the label they get there', () => {
  const { byUid } = loadViewer();

  assert.deepEqual(byUid.field['field-notes'].usedIn.map(u => [u.ownerKind, u.owner.name, u.el.label]), [
    ['volume', 'Images', 'Caption'],
    ['categorygroup', 'Topics', 'Description'],
    ['taggroup', 'Keywords', undefined],
    ['fieldlayout', 'Users', 'Bio'],
    ['fieldlayout', 'Addresses', 'Directions'],
  ]);
});

test('next to Pages and Blocks, the Layout view lists unused entry types and every other field layout, by kind and name', () => {
  const { otherLayouts } = loadViewer();

  assert.deepEqual(otherLayouts().map(([kind, list]) => [kind, list.map(o => o.name)]), [
    ['unused', ['Old promo']],
    ['globalset', ['Contact', 'Footer']],
    ['volume', ['Images']],
    ['categorygroup', ['Topics']],
    ['taggroup', ['Keywords']],
    ['fieldlayout', ['Addresses', 'Users']],
  ]);
});

test('a search in those field layouts leaves out the kinds with nothing that matches', () => {
  const { otherLayouts } = loadViewer();

  assert.deepEqual(otherLayouts(o => o.handle === 'footer').map(([kind, list]) => [kind, list.map(o => o.name)]), [['globalset', ['Footer']]]);
});

test('Craft’s own elements in a field layout go by the names Craft gives them, the address title field as Label', () => {
  const { byUid, elementName } = loadViewer();
  const names = o => o.tabs.flatMap(t => t.elements).filter(el => el.kind !== 'CustomField').map(el => elementName(el, o));

  assert.deepEqual(names(byUid.fieldlayout.users), ['Username', 'Full Name', 'Portrait', 'Email', 'Affiliated Site', 'Markdown', 'Line Break']);
  assert.deepEqual(names(byUid.volume['volume-images']), ['Title', 'Alternative Text']);
  assert.deepEqual(names(byUid.fieldlayout.addresses), ['Label', 'Country', 'Address', 'Full Name', 'Company', 'Organization Tax ID', 'Latitude/Longitude', 'Template']);
});

test('every element Craft ships goes by the name Craft gives it, unless the layout gives it one', () => {
  const { model, KIND, isLayoutOwner, ofKind, elementName } = loadViewer();
  const layouts = [...model.entryTypes, ...model.fields.filter(f => f.tabs), ...Object.keys(KIND).filter(isLayoutOwner).flatMap(ofKind)];
  const named = layouts.flatMap(o => o.tabs.flatMap(t => t.elements).filter(el => !['CustomField', 'Title'].includes(el.kind)).map(el => [el.kind, el.label, elementName(el, o)]));
  const CRAFT_NAMES = {
    UsernameField: 'Username', FullNameField: 'Full Name', EmailField: 'Email', AffiliatedSiteField: 'Affiliated Site', AltField: 'Alternative Text',
    OrganizationTaxIdField: 'Organization Tax ID', CountryCodeField: 'Country', AddressField: 'Address', LatLongField: 'Latitude/Longitude', TextField: 'Text',
    Heading: 'Heading', Tip: 'Tip', HorizontalRule: 'Horizontal Rule', LineBreak: 'Line Break', Markdown: 'Markdown', Template: 'Template',
  };

  assert.deepEqual(named.filter(([kind, label, name]) => name !== (label || CRAFT_NAMES[kind])), []);
  // The fixture holds every element Craft ships (ContentModelTest checks), among them these that once went by their class.
  ['LineBreak', 'Markdown', 'Template', 'TextField', 'TextareaField'].forEach(kind => assert.ok(named.some(([k]) => k === kind), kind));
});

test('a title the layout renames goes by that name, and an element Craft doesn’t ship by its class', () => {
  const { byUid, elementName } = loadViewer();

  assert.equal(elementName(byUid.et['et-person'].tabs[0].elements[0], byUid.et['et-person']), 'Name');
  assert.equal(elementName({ kind: 'Html', width: 100 }, byUid.et['et-person']), 'HTML');
  assert.equal(elementName({ kind: 'ProductTypeField', width: 100 }, byUid.et['et-person']), 'ProductTypeField');
});

test('fields that no field layout holds are unused', () => {
  const { unusedFields } = loadViewer();

  assert.deepEqual(handles(unusedFields), ['oldTeaser']);
});

test('an Entries field targets the sections it pulls from that still exist', () => {
  const { byUid } = loadViewer();

  assert.deepEqual(handles(byUid.field['field-related-news'].targets), ['news']);
  assert.deepEqual(handles(byUid.field['field-curators'].targets), ['people']);
  assert.deepEqual(handles(byUid.section['section-news'].referencedBy), ['relatedNews']);
  assert.deepEqual(handles(byUid.section['section-people'].referencedBy), ['curators']);
});

test('an Entries field open to every section targets none in particular', () => {
  const { byUid } = loadViewer();

  assert.equal(byUid.field['field-featured'].allSources, true);
  assert.deepEqual(byUid.field['field-featured'].targets, []);
  assert.equal(byUid.field['field-related-news'].allSources, false);
});

test('only Entries fields have relation targets', () => {
  const { byUid } = loadViewer();

  assert.deepEqual(byUid.field['field-image'].targets, []);
  assert.equal(byUid.field['field-image'].allSources, undefined);
});

test('a Block pulls content from the sections its fields target, through nested Builders too', () => {
  const { byUid, pullsFrom } = loadViewer();
  const pulls = uid => handles([...pullsFrom(byUid.et[uid])]);

  assert.deepEqual(pulls('et-teaser'), ['news']);
  assert.deepEqual(pulls('et-columns'), ['news']);
  assert.deepEqual(pulls('et-text'), []);
});

test('an entry type ends up on the sites of its sections, or of the Pages that hold its Builder', () => {
  const { byUid, sitesOfEt } = loadViewer();
  const sites = uid => [...sitesOfEt(byUid.et[uid])];

  assert.deepEqual(sites('et-product'), ['site-shop']);
  assert.deepEqual(sites('et-article'), ['site-en', 'site-de']);
  assert.deepEqual(sites('et-quote'), ['site-en', 'site-de']);
  assert.deepEqual(sites('et-text'), ['site-en', 'site-de']);
});

test('a field ends up in the site groups of the Pages and Blocks that hold it, through Builders too', () => {
  const { byUid, groupsOfField } = loadViewer();
  const groups = uid => [...groupsOfField(byUid.field[uid])].sort();

  assert.deepEqual(groups('field-body'), ['group-museum', 'group-shop']);
  assert.deepEqual(groups('field-related-news'), ['group-museum']);
  assert.deepEqual(groups('field-columns'), ['group-museum']);
  assert.deepEqual(groups('field-summary'), ['group-museum']);
  assert.deepEqual(groups('field-old-teaser'), []);
});

test('a field that only sits in field layouts outside entry types ends up in no site group', () => {
  const { byUid, groupsOfField } = loadViewer();

  assert.deepEqual([...groupsOfField(byUid.field['field-copyright'])], []);
});

test('a site group has the fields of its Pages and of the Blocks that end up there', () => {
  const { model, groupsOfField } = loadViewer();
  const fieldsIn = group => handles(model.fields.filter(f => groupsOfField(f).has(group)));

  assert.deepEqual(fieldsIn('group-shop'), ['body', 'image']);
  assert.deepEqual(fieldsIn('group-museum'), ['body', 'columns', 'credits', 'curators', 'featured', 'gallery', 'image', 'layoutStyle', 'pageBuilder', 'photographer', 'relatedNews', 'seo', 'summary']);
});

test('a handle passes if it starts with any of the prefixes for its kind', () => {
  const { byUid, checksHandles, unprefixedEntryTypes } = loadViewer({ prefixes: { page: ['page_', 'single_'], block: ['block_'] } });

  assert.equal(checksHandles, true);
  assert.deepEqual(handles(unprefixedEntryTypes), ['exhibition', 'quote']);
  assert.equal(byUid.et['et-home'].conventionOk, true);
  assert.equal(byUid.et['et-exhibition'].prefix, 'page_ / single_');
  assert.equal(byUid.et['et-quote'].prefix, 'block_');
});

test('an unused entry type is checked against neither the page nor the block prefixes', () => {
  const { byUid, unprefixedEntryTypes } = loadViewer({ prefixes: { page: ['page_'], block: ['block_'] } });

  assert.equal(byUid.et['et-promo'].conventionOk, true);
  assert.equal(byUid.et['et-promo'].prefix, '');
  assert.equal(unprefixedEntryTypes.some(e => e.handle === 'oldPromo'), false);
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
  const { byUid, rightsOn } = loadViewer();
  const editors = byUid.usergroup['ug-editors'];

  assert.deepEqual(rightsOn(editors, 'usergroup', 'site:site-en'), ['edit']);
  assert.equal(rightsOn(editors, 'usergroup', 'site:site-shop'), null);
  assert.deepEqual(rightsOn(editors, 'usergroup', 'section:section-home'), ['view', 'save']);
  assert.deepEqual(rightsOn(editors, 'usergroup', 'page:et-article'), ['view', 'create', 'save', 'delete', 'viewPeer', 'savePeer', 'viewPeerDrafts', 'deletePeerDrafts']);
  assert.equal(rightsOn(editors, 'usergroup', 'page:et-product'), null);
});

test('user group rights stop at Pages', () => {
  const { byUid, rightsOn } = loadViewer();
  const editors = byUid.usergroup['ug-editors'];

  assert.equal(rightsOn(editors, 'usergroup', 'matrix:field-page-builder'), null);
  assert.equal(rightsOn(editors, 'usergroup', 'block:et-text'), null);
  assert.equal(rightsOn(editors, 'usergroup', 'field:field-body'), null);
});

test('a schema reads its sites and has its rights on the sections of a Page', () => {
  const { byUid, rightsOn } = loadViewer();
  const app = byUid.schema['gql-app'];

  assert.deepEqual(rightsOn(app, 'schema', 'site:site-shop'), ['read']);
  assert.equal(rightsOn(app, 'schema', 'site:site-en'), null);
  assert.deepEqual(rightsOn(app, 'schema', 'page:et-product'), ['read', 'create', 'save', 'delete']);
  assert.equal(rightsOn(app, 'schema', 'page:et-article'), null);
});

test('a schema has its rights on a Builder and on the Blocks in it', () => {
  const { byUid, rightsOn } = loadViewer();
  const app = byUid.schema['gql-app'], pub = byUid.schema['gql-public'];

  assert.deepEqual(rightsOn(app, 'schema', 'matrix:field-page-builder'), ['read', 'save']);
  assert.deepEqual(rightsOn(app, 'schema', 'block:et-quote'), ['read', 'save']);
  assert.deepEqual(rightsOn(pub, 'schema', 'block:et-quote'), ['read']);
  assert.equal(rightsOn(pub, 'schema', 'matrix:field-seo'), null);
  assert.equal(rightsOn(app, 'schema', 'field:field-body'), null);
});

test('a Block in several Builders gets the rights of all of them', () => {
  const { byUid, rightsOn } = loadViewer();

  assert.deepEqual(rightsOn(byUid.schema['gql-app'], 'schema', 'block:et-text'), ['read', 'save']);
  assert.deepEqual(rightsOn(byUid.schema['gql-public'], 'schema', 'block:et-text'), ['read']);
});

test('a Builder’s Blocks come by their group, in the order the field has them', () => {
  const { byUid, blockGroups } = loadViewer();
  const groups = uid => blockGroups(byUid.field[uid]).map(([group, blocks]) => [group, blocks.map(b => b.entryType)]);

  assert.deepEqual(groups('field-page-builder'), [['Text', ['et-text', 'et-quote']], ['Media', ['et-image', 'et-link']], ['', ['et-teaser']], ['Layout', ['et-columns']]]);
  assert.deepEqual(groups('field-columns'), [['', ['et-text', 'et-teaser']]]);
});
