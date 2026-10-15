// Shared rendering helpers and the detail renderer used by every view.
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// A field layout outside the graph shares one look whatever its kind. Given the object, an entry type's glyph takes its
// colour (the Graph has it on the node's edge instead).
function glyph(kind, o = null) {
  const color = o ? colorOf(o) : '';
  return `<span class="g g-${kind}${isLayoutOwner(kind) ? ' layout-owner' : ''}${color ? ' colored' : ''}"${color ? ` style="--color: var(--${color})"` : ''} aria-hidden="true"></span>`;
}
const kindLabel = (kind, o = null) => `<span class="kind">${glyph(kind, o)}${KIND[kind].label}</span>`;
// Where a URI ends up on a site, or under the site's name if it has no base URL. Craft gives the homepage `__home__`.
const siteUrl = (site, uri) => `${(site.baseUrl || site.name).replace(/\/$/, '')}/${uri === '__home__' ? '' : uri || ''}`;
// What the search boxes find: q, already lowercased, anywhere in the name or handle.
const matchesSearch = (o, q) => !q || o.name.toLowerCase().includes(q) || (o.handle || '').toLowerCase().includes(q);

// A mark for each access layer (user groups, schemas) whose switched-on members reach the node.
function accessMarks(key) {
  return ACCESS.map(kind => {
    const names = activeAccess(kind).filter(a => rightsOn(a, kind, key)).map(a => a.name);
    return names.length ? `<span class="acc acc-${kind}" title="${esc(names.join(', '))}"></span>` : '';
  }).join('');
}

// Field layouts that aren't on the graph, like a global set's, say what they are: their glyph has no legend.
const nameOf = n => `${esc(n.obj.name)}${isLayoutOwner(n.kind) ? ` <span class="faint">· ${KIND[n.kind].label}</span>` : ''}`;
// `name` (HTML) stands in for the node's own name, like the name a field layout gives a field.
function chip(key, extra = '', name = '') {
  const n = nodeOf(key);
  return n ? `<span class="chip link" data-go="${key}">${glyph(n.kind, n.obj)}${name || nameOf(n)}${accessMarks(key)}${extra}</span>` : '';
}
function row(key, note = '', name = '') {
  const n = nodeOf(key);
  return n ? `<div class="row link" data-go="${key}">${glyph(n.kind, n.obj)}<span class="grow">${name || nameOf(n)}</span>${accessMarks(key)}${note}</div>` : '';
}
// A row with a second line underneath, for rights that don't fit next to the name.
function stackedRow(key, sub, faint = false) {
  const n = nodeOf(key);
  return n ? `<div class="row link stacked" data-go="${key}">${glyph(n.kind, n.obj)}<span class="grow"><span class="name">${esc(n.obj.name)}</span><span class="sub${faint ? ' faint' : ''}">${esc(sub)}</span></span>${accessMarks(key)}</div>` : '';
}
const note = s => (s ? `<span class="note">${s}</span>` : '');
// A count with the word that agrees with it: "1 field", "2 fields".
const count = (n, one, other) => `${n} ${n === 1 ? one : other}`;
const typeTag = f => `<span class="tag">${esc(fieldTypeLabel(f))}</span>`;
const reqTag = el => (el && el.required ? '<span class="tag solid">req</span>' : '');
const condTag = el => (el && el.conditional ? '<span class="tag outline">if</span>' : '');
// A field layout can give a field, and a section or Matrix field an entry type, a name and a handle of its own there,
// which templates and GraphQL use there. `as` is what it gives, shaped like a field layout element: { label, handle }.
// Each counts only if it differs. Both are plain text.
const usedName = (as, o) => (as.label && as.label !== o.name ? as.label : o.name);
const usedHandle = (as, o) => (as.handle && as.handle !== o.handle ? as.handle : '');
const isRenamed = (as, o) => usedName(as, o) !== o.name || !!usedHandle(as, o);
// Craft marks a renamed field or entry type with a pencil, and so does the viewer. Its tooltip names what it is.
const PENCIL_PATH = 'M8.4 1.6l2 2-6.3 6.3-2.7.7.7-2.7z';
const PENCIL = `<svg viewBox="0 0 12 12" aria-hidden="true"><path d="${PENCIL_PATH}" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>`;
const renamedTo = (as, o) => `${usedName(as, o)} (${usedHandle(as, o) || o.handle})`;
const originalText = o => `The ${isField(o.kind) ? 'field' : 'entry type'} is ${o.name} (${o.handle}).`;
const renamedText = (as, o) => `Renamed here to ${renamedTo(as, o)}. ${originalText(o)}`;
const renamedMark = (as, o) => (isRenamed(as, o) ? `<span class="renamed" title="${esc(renamedText(as, o))}">${PENCIL}</span>` : '');
// For where it's listed under what it renames: ✎ Listing Image listingImage, without the name or handle when asked.
function renameNote(as, o, { label = true, handle = true } = {}) {
  if (!isRenamed(as, o)) return '';
  const name = label && usedName(as, o) !== o.name ? ` ${esc(usedName(as, o))}` : '';
  return `${renamedMark(as, o)}${name}${handle && usedHandle(as, o) ? ` <code>${esc(usedHandle(as, o))}</code>` : ''}`;
}
// "as “Pull quote” block_quote", for where only text fits.
const renamedAs = (as, o) => (isRenamed(as, o) ? `as “${usedName(as, o)}”${usedHandle(as, o) ? ` ${usedHandle(as, o)}` : ''}` : '');
// A field or entry type as it's listed where it's used: under the name it gets there, with the pencil. `handleNote` is
// its handle there.
const usedNameHTML = (as, o) => `${esc(usedName(as, o))}${renamedMark(as, o)}`;
const handleNote = (as, o) => (usedHandle(as, o) ? note(`<code>${esc(usedHandle(as, o))}</code>`) : '');
const sectionEntryTypes = s => `<div class="list">${s.entryTypes.map(u => byUid.et[u]).filter(Boolean).map(e => row(etKey(e), note(esc(usedHandle(s.as[e.uid], e) || e.handle)), usedNameHTML(s.as[e.uid], e))).join('')}</div>`;
// Which other sites a section saves its entries to, as Craft's section settings put it.
const PROPAGATION = {
  none: 'Only save entries to the site they were created in',
  siteGroup: 'Save entries to other sites in the same site group',
  language: 'Save entries to other sites with the same language',
  all: 'Save entries to all sites enabled for this section',
  custom: 'Let each entry choose which sites it should be saved to',
};
const propagationText = s => PROPAGATION[s.propagationMethod] || s.propagationMethod;
const prefixTag = e => (e.conventionOk === false ? `<span class="tag outline" title="Handle doesn’t start with a prefix set in the plugin settings">no <code>${esc(e.prefix)}</code></span>` : '');

