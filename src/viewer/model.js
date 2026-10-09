// Indexes the extracted config and derives the relations every view needs.
// Glossary: a Page is an entry type attached to a Craft section, a Block one attached to a Matrix field.
const M = window.CONTENT_MODEL;

const KIND = {
  group: { label: 'Site Group', plural: 'Site Groups' },
  site: { label: 'Site', plural: 'Sites' },
  section: { label: 'Section', plural: 'Sections' },
  page: { label: 'Page', plural: 'Pages', hint: 'Entry type attached to a section' },
  matrix: { label: 'Builder', plural: 'Builders', hint: 'Matrix or content block field' },
  block: { label: 'Block', plural: 'Blocks', hint: 'Entry type attached to a matrix field' },
  field: { label: 'Field', plural: 'Fields' },
  usergroup: { label: 'User Group', plural: 'User Groups', layer: true },
  schema: { label: 'GraphQL Schema', plural: 'GraphQL Schemas', layer: true },
};

const fieldTypeLabel = f => f.typeLabel || f.type;

// Handle prefixes come from the plugin settings; without them every handle passes.
const PREFIX = { page: [], block: [], ...M.prefixes };
const checksHandles = PREFIX.page.length > 0 || PREFIX.block.length > 0;

const by = { group: {}, site: {}, section: {}, et: {}, field: {}, usergroup: {}, schema: {} };
M.siteGroups.forEach(g => { by.group[g.uid] = g; g.sites = []; });
M.sites.forEach(s => { by.site[s.uid] = s; s.sections = []; if (by.group[s.group]) by.group[s.group].sites.push(s); });
M.entryTypes.forEach(e => { by.et[e.uid] = e; e.sections = []; e.builders = []; });
M.fields.forEach(f => { by.field[f.uid] = f; f.usedIn = []; f.targets = []; });
M.userGroups.forEach(g => { by.usergroup[g.uid] = g; });
M.gqlSchemas.forEach(s => { by.schema[s.uid] = s; });

M.sections.forEach(s => {
  by.section[s.uid] = s;
  s.referencedBy = [];
  s.sites.forEach(ss => by.site[ss.site] && by.site[ss.site].sections.push(s));
  s.groups = [...new Set(s.sites.map(ss => by.site[ss.site] && by.site[ss.site].group).filter(Boolean))];
  s.hasUrls = s.sites.some(ss => ss.hasUrls);
  s.entryTypes.forEach(uid => by.et[uid] && by.et[uid].sections.push(s));
});

M.fields.forEach(f => {
  f.isBuilder = f.type === 'Matrix' || f.type === 'ContentBlock';
  (f.blocks || []).forEach(b => by.et[b.entryType] && by.et[b.entryType].builders.push({ field: f, context: b.context, group: b.group }));
  if (f.type === 'Entries') {
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
  e.kind = e.sections.length ? 'page' : 'block';
  e.gql = `${e.handle}_Entry`;
  e.prefix = PREFIX[e.kind].join(' / ');
  e.conventionOk = !PREFIX[e.kind].length || PREFIX[e.kind].some(p => e.handle.startsWith(p));
  eachCustom(e.tabs, el => by.field[el.field] && by.field[el.field].usedIn.push({ owner: e, ownerKind: e.kind, el }));
});
M.fields.forEach(f => {
  if (f.type === 'ContentBlock') eachCustom(f.tabs, el => by.field[el.field] && by.field[el.field].usedIn.push({ owner: f, ownerKind: 'matrix', el }));
});

// Node keys are "<kind>:<uid>"; pages and blocks are entry types, builders are fields.
const keyOf = (kind, uid) => `${kind}:${uid}`;
const etKey = e => keyOf(e.kind, e.uid);
const fieldKey = f => keyOf(f.isBuilder ? 'matrix' : 'field', f.uid);
const useKey = u => (u.ownerKind === 'matrix' ? fieldKey(u.owner) : etKey(u.owner));
function nodeOf(key) {
  if (!key) return null;
  const i = key.indexOf(':');
  const kind = key.slice(0, i), uid = key.slice(i + 1);
  const obj = kind === 'group' ? by.group[uid] : kind === 'site' ? by.site[uid] : kind === 'section' ? by.section[uid]
    : kind === 'page' || kind === 'block' ? by.et[uid] : kind === 'matrix' || kind === 'field' ? by.field[uid]
    : kind === 'usergroup' || kind === 'schema' ? by[kind][uid] : null;
  return obj ? { kind, uid, obj, key } : null;
}

// Entry types that contain a field, looking through content blocks.
function ownersOfField(f, seen = new Set()) {
  if (seen.has(f.uid)) return [];
  seen.add(f.uid);
  return f.usedIn.flatMap(u => (u.ownerKind === 'matrix' ? ownersOfField(u.owner, seen) : [u.owner]));
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
const buildersOf = e => customElements(e.tabs).map(x => x.f).filter(f => f.type === 'Matrix');

const unusedFields = M.fields.filter(f => !f.usedIn.length);
const unprefixedEntryTypes = M.entryTypes.filter(e => !e.conventionOk);
const byName = (a, b) => a.name.localeCompare(b.name);

// ---- access: user groups and GraphQL schemas, a layer the header pickers switch on over every view
const ACCESS = ['usergroup', 'schema'];
const accessList = kind => (kind === 'usergroup' ? M.userGroups : M.gqlSchemas);
const shownAccess = { usergroup: new Set(), schema: new Set() };
const activeAccess = kind => accessList(kind).filter(a => shownAccess[kind].has(a.uid));
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
