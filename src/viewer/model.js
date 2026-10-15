// Indexes the extracted config and derives the relations every view needs.
// Glossary: a Page is an entry type attached to a Craft section, a Block one attached to a Matrix field. An entry type
// attached to neither is unused.
const model = window.CONTENT_MODEL;

// Every kind of node: what it's called and the index in `byUid` that holds its objects. Each view says which kinds it
// has a place for. Pages, Blocks and unused entry types are entry types, Builders and Fields are fields. Each object
// carries its kind.
const KIND = {
  group: { label: 'Site Group', plural: 'Site Groups', index: 'group' },
  site: { label: 'Site', plural: 'Sites', index: 'site' },
  section: { label: 'Section', plural: 'Sections', index: 'section' },
  page: { label: 'Page', plural: 'Pages', hint: 'entry type attached to a section', index: 'et' },
  matrix: { label: 'Builder', plural: 'Builders', hint: 'matrix or content block field', index: 'field' },
  block: { label: 'Block', plural: 'Blocks', hint: 'entry type attached to a matrix field', index: 'et' },
  field: { label: 'Field', plural: 'Fields', index: 'field' },
  unused: { label: 'Unused', plural: 'Unused entry types', index: 'et' },
  // Layers over the rest: the kinds of node they reach, and the right they have on a site they reach.
  usergroup: { label: 'User Group', plural: 'User Groups', index: 'usergroup', layer: true, reaches: ['site', 'section', 'page'], siteRight: 'edit' },
  schema: { label: 'GraphQL Schema', plural: 'GraphQL Schemas', index: 'schema', layer: true, reaches: ['site', 'section', 'page', 'matrix', 'block'], siteRight: 'read' },
  // Field layouts outside the graph's hierarchy, with the objects that hold them. Users and addresses have one field
  // layout each, without a name or UID, so they get fixed ones.
  globalset: { label: 'Global Set', plural: 'Global Sets', index: 'globalset', layoutOwners: model.globalSets },
  volume: { label: 'Volume', plural: 'Volumes', index: 'volume', layoutOwners: model.volumes },
  categorygroup: { label: 'Category Group', plural: 'Category Groups', index: 'categorygroup', layoutOwners: model.categoryGroups },
  taggroup: { label: 'Tag Group', plural: 'Tag Groups', index: 'taggroup', layoutOwners: model.tagGroups },
  // Users' and addresses' field layouts belong to their element type itself; `fieldlayout` stays the key in links.
  fieldlayout: {
    label: 'Element Type',
    plural: 'Element Types',
    index: 'fieldlayout',
    layoutOwners: [Object.assign(model.users, { uid: 'users', name: 'Users' }), Object.assign(model.addresses, { uid: 'addresses', name: 'Addresses' })],
  },
};
const isEntryType = kind => KIND[kind].index === 'et';
const isField = kind => KIND[kind].index === 'field';
const isLayoutOwner = kind => 'layoutOwners' in KIND[kind];

const fieldTypeLabel = f => f.typeLabel || f.type;

// The colours Craft gives entry types (craft\enums\Color) that the viewer shows, each a token in viewer.css. White, gray
// and black count as none: the viewer is monochrome already.
const COLORS = ['red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose'];
const colorOf = o => (COLORS.includes(o.color) ? o.color : '');

// Handle prefixes from the plugin settings, for Pages and for Blocks; without them every handle passes.
const PREFIX = model.prefixes;
const checksHandles = PREFIX.page.length > 0 || PREFIX.block.length > 0;

/** @type {Record<string, Record<string, any>>} */
const byUid = Object.fromEntries(Object.values(KIND).map(k => [k.index, {}]));
model.siteGroups.forEach(g => { byUid.group[g.uid] = g; g.kind = 'group'; g.sites = []; });
model.sites.forEach(s => { byUid.site[s.uid] = s; s.kind = 'site'; s.sections = []; if (byUid.group[s.group]) byUid.group[s.group].sites.push(s); });
model.entryTypes.forEach(e => { byUid.et[e.uid] = e; e.sections = []; e.builders = []; });
// The server says which fields are Builders and which relate to entries, field types built on them included. A Builder
// is one thing under three names: the server's role `builder`, the label Builder, and the kind `matrix`, which stays
// as it is because it's in shareable links.
model.fields.forEach(f => { byUid.field[f.uid] = f; f.kind = f.role === 'builder' ? 'matrix' : 'field'; f.usedIn = []; f.targets = []; });
model.userGroups.forEach(g => { byUid.usergroup[g.uid] = g; g.kind = 'usergroup'; });
model.gqlSchemas.forEach(s => { byUid.schema[s.uid] = s; s.kind = 'schema'; });
Object.keys(KIND).filter(isLayoutOwner).forEach(kind => KIND[kind].layoutOwners.forEach(o => { byUid[kind][o.uid] = o; o.kind = kind; }));

