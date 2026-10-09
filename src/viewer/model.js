// Indexes the extracted config and derives the relations every view needs.
// Glossary: a Page is an entry type attached to a Craft section, a Block one attached to a Matrix field. An entry type
// attached to neither is unused.
const M = window.CONTENT_MODEL;

// Every kind of node: what it's called, the index in `by` that holds its objects, and the views it has a place in.
// Pages, Blocks and unused entry types are entry types, Builders and Fields are fields. Each object carries its kind.
const ALL_VIEWS = ['graph', 'table', 'layout', 'diff'];
const KIND = {
  group: { label: 'Site Group', plural: 'Site Groups', index: 'group', views: ['graph'] },
  site: { label: 'Site', plural: 'Sites', index: 'site', views: ['graph', 'diff'] },
  section: { label: 'Section', plural: 'Sections', index: 'section', views: ['graph', 'layout', 'diff'] },
  page: { label: 'Page', plural: 'Pages', hint: 'Entry type attached to a section', index: 'et', views: ALL_VIEWS },
  matrix: { label: 'Builder', plural: 'Builders', hint: 'Matrix or content block field', index: 'field', views: ALL_VIEWS },
  block: { label: 'Block', plural: 'Blocks', hint: 'Entry type attached to a matrix field', index: 'et', views: ALL_VIEWS },
  field: { label: 'Field', plural: 'Fields', index: 'field', views: ALL_VIEWS },
  // Entry types attached to no section or Matrix field connect to nothing on the map, so the Graph has no place for them.
  unused: { label: 'Unused', plural: 'Unused entry types', index: 'et', views: ['table', 'layout', 'diff'] },
  usergroup: { label: 'User Group', plural: 'User Groups', index: 'usergroup', views: ['graph', 'diff'], layer: true },
  schema: { label: 'GraphQL Schema', plural: 'GraphQL Schemas', index: 'schema', views: ['graph', 'diff'], layer: true },
  globalset: { label: 'Global Set', plural: 'Global Sets', index: 'globalset', views: ['table', 'layout'] },
  volume: { label: 'Volume', plural: 'Volumes', index: 'volume', views: ['table', 'layout'] },
  categorygroup: { label: 'Category Group', plural: 'Category Groups', index: 'categorygroup', views: ['table', 'layout'] },
  taggroup: { label: 'Tag Group', plural: 'Tag Groups', index: 'taggroup', views: ['table', 'layout'] },
  fieldlayout: { label: 'Field Layout', plural: 'Field Layouts', index: 'fieldlayout', views: ['table', 'layout'] },
};
const isEntryType = kind => KIND[kind].index === 'et';
const isField = kind => KIND[kind].index === 'field';

const fieldTypeLabel = f => f.typeLabel || f.type;

// Handle prefixes come from the plugin settings; without them every handle passes.
const PREFIX = { page: [], block: [], ...M.prefixes };
const checksHandles = PREFIX.page.length > 0 || PREFIX.block.length > 0;

const by = Object.fromEntries(Object.values(KIND).map(k => [k.index, {}]));
M.siteGroups.forEach(g => { by.group[g.uid] = g; g.kind = 'group'; g.sites = []; });
M.sites.forEach(s => { by.site[s.uid] = s; s.kind = 'site'; s.sections = []; if (by.group[s.group]) by.group[s.group].sites.push(s); });
M.entryTypes.forEach(e => { by.et[e.uid] = e; e.sections = []; e.builders = []; });
// The server says which fields are Builders and which relate to entries, field types built on them included.
M.fields.forEach(f => { by.field[f.uid] = f; f.kind = f.role === 'builder' ? 'matrix' : 'field'; f.usedIn = []; f.targets = []; });
M.userGroups.forEach(g => { by.usergroup[g.uid] = g; g.kind = 'usergroup'; });
M.gqlSchemas.forEach(s => { by.schema[s.uid] = s; s.kind = 'schema'; });

M.sections.forEach(s => {
  by.section[s.uid] = s;
  s.kind = 'section';
  s.referencedBy = [];
  s.sites.forEach(ss => by.site[ss.site] && by.site[ss.site].sections.push(s));
  s.groups = [...new Set(s.sites.map(ss => by.site[ss.site] && by.site[ss.site].group).filter(Boolean))];
  s.hasUrls = s.sites.some(ss => ss.hasUrls);
  s.entryTypes.forEach(uid => by.et[uid] && by.et[uid].sections.push(s));
});

M.fields.forEach(f => {
  (f.blocks || []).forEach(b => by.et[b.entryType] && by.et[b.entryType].builders.push({ field: f, context: b.context, group: b.group }));
  if (f.role === 'relation') {
    f.allSources = (f.sources || []).includes('*');
    (f.sources || []).forEach(src => {
      const m = /^section:(.+)$/.exec(src || '');
      if (m && by.section[m[1]]) { f.targets.push(by.section[m[1]]); by.section[m[1]].referencedBy.push(f); }
    });
  }
});

const eachCustom = (tabs, fn) => (tabs || []).forEach(t => t.elements.forEach(el => el.kind === 'CustomField' && fn(el, t)));
const customElements = tabs => { const out = []; eachCustom(tabs, el => by.field[el.field] && out.push({ el, f: by.field[el.field] })); return out; };