const CLOSE_ICON = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
const closeButton = (label, attr) => `<button class="icon-btn close" type="button" ${attr} aria-label="${label}" title="${label}">${CLOSE_ICON}</button>`;
// What a view is and how to read it: a card floating over the view, switched on from the header.
const infoCard = html => `<aside class="info floating">${closeButton('Hide info', 'data-info-close')}${html}</aside>`;

// Wires every [data-go] inside root to the app's navigation.
function bindGo(root, go) {
  root.querySelectorAll('[data-go]').forEach(el => el.addEventListener('click', ev => {
    ev.stopPropagation();
    if (el.dataset.go) go(el.dataset.go, el);
  }));
}

function fieldDetail(f) {
  if (f.options) {
    return `<h3>Options</h3><div class="list">${f.options.map(o => `<div class="row"><span class="grow">${esc(o.label)}</span><code class="faint">${esc(o.value)}</code>${o.default ? '<span class="tag solid">default</span>' : ''}</div>`).join('')}</div>`;
  }
  if (f.role === 'relation') {
    return `<h3>Pulls from</h3><div class="chips">${f.allSources ? '<span class="chip">any section</span>' : f.targets.map(s => chip(keyOf('section', s.uid))).join('') || '<span class="chip">—</span>'}</div><p class="muted" style="margin:8px 0 0">${f.max === 1 ? 'One entry' : f.max ? `Up to ${f.max} entries` : 'Any number of entries'}</p>`;
  }
  if (f.blocks) {
    return `<h3>Blocks (${f.blocks.length})</h3>${blockGroups(f).map(([g, blocks]) => `${g ? `<div class="sub-label" style="padding-left:0">${esc(g)}</div>` : ''}<div class="list">${blocks.map(b => {
      const e = byUid.et[b.entryType];
      return e ? row(etKey(e), handleNote(b.as, e), usedNameHTML(b.as, e)) : '';
    }).join('')}</div>`).join('')}`;
  }
  if (f.tabs) {
    return `<h3>Contains</h3><div class="list">${layoutFields(f.tabs).map(({ el, f: inner }) => row(fieldKey(inner), `${handleNote(el, inner)}${reqTag(el)}`, usedNameHTML(el, inner))).join('')}</div>`;
  }
  return '';
}