model.sections.forEach(s => {
  byUid.section[s.uid] = s;
  s.kind = 'section';
  s.referencedBy = [];
  s.sites.forEach(ss => byUid.site[ss.site] && byUid.site[ss.site].sections.push(s));
  s.groups = [...new Set(s.sites.map(ss => byUid.site[ss.site] && byUid.site[ss.site].group).filter(Boolean))];
  s.hasUrls = s.sites.some(ss => ss.hasUrls);
  s.entryTypes.forEach(uid => byUid.et[uid] && byUid.et[uid].sections.push(s));
  // A section or Matrix field can give an entry type a name and a handle of its own there, like a field layout gives a
  // field. `as` holds them in the shape of a field layout element: { label, handle }.
  s.as = Object.fromEntries(s.entryTypes.map(uid => [uid, { label: s.contexts[uid], handle: s.handles[uid] }]));
});

model.fields.forEach(f => {
  (f.blocks || []).forEach(b => {
    b.as = { label: b.context, handle: b.handle };
    if (byUid.et[b.entryType]) byUid.et[b.entryType].builders.push({ field: f, as: b.as, group: b.group });
  });
  if (f.role === 'relation') {
    f.allSources = (f.sources || []).includes('*');
    (f.sources || []).forEach(src => {
      const m = /^section:(.+)$/.exec(src || '');
      if (m && byUid.section[m[1]]) { f.targets.push(byUid.section[m[1]]); byUid.section[m[1]].referencedBy.push(f); }
    });
  }
});

// A Builder's Blocks by the group they're in, in the order the field has them. Blocks without a group are under ''.
function blockGroups(f) {
  const groups = new Map();
  (f.blocks || []).forEach(b => {
    const group = b.group || '';
    groups.set(group, [...(groups.get(group) || []), b]);
  });
  return [...groups];
}

// The custom fields in a field layout's tabs, each with the field it places and the tab it's on.
const layoutFields = tabs => (tabs || []).flatMap(tab => tab.elements.filter(el => el.kind === 'CustomField' && byUid.field[el.field]).map(el => ({ el, f: byUid.field[el.field], tab })));

model.entryTypes.forEach(e => {
  e.kind = e.sections.length ? 'page' : e.builders.length ? 'block' : 'unused';
  e.gql = `${e.handle}_Entry`;
  const prefixes = PREFIX[e.kind] || [];
  e.prefix = prefixes.join(' / ');
  e.conventionOk = !prefixes.length || prefixes.some(p => e.handle.startsWith(p));
});
// Whatever has a field layout uses the fields in it: entry types, ContentBlocks (and field types built on them), and
// the field layouts outside the graph.
[...model.entryTypes, ...model.fields, ...Object.keys(KIND).filter(isLayoutOwner).flatMap(kind => KIND[kind].layoutOwners)]
  .forEach(owner => layoutFields(owner.tabs).forEach(({ el, f }) => f.usedIn.push({ owner, ownerKind: owner.kind, el })));

// Craft's own fields in a field layout, and the UI elements between them, by the names Craft gives them. TextField and
// TextareaField are the plain text fields Craft's own build on. An element a plugin adds goes by its class name.
const NATIVE_FIELDS = {
  UsernameField: 'Username', FullNameField: 'Full Name', PhotoField: 'Photo', EmailField: 'Email', AffiliatedSiteField: 'Affiliated Site',
  AltField: 'Alternative Text', OrganizationField: 'Organization', OrganizationTaxIdField: 'Organization Tax ID', CountryCodeField: 'Country',
  AddressField: 'Address', LatLongField: 'Latitude/Longitude', TextField: 'Text', TextareaField: 'Text',
};
const UI_ELEMENTS = {
  Heading: 'Heading', Tip: 'Tip', HorizontalRule: 'Horizontal Rule', LineBreak: 'Line Break', Markdown: 'Markdown', Template: 'Template',
  Html: 'HTML',
};
// The label a layout gives an element, or else its name. The address Label field is built on the title field, so it
// arrives as one.
const elementName = (el, owner) => el.label || (el.kind === 'Title' ? (owner === byUid.fieldlayout.addresses ? 'Label' : 'Title') : NATIVE_FIELDS[el.kind] || UI_ELEMENTS[el.kind] || el.kind);