M.entryTypes.forEach(e => {
  e.kind = e.sections.length ? 'page' : e.builders.length ? 'block' : 'unused';
  e.gql = `${e.handle}_Entry`;
  const prefixes = PREFIX[e.kind] || [];
  e.prefix = prefixes.join(' / ');
  e.conventionOk = !prefixes.length || prefixes.some(p => e.handle.startsWith(p));
  eachCustom(e.tabs, el => by.field[el.field] && by.field[el.field].usedIn.push({ owner: e, ownerKind: e.kind, el }));
});
// A ContentBlock, or a field type built on it, holds fields in a layout of its own.
M.fields.forEach(f => {
  eachCustom(f.tabs, el => by.field[el.field] && by.field[el.field].usedIn.push({ owner: f, ownerKind: f.kind, el }));
});
// Global sets, volumes, category and tag groups, users and addresses hold fields too, outside the graph's hierarchy.
// Users and addresses have one field layout each, without a name or UID, so they get fixed ones.
const LAYOUT_OWNERS = {
  globalset: M.globalSets,
  volume: M.volumes,
  categorygroup: M.categoryGroups,
  taggroup: M.tagGroups,
  fieldlayout: [Object.assign(M.users, { uid: 'users', name: 'Users' }), Object.assign(M.addresses, { uid: 'addresses', name: 'Addresses' })],
};
Object.entries(LAYOUT_OWNERS).forEach(([kind, list]) => list.forEach(o => {
  by[kind][o.uid] = o;
  o.kind = kind;
  eachCustom(o.tabs, el => by.field[el.field] && by.field[el.field].usedIn.push({ owner: o, ownerKind: kind, el }));
}));
const isLayoutOwner = kind => kind in LAYOUT_OWNERS;

// Craft's own fields in a field layout, by the name Craft gives them. Other elements go by their class name.
const NATIVE_FIELDS = {
  UsernameField: 'Username', FullNameField: 'Full Name', PhotoField: 'Photo', EmailField: 'Email', AffiliatedSiteField: 'Affiliated Site',
  AltField: 'Alternative Text', OrganizationField: 'Organization', OrganizationTaxIdField: 'Organization Tax ID', CountryCodeField: 'Country',
  AddressField: 'Address', LatLongField: 'Latitude/Longitude',
};
// The address Label field is built on the title field, so it arrives as one.
const nativeName = (el, owner) => el.label || (el.kind === 'Title' ? (owner === by.fieldlayout.addresses ? 'Label' : 'Title') : NATIVE_FIELDS[el.kind] || el.kind);

// Node keys are "<kind>:<uid>".
const keyOf = (kind, uid) => `${kind}:${uid}`;
const etKey = e => keyOf(e.kind, e.uid);
const fieldKey = f => keyOf(f.kind, f.uid);
const useKey = u => keyOf(u.ownerKind, u.owner.uid);
function nodeOf(key) {
  if (!key) return null;
  const i = key.indexOf(':');
  const kind = key.slice(0, i), uid = key.slice(i + 1);
  const index = KIND[kind] && by[KIND[kind].index];
  const obj = index && index[uid];
  return obj ? { kind, uid, obj, key } : null;
}
// The objects of a kind, in the order of the data.
const ofKind = kind => Object.values(by[KIND[kind].index]).filter(o => o.kind === kind);

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
const groupsOfEt = e => new Set([...sitesOfEt(e)].map(s => by.site[s] && by.site[s].group).filter(Boolean));
const groupsOfField = f => new Set(ownersOfField(f).flatMap(e => [...groupsOfEt(e)]));
// Sections a block pulls content from through relations, including nested builders.
function pullsFrom(e, depth = 0) {
  const out = new Set();
  if (depth > 3) return out;
  customElements(e.tabs).forEach(({ f }) => {
    f.targets.forEach(s => out.add(s));
    (f.blocks || []).forEach(b => by.et[b.entryType] && pullsFrom(by.et[b.entryType], depth + 1).forEach(s => out.add(s)));
  });
  return out;
}

const unusedFields = M.fields.filter(f => !f.usedIn.length);
const unusedEntryTypes = ofKind('unused');
const unprefixedEntryTypes = M.entryTypes.filter(e => !e.conventionOk);
const byName = (a, b) => a.name.localeCompare(b.name);

// Field layouts that belong to neither a Page nor a Block, by kind and name, as far as `keep` lets them through.
const OTHER_LAYOUTS = ['unused', ...Object.keys(LAYOUT_OWNERS)];
const otherLayouts = (keep = () => true) => OTHER_LAYOUTS.map(kind => [kind, ofKind(kind).filter(keep).sort(byName)]).filter(([, list]) => list.length);

// ---- access: user groups and GraphQL schemas, a layer the header pickers switch on over every view
const ACCESS = ['usergroup', 'schema'];
const shownAccess = { usergroup: new Set(), schema: new Set() };
const activeAccess = kind => ofKind(kind).filter(a => shownAccess[kind].has(a.uid));
// User groups reach sites, sections and the pages in them; schemas also reach builders and their blocks.
const accessApplies = (kind, nodeKind) => ['site', 'section', 'page'].includes(nodeKind) || (kind === 'schema' && ['matrix', 'block'].includes(nodeKind));

// What a user group or schema may do with a node, or null if nothing.
function rightsOn(a, kind, key) {
  const n = nodeOf(key);
  if (!n || !accessApplies(kind, n.kind)) return null;
  const o = n.obj;
  const union = lists => { const all = [...new Set(lists.flat())]; return all.length ? all : null; };
  if (n.kind === 'site') return a.sites.includes(o.uid) ? [kind === 'schema' ? 'read' : 'edit'] : null;
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