// Which of the switched-on groups and schemas reach a node, and what they may do there.
function accessHTML(n) {
  const items = ACCESS.filter(kind => accessApplies(kind, n.kind)).flatMap(kind => activeAccess(kind).map(a => [kind, a, rightsOn(a, kind, n.key)]));
  if (!items.length) return '';
  return `<h3>Access</h3><div class="list">${items.map(([kind, a, rights]) => stackedRow(keyOf(kind, a.uid), rights ? rightsText(kind, rights) : 'No access', !rights)).join('')}</div>`;
}

const ELEMENT_SCOPES = { drafts: 'Drafts', revisions: 'Revisions', inactive: 'Disabled elements' };

// Everything a user group or schema can reach.
function accessDetail(n) {
  const a = n.obj, kind = n.kind;
  const none = '<p class="muted" style="margin:0">None</p>';
  const sites = model.sites.filter(s => a.sites.includes(s.uid));
  let h = `<h3>Sites</h3>${sites.length ? `<div class="chips">${sites.map(s => chip(keyOf('site', s.uid))).join('')}</div>` : none}`;
  const secs = model.sections.filter(s => a.sections[s.uid]).sort(byName);
  h += `<h3>Sections (${secs.length})</h3>${secs.length ? `<div class="list">${secs.map(s => stackedRow(keyOf('section', s.uid), rightsText(kind, a.sections[s.uid]))).join('')}</div>` : none}`;
  if (kind === 'schema') {
    const builders = model.fields.filter(f => a.fields[f.uid]).sort(byName);
    if (builders.length) h += `<h3>Builders (${builders.length})</h3><div class="list">${builders.map(f => stackedRow(fieldKey(f), rightsText(kind, a.fields[f.uid]))).join('')}</div>`;
    if (a.elements.length) h += `<h3>Also queries</h3><div class="chips">${a.elements.map(e => `<span class="chip">${esc(ELEMENT_SCOPES[e] || e)}</span>`).join('')}</div>`;
  }
  return h;
}

// The fields of a field layout, with the label each gets there.
function layoutFieldsHTML(o) {
  const els = layoutFields(o.tabs);
  return `<h3>Fields (${els.length})</h3><div class="list">${els.map(({ el, f }) => row(fieldKey(f), `${handleNote(el, f)}${reqTag(el)}${typeTag(f)}`, usedNameHTML(el, f))).join('')}</div>`;
}

// What the details say about each kind after its name and access, by the index its objects are in: Pages, Blocks and
// unused entry types share theirs, and so do Builders and Fields. Field layouts outside the graph list their fields.
const DETAILS = {
  group: o => {
    const secs = model.sections.filter(s => s.groups.includes(o.uid)).sort(byName);
    return `<h3>Sites</h3><div class="list">${o.sites.map(s => row(keyOf('site', s.uid), note(esc(s.language)))).join('')}</div>`
      + `<h3>Sections (${secs.length})</h3><div class="list">${secs.map(s => row(keyOf('section', s.uid), note(s.type))).join('')}</div>`;
  },
  site: o => `<h3>Site</h3><div class="list"><div class="row"><span class="grow">Group</span>${chip(keyOf('group', o.group))}</div><div class="row"><span class="grow">Language</span><code>${esc(o.language)}</code></div><div class="row"><span class="grow">Base URL</span><code>${esc(o.baseUrl)}</code></div></div>`
    + `<h3>Sections (${o.sections.length})</h3><div class="list">${o.sections.slice().sort(byName).map(s => row(keyOf('section', s.uid), note(s.type))).join('')}</div>`,
  section: o => {
    let h = `<h3>URLs</h3><div class="list">${o.sites.map(ss => byUid.site[ss.site] ? `<div class="row"><span class="grow">${esc(byUid.site[ss.site].name)}</span>${ss.hasUrls ? `<code>${esc(ss.uriFormat)}</code>` : '<span class="faint">no URLs</span>'}</div>` : '').join('')}</div>`;
    h += `<h3>Propagation</h3><p class="muted" style="margin:0">${esc(propagationText(o))}</p>`;
    h += `<h3>Entry types</h3>${sectionEntryTypes(o)}`;
    if (o.referencedBy.length) h += `<h3>Pulled in by</h3><div class="list">${o.referencedBy.map(f => row(fieldKey(f), note(`${f.usedIn.length}× used`))).join('')}</div>`;
    if (o.previewTargets.length) h += `<h3>Preview targets</h3><div class="chips">${o.previewTargets.map(p => `<span class="chip">${esc(p)}</span>`).join('')}</div>`;
    return h;
  },
  et: (o, kind) => {
    let h = '';
    if (o.sections.length) h += `<h3>Lives in</h3><div class="list">${o.sections.map(s => row(keyOf('section', s.uid), note(renameNote(s.as[o.uid], o) || s.type))).join('')}</div>`;
    if (o.builders.length) h += `<h3>Available in</h3><div class="list">${o.builders.map(b => row(fieldKey(b.field), note(renameNote(b.as, o) || esc(b.group || '')))).join('')}</div>`;
    if (kind === 'unused') h += '<h3>Lives in</h3><p class="muted" style="margin:0">No section or Matrix field has it.</p>';
    const sites = [...sitesOfEt(o)].map(u => byUid.site[u]).filter(Boolean);
    if (sites.length) h += `<h3>Ends up on</h3><div class="chips">${sites.map(s => chip(keyOf('site', s.uid))).join('')}</div>`;
    const pulls = kind === 'block' ? [...pullsFrom(o)] : [];
    if (pulls.length) h += `<h3>Pulls content from</h3><div class="chips">${pulls.map(s => chip(keyOf('section', s.uid))).join('')}</div>`;
    return h + layoutFieldsHTML(o);
  },
  field: o => fieldDetail(o) + `<h3>Used in (${o.usedIn.length})</h3>${o.usedIn.length
    ? `<div class="list">${o.usedIn.map(u => row(useKey(u), `${note(renameNote(u.el, o))}${reqTag(u.el)}${condTag(u.el)}`)).join('')}</div>`
    : '<p class="muted" style="margin:0">Not used in any field layout.</p>'}`,
};