// Node keys are "<kind>:<uid>".
const keyOf = (kind, uid) => `${kind}:${uid}`;
const etKey = e => keyOf(e.kind, e.uid);
const fieldKey = f => keyOf(f.kind, f.uid);
const useKey = u => keyOf(u.ownerKind, u.owner.uid);
function nodeOf(key) {
  if (!key) return null;
  const i = key.indexOf(':');
  const kind = key.slice(0, i), uid = key.slice(i + 1);
  const index = KIND[kind] && byUid[KIND[kind].index];
  const obj = index && index[uid];
  return obj ? { kind, uid, obj, key } : null;
}
// The objects of a kind, in the order of the data.
const ofKind = kind => Object.values(byUid[KIND[kind].index]).filter(o => o.kind === kind);

// Entry types that contain a field, looking through content blocks. Other field layouts don't count.
function ownersOfField(f, seen = new Set()) {
  if (seen.has(f.uid)) return [];
  seen.add(f.uid);
  return f.usedIn.flatMap(u => (isField(u.ownerKind) ? ownersOfField(u.owner, seen) : isEntryType(u.ownerKind) ? [u.owner] : []));
}
// Sites an entry type ends up on: its sections, or the sections of whatever page holds its builder.
function sitesOfEt(e, seen = new Set()) {
  const out = new Set();
  if (seen.has(e.uid)) return out;
  seen.add(e.uid);
  e.sections.forEach(s => s.sites.forEach(ss => out.add(ss.site)));
  e.builders.forEach(b => ownersOfField(b.field).forEach(o => sitesOfEt(o, seen).forEach(x => out.add(x))));
  return out;
}
// Site groups of those sites; a field's are those of every page or block that holds it.
const groupsOfEt = e => new Set([...sitesOfEt(e)].map(s => byUid.site[s] && byUid.site[s].group).filter(Boolean));
const groupsOfField = f => new Set(ownersOfField(f).flatMap(e => [...groupsOfEt(e)]));
// Sections a block pulls content from through relations, including nested builders.
function pullsFrom(e, depth = 0) {
  const out = new Set();
  if (depth > 3) return out;
  layoutFields(e.tabs).forEach(({ f }) => {
    f.targets.forEach(s => out.add(s));
    (f.blocks || []).forEach(b => byUid.et[b.entryType] && pullsFrom(byUid.et[b.entryType], depth + 1).forEach(s => out.add(s)));
  });
  return out;
}

const unusedFields = model.fields.filter(f => !f.usedIn.length);
const unusedEntryTypes = ofKind('unused');
const unprefixedEntryTypes = model.entryTypes.filter(e => !e.conventionOk);
const byName = (a, b) => a.name.localeCompare(b.name);

// Field layouts that belong to neither a Page nor a Block, by kind and name, as far as `keep` lets them through.
const OTHER_LAYOUTS = ['unused', ...Object.keys(KIND).filter(isLayoutOwner)];
const otherLayouts = (keep = () => true) => OTHER_LAYOUTS.map(kind => /** @type {[string, any[]]} */ ([kind, ofKind(kind).filter(keep).sort(byName)])).filter(([, list]) => list.length);

// ---- access: user groups and GraphQL schemas, a layer the header pickers switch on over every view
const ACCESS = ['usergroup', 'schema'];
const shownAccess = { usergroup: new Set(), schema: new Set() };
const activeAccess = kind => ofKind(kind).filter(a => shownAccess[kind].has(a.uid));
// User groups reach sites, sections and the pages in them; schemas also reach builders and their blocks.
const accessApplies = (kind, nodeKind) => KIND[kind].reaches.includes(nodeKind);

// What a user group or schema may do with a node, or null if nothing.
function rightsOn(a, kind, key) {
  const n = nodeOf(key);
  if (!n || !accessApplies(kind, n.kind)) return null;
  const o = n.obj;
  const union = lists => { const all = [...new Set(lists.flat())]; return all.length ? all : null; };
  if (n.kind === 'site') return a.sites.includes(o.uid) ? [KIND[kind].siteRight] : null;
  if (n.kind === 'section') return a.sections[o.uid] || null;
  if (n.kind === 'page') return union(o.sections.map(s => a.sections[s.uid] || []));
  if (n.kind === 'matrix') return a.fields[o.uid] || null;
  return union(o.builders.map(b => a.fields[b.field.uid] || []));
}

// "view, create, save · others’ entries: view · others’ drafts: view"
function rightsText(kind, rights) {
  if (kind === 'schema') return rights.join(', ');
  const own = rights.filter(r => !r.includes('Peer'));
  const peer = rights.filter(r => r.endsWith('Peer')).map(r => r.replace('Peer', ''));
  const drafts = rights.filter(r => r.endsWith('PeerDrafts')).map(r => r.replace('PeerDrafts', ''));
  return [own.join(', '), peer.length && `others’ entries: ${peer.join(', ')}`, drafts.length && `others’ drafts: ${drafts.join(', ')}`].filter(Boolean).join(' · ');
}
