// Indexes the extracted config and derives the relations every view needs.
// Glossary: a Page is an entry type attached to a Craft section, a Block one attached to a Matrix field. An entry type
// attached to neither is unused.
const model = window.CONTENT_MODEL;

// Every kind of node: what it's called and the index in `byUid` that holds its objects. Each view says which kinds it
// has a place for. Pages, Blocks and unused entry types are entry types, Builders and Fields are fields. Each object
// carries its kind.
const KIND = {
  group: { label: t('Site Group'), plural: t('Site Groups'), index: 'group' },
  site: { label: t('Site'), plural: t('Sites'), index: 'site' },
  section: { label: t('Section'), plural: t('Sections'), index: 'section' },
  page: { label: t('Page'), plural: t('Pages'), hint: t('entry type attached to a section'), index: 'et' },
  matrix: { label: t('Builder'), plural: t('Builders'), hint: t('matrix or content block field'), index: 'field' },
  block: { label: t('Block'), plural: t('Blocks'), hint: t('entry type attached to a matrix field'), index: 'et' },
  field: { label: t('Field'), plural: t('Fields'), index: 'field' },
  unused: { label: t('Unused'), plural: t('Unused entry types'), index: 'et' },
  usergroup: { label: t('User Group'), plural: t('User Groups'), index: 'usergroup', layer: true },
  schema: { label: t('GraphQL Schema'), plural: t('GraphQL Schemas'), index: 'schema', layer: true },
  globalset: { label: t('Global Set'), plural: t('Global Sets'), index: 'globalset' },
  volume: { label: t('Volume'), plural: t('Volumes'), index: 'volume' },
  categorygroup: { label: t('Category Group'), plural: t('Category Groups'), index: 'categorygroup' },
  taggroup: { label: t('Tag Group'), plural: t('Tag Groups'), index: 'taggroup' },
  fieldlayout: { label: t('Field Layout'), plural: t('Field Layouts'), index: 'fieldlayout' },
};
const isEntryType = kind => KIND[kind].index === 'et';
const isField = kind => KIND[kind].index === 'field';

// A section's type in words.
const SECTION_TYPES = { single: t('single'), channel: t('channel'), structure: t('structure') };
const sectionType = s => SECTION_TYPES[s.type] || s.type;

const fieldTypeLabel = f => f.typeLabel || f.type;

// Handle prefixes come from the plugin settings; without them every handle passes.
const PREFIX = { page: [], block: [], ...model.prefixes };
const checksHandles = PREFIX.page.length > 0 || PREFIX.block.length > 0;

const byUid = Object.fromEntries(Object.values(KIND).map(k => [k.index, {}]));
model.siteGroups.forEach(g => { byUid.group[g.uid] = g; g.kind = 'group'; g.sites = []; });
model.sites.forEach(s => { byUid.site[s.uid] = s; s.kind = 'site'; s.sections = []; if (byUid.group[s.group]) byUid.group[s.group].sites.push(s); });
model.entryTypes.forEach(e => { byUid.et[e.uid] = e; e.sections = []; e.builders = []; });
// The server says which fields are Builders and which relate to entries, field types built on them included.
model.fields.forEach(f => { byUid.field[f.uid] = f; f.kind = f.role === 'builder' ? 'matrix' : 'field'; f.usedIn = []; f.targets = []; });
model.userGroups.forEach(g => { byUid.usergroup[g.uid] = g; g.kind = 'usergroup'; });
model.gqlSchemas.forEach(s => { byUid.schema[s.uid] = s; s.kind = 'schema'; });

model.sections.forEach(s => {
  byUid.section[s.uid] = s;
  s.kind = 'section';
  s.referencedBy = [];
  s.sites.forEach(ss => byUid.site[ss.site] && byUid.site[ss.site].sections.push(s));
  s.groups = [...new Set(s.sites.map(ss => byUid.site[ss.site] && byUid.site[ss.site].group).filter(Boolean))];
  s.hasUrls = s.sites.some(ss => ss.hasUrls);
  s.entryTypes.forEach(uid => byUid.et[uid] && byUid.et[uid].sections.push(s));
});