// "What is this, where does it live, where is it used" — the right-hand panel of every view.
function detailHTML(n, { title = true } = {}) {
  const o = n.obj;
  let h = '';
  if (title) {
    h += `<div style="display:flex;gap:8px;align-items:center;margin-bottom:6px;flex-wrap:wrap">${kindLabel(n.kind, o)}${isField(n.kind) ? typeTag(o) : ''}${prefixTag(o)}${o.public ? '<span class="tag outline">Public</span>' : ''}</div>`;
    h += `<h2>${esc(o.name)}</h2>`;
    if (o.handle) h += `<div class="mono faint" style="margin-top:3px">${esc(o.handle)}${o.gql ? ` · ${esc(o.gql)}` : ''}</div>`;
    if (o.instructions || o.description) h += `<p class="muted" style="margin:8px 0 0">${esc(o.instructions || o.description)}</p>`;
  }
  if (KIND[n.kind].layer) return h + accessDetail(n);
  const details = isLayoutOwner(n.kind) ? layoutFieldsHTML : DETAILS[KIND[n.kind].index];
  return h + accessHTML(n) + details(o, n.kind);
}

// ---- views: each view's script registers it, so the header lists the views in the order of the scripts.
// A view is { id, label, crossLink, kinds, info, mount(el), show(key, opts) }: its name in the header, the button that
// leads to it from the details of the kinds it has a place for, the text of its info card, and how it draws. It may add
// escape() for the Escape key and refresh() for when the access layers change.
const VIEWS = [];
const registerView = view => { VIEWS.push(view); return view; };

// Buttons that jump to the same thing in the other views that have a place for its kind.
function crossLinks(key, here) {
  const n = nodeOf(key);
  if (!n) return '';
  const links = VIEWS.filter(v => v.id !== here && v.kinds.includes(n.kind)).map(v => `<a class="btn" href="#${v.id}/${key}">${v.crossLink}</a>`);
  return links.length ? `<div class="actions">${links.join('')}</div>` : '';
}

// The panel next to the Graph and the Table with the details of what's selected there, or closed without a selection.
// `go` moves within the view; closing selects nothing.
const PANEL_HTML = '<aside class="panel"><div class="scroll" style="flex:1"></div></aside>';
function showDetails(panel, key, here, go) {
  const n = nodeOf(key);
  panel.classList.toggle('closed', !n);
  const inner = panel.querySelector('.scroll');
  inner.innerHTML = n ? `<div class="inner">${closeButton('Close details', 'data-close')}${detailHTML(n)}${crossLinks(key, here)}</div>` : '';
  const close = inner.querySelector('[data-close]');
  if (close) close.addEventListener('click', () => go(null));
  bindGo(inner, go);
  inner.scrollTop = 0;
}
