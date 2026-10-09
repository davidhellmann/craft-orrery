// Shared rendering helpers and the detail renderer used by every view.
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const glyph = kind => `<span class="g g-${kind}" aria-hidden="true"></span>`;
const kindLabel = kind => `<span class="kind">${glyph(kind)}${KIND[kind].label}</span>`;
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
function chip(key, extra = '') {
  const n = nodeOf(key);
  return n ? `<span class="chip link" data-go="${key}">${glyph(n.kind)}${nameOf(n)}${accessMarks(key)}${extra}</span>` : '';
}
function row(key, note = '') {
  const n = nodeOf(key);
  return n ? `<div class="row link" data-go="${key}">${glyph(n.kind)}<span class="grow">${nameOf(n)}</span>${accessMarks(key)}${note}</div>` : '';
}
// A row with a second line underneath, for rights that don't fit next to the name.
function stackedRow(key, sub, faint = false) {
  const n = nodeOf(key);
  return n ? `<div class="row link stacked" data-go="${key}">${glyph(n.kind)}<span class="grow"><span class="name">${esc(n.obj.name)}</span><span class="sub${faint ? ' faint' : ''}">${esc(sub)}</span></span>${accessMarks(key)}</div>` : '';
}
const note = s => (s ? `<span class="note">${s}</span>` : '');
const typeTag = f => `<span class="tag">${esc(fieldTypeLabel(f))}</span>`;
const reqTag = el => (el && el.required ? `<span class="tag solid">${t('req')}</span>` : '');
const condTag = el => (el && el.conditional ? `<span class="tag outline">${t('if')}</span>` : '');
// A section or Matrix field can give an entry type a name of its own there. It counts only if it differs, and the
// note reads "as “Pull quote”". Both are plain text, to escape where they're drawn.
const perUseName = (e, name) => (name && name !== e.name ? name : '');
const perUseNote = (e, name) => (perUseName(e, name) ? t('as {name}', { name: quoted(name) }) : '');
const sectionEntryTypes = s => `<div class="list">${s.entryTypes.map(u => byUid.et[u]).filter(Boolean).map(e => row(etKey(e), note(esc(perUseNote(e, s.contexts[e.uid]) || e.handle)))).join('')}</div>`;
const prefixTag = e => (e.conventionOk === false ? `<span class="tag outline" title="${t('Handle doesn’t start with a prefix set in the plugin settings')}">${t('no {prefix}', { prefix: `<code>${esc(e.prefix)}</code>` })}</span>` : '');

const CLOSE_ICON = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
const closeButton = (label, attr) => `<button class="icon-btn close" type="button" ${attr} aria-label="${label}" title="${label}">${CLOSE_ICON}</button>`;
// What a view is and how to read it: a card floating over the view, switched on from the header.
const infoCard = html => `<aside class="info floating">${closeButton(t('Hide info'), 'data-info-close')}${html}</aside>`;

// Wires every [data-go] inside root to the app's navigation.
function bindGo(root, go) {
  root.querySelectorAll('[data-go]').forEach(el => el.addEventListener('click', ev => {
    ev.stopPropagation();
    if (el.dataset.go) go(el.dataset.go);
  }));
}

function fieldDetail(f) {
  if (f.options) {
    return `<h3>${t('Options')}</h3><div class="list">${f.options.map(o => `<div class="row"><span class="grow">${esc(o.label)}</span><code class="faint">${esc(o.value)}</code>${o.default ? `<span class="tag solid">${t('default')}</span>` : ''}</div>`).join('')}</div>`;
  }
  if (f.role === 'relation') {
    return `<h3>${t('Pulls from')}</h3><div class="chips">${f.allSources ? `<span class="chip">${t('any section')}</span>` : f.targets.map(s => chip(keyOf('section', s.uid))).join('') || '<span class="chip">—</span>'}</div><p class="muted" style="margin:8px 0 0">${f.max === 1 ? t('One entry') : f.max ? t('Up to {n} entries', { n: f.max }) : t('Any number of entries')}</p>`;
  }
  if (f.blocks) {
    return `<h3>${t('Blocks ({n})', { n: f.blocks.length })}</h3>${blockGroups(f).map(([g, blocks]) => `${g ? `<div class="sub-label" style="padding-left:0">${esc(g)}</div>` : ''}<div class="list">${blocks.map(b => {
      const e = byUid.et[b.entryType];
      return e ? row(etKey(e), note(esc(perUseNote(e, b.context)))) : '';
    }).join('')}</div>`).join('')}`;
  }
  if (f.tabs) {
    return `<h3>${t('Contains')}</h3><div class="list">${customElements(f.tabs).map(({ el, f: inner }) => row(fieldKey(inner), `${note(el.label && el.label !== inner.name ? quoted(esc(el.label)) : '')}${reqTag(el)}`)).join('')}</div>`;
  }
  return '';
}