model.fields.forEach(f => {
  (f.blocks || []).forEach(b => byUid.et[b.entryType] && byUid.et[b.entryType].builders.push({ field: f, context: b.context, group: b.group }));
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

const eachCustom = (tabs, fn) => (tabs || []).forEach(tab => tab.elements.forEach(el => el.kind === 'CustomField' && fn(el, tab)));
const customElements = tabs => { const out = []; eachCustom(tabs, el => byUid.field[el.field] && out.push({ el, f: byUid.field[el.field] })); return out; };

model.entryTypes.forEach(e => {
  e.kind = e.sections.length ? 'page' : e.builders.length ? 'block' : 'unused';
  e.gql = `${e.handle}_Entry`;
  const prefixes = PREFIX[e.kind] || [];
  e.prefix = prefixes.join(' / ');
  e.conventionOk = !prefixes.length || prefixes.some(p => e.handle.startsWith(p));
  eachCustom(e.tabs, el => byUid.field[el.field] && byUid.field[el.field].usedIn.push({ owner: e, ownerKind: e.kind, el }));
});
// A ContentBlock, or a field type built on it, holds fields in a layout of its own.
model.fields.forEach(f => {
  eachCustom(f.tabs, el => byUid.field[el.field] && byUid.field[el.field].usedIn.push({ owner: f, ownerKind: f.kind, el }));
});
// Global sets, volumes, category and tag groups, users and addresses hold fields too, outside the graph's hierarchy.
// Users and addresses have one field layout each, without a name or UID, so they get fixed ones.
const LAYOUT_OWNERS = {
  globalset: model.globalSets,
  volume: model.volumes,
  categorygroup: model.categoryGroups,
  taggroup: model.tagGroups,
  fieldlayout: [Object.assign(model.users, { uid: 'users', name: t('Users') }), Object.assign(model.addresses, { uid: 'addresses', name: t('Addresses') })],
};
Object.entries(LAYOUT_OWNERS).forEach(([kind, list]) => list.forEach(o => {
  byUid[kind][o.uid] = o;
  o.kind = kind;
  eachCustom(o.tabs, el => byUid.field[el.field] && byUid.field[el.field].usedIn.push({ owner: o, ownerKind: kind, el }));
}));
const isLayoutOwner = kind => kind in LAYOUT_OWNERS;

// Craft's own fields in a field layout, by the name Craft gives them. Other elements go by their class name.
const NATIVE_FIELDS = {
  UsernameField: t('Username'), FullNameField: t('Full Name'), PhotoField: t('Photo'), EmailField: t('Email'), AffiliatedSiteField: t('Affiliated Site'),
  AltField: t('Alternative Text'), OrganizationField: t('Organization'), OrganizationTaxIdField: t('Organization Tax ID'), CountryCodeField: t('Country'),
  AddressField: t('Address'), LatLongField: t('Latitude/Longitude'),
};
// The address Label field is built on the title field, so it arrives as one.
const nativeName = (el, owner) => el.label || (el.kind === 'Title' ? (owner === byUid.fieldlayout.addresses ? t('Label') : t('Title')) : NATIVE_FIELDS[el.kind] || el.kind);

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
  customElements(e.tabs).forEach(({ f }) => {
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

// What a user group or schema may do, in words.
const RIGHT_LABELS = { view: t('view'), create: t('create'), save: t('save'), delete: t('delete'), edit: t('edit'), read: t('read') };
const rightLabels = rights => rights.map(r => RIGHT_LABELS[r] || r).join(', ');
// "view, create, save · others’ entries: view · others’ drafts: view"
function rightsText(kind, rights) {
  if (kind === 'schema') return rightLabels(rights);
  const own = rights.filter(r => !r.includes('Peer'));
  const peer = rights.filter(r => r.endsWith('Peer')).map(r => r.replace('Peer', ''));
  const drafts = rights.filter(r => r.endsWith('PeerDrafts')).map(r => r.replace('PeerDrafts', ''));
  return [rightLabels(own), peer.length && t('others’ entries: {rights}', { rights: rightLabels(peer) }), drafts.length && t('others’ drafts: {rights}', { rights: rightLabels(drafts) })].filter(Boolean).join(' · ');
}