// Which of the switched-on groups and schemas reach a node, and what they may do there.
function accessHTML(n) {
  const items = ACCESS.filter(kind => accessApplies(kind, n.kind)).flatMap(kind => activeAccess(kind).map(a => [kind, a, rightsOn(a, kind, n.key)]));
  if (!items.length) return '';
  return `<h3>${t('Access')}</h3><div class="list">${items.map(([kind, a, rights]) => stackedRow(keyOf(kind, a.uid), rights ? rightsText(kind, rights) : t('No access'), !rights)).join('')}</div>`;
}

const ELEMENT_SCOPES = { drafts: t('Drafts'), revisions: t('Revisions'), inactive: t('Disabled elements') };

// Everything a user group or schema can reach.
function accessDetail(n) {
  const a = n.obj, kind = n.kind;
  const none = `<p class="muted" style="margin:0">${t('None')}</p>`;
  const sites = model.sites.filter(s => a.sites.includes(s.uid));
  let h = `<h3>${t('Sites')}</h3>${sites.length ? `<div class="chips">${sites.map(s => chip(keyOf('site', s.uid))).join('')}</div>` : none}`;
  const secs = model.sections.filter(s => a.sections[s.uid]).sort(byName);
  h += `<h3>${t('Sections ({n})', { n: secs.length })}</h3>${secs.length ? `<div class="list">${secs.map(s => stackedRow(keyOf('section', s.uid), rightsText(kind, a.sections[s.uid]))).join('')}</div>` : none}`;
  if (kind === 'schema') {
    const builders = model.fields.filter(f => a.fields[f.uid]).sort(byName);
    if (builders.length) h += `<h3>${t('Builders ({n})', { n: builders.length })}</h3><div class="list">${builders.map(f => stackedRow(fieldKey(f), rightsText(kind, a.fields[f.uid]))).join('')}</div>`;
    if (a.elements.length) h += `<h3>${t('Also queries')}</h3><div class="chips">${a.elements.map(e => `<span class="chip">${esc(ELEMENT_SCOPES[e] || e)}</span>`).join('')}</div>`;
  }
  return h;
}

// "What is this, where does it live, where is it used" — the right-hand panel of every view.
function detailHTML(n, { title = true } = {}) {
  const o = n.obj;
  let h = '';
  if (title) {
    h += `<div style="display:flex;gap:8px;align-items:center;margin-bottom:6px;flex-wrap:wrap">${kindLabel(n.kind)}${isField(n.kind) ? typeTag(o) : ''}${prefixTag(o)}${o.public ? `<span class="tag outline">${t('public')}</span>` : ''}</div>`;
    h += `<h2>${esc(o.name)}</h2>`;
    if (o.handle) h += `<div class="mono faint" style="margin-top:3px">${esc(o.handle)}${o.gql ? ` · ${esc(o.gql)}` : ''}</div>`;
    if (o.instructions || o.description) h += `<p class="muted" style="margin:8px 0 0">${esc(o.instructions || o.description)}</p>`;
  }
  if (KIND[n.kind].layer) return h + accessDetail(n);
  h += accessHTML(n);

  if (n.kind === 'group') {
    h += `<h3>${t('Sites')}</h3><div class="list">${o.sites.map(s => row(keyOf('site', s.uid), note(esc(s.language)))).join('')}</div>`;
    const secs = model.sections.filter(s => s.groups.includes(o.uid)).sort(byName);
    h += `<h3>${t('Sections ({n})', { n: secs.length })}</h3><div class="list">${secs.map(s => row(keyOf('section', s.uid), note(sectionType(s)))).join('')}</div>`;
  }
  if (n.kind === 'site') {
    h += `<h3>${t('Site')}</h3><div class="list"><div class="row"><span class="grow">${t('Group')}</span>${chip(keyOf('group', o.group))}</div><div class="row"><span class="grow">${t('Language')}</span><code>${esc(o.language)}</code></div><div class="row"><span class="grow">${t('Base URL')}</span><code>${esc(o.baseUrl)}</code></div></div>`;
    h += `<h3>${t('Sections ({n})', { n: o.sections.length })}</h3><div class="list">${o.sections.slice().sort(byName).map(s => row(keyOf('section', s.uid), note(sectionType(s)))).join('')}</div>`;
  }
  if (n.kind === 'section') {
    h += `<h3>${t('URLs')}</h3><div class="list">${o.sites.map(ss => byUid.site[ss.site] ? `<div class="row"><span class="grow">${esc(byUid.site[ss.site].name)}</span>${ss.hasUrls ? `<code>${esc(ss.uriFormat)}</code>` : `<span class="faint">${t('no URLs')}</span>`}</div>` : '').join('')}</div>`;
    h += `<h3>${t('Entry types')}</h3>${sectionEntryTypes(o)}`;
    if (o.referencedBy.length) h += `<h3>${t('Pulled in by')}</h3><div class="list">${o.referencedBy.map(f => row(fieldKey(f), note(t('{n}× used', { n: f.usedIn.length })))).join('')}</div>`;
    if (o.previewTargets.length) h += `<h3>${t('Preview targets')}</h3><div class="chips">${o.previewTargets.map(p => `<span class="chip">${esc(p)}</span>`).join('')}</div>`;
  }
  if (isEntryType(n.kind)) {
    if (o.sections.length) h += `<h3>${t('Lives in')}</h3><div class="list">${o.sections.map(s => row(keyOf('section', s.uid), note(sectionType(s)))).join('')}</div>`;
    if (o.builders.length) h += `<h3>${t('Available in')}</h3><div class="list">${o.builders.map(b => row(fieldKey(b.field), note(esc(perUseNote(o, b.context) || b.group || '')))).join('')}</div>`;
    if (n.kind === 'unused') h += `<h3>${t('Lives in')}</h3><p class="muted" style="margin:0">${t('No section or Matrix field has it.')}</p>`;
    const sites = [...sitesOfEt(o)].map(u => byUid.site[u]).filter(Boolean);
    if (sites.length) h += `<h3>${t('Ends up on')}</h3><div class="chips">${sites.map(s => chip(keyOf('site', s.uid))).join('')}</div>`;
    const pulls = n.kind === 'block' ? [...pullsFrom(o)] : [];
    if (pulls.length) h += `<h3>${t('Pulls content from')}</h3><div class="chips">${pulls.map(s => chip(keyOf('section', s.uid))).join('')}</div>`;
  }
  if (isEntryType(n.kind) || isLayoutOwner(n.kind)) {
    const els = customElements(o.tabs);
    h += `<h3>${t('Fields ({n})', { n: els.length })}</h3><div class="list">${els.map(({ el, f }) => row(fieldKey(f), `${note(el.label && el.label !== f.name ? quoted(esc(el.label)) : '')}${reqTag(el)}${typeTag(f)}`)).join('')}</div>`;
  }
  if (isField(n.kind)) {
    h += fieldDetail(o);
    h += `<h3>${t('Used in ({n})', { n: o.usedIn.length })}</h3>${o.usedIn.length
      ? `<div class="list">${o.usedIn.map(u => row(useKey(u), `${note(u.el.handle ? esc(u.el.handle) : u.el.label ? quoted(esc(u.el.label)) : '')}${reqTag(u.el)}${condTag(u.el)}`)).join('')}</div>`
      : `<p class="muted" style="margin:0">${t('Not used in any field layout.')}</p>`}`;
  }
  return h;
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
  inner.innerHTML = n ? `<div class="inner">${closeButton(t('Close details'), 'data-close')}${detailHTML(n)}${crossLinks(key, here)}</div>` : '';
  const close = inner.querySelector('[data-close]');
  if (close) close.addEventListener('click', () => go(null));
  bindGo(inner, go);
  inner.scrollTop = 0;
}
