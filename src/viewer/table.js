// Table view: the content model one kind at a time, from site groups down to fields, and the user groups and GraphQL
// schemas that reach into it. Each row has the things it's tied to as chips.
registerView((() => {
  let el, body, side, countEl;
  const state = { mode: 'fields', q: '', type: '', kind: '', group: '', language: '', sectionType: '', rights: '', unused: false, unprefixed: false, sort: 'name', dir: 1, selected: null, row: null, chip: -1 };

  const fieldTypes = [...new Set(model.fields.map(fieldTypeLabel))].sort();
  const languages = [...new Set(model.sites.map(s => s.language))].sort();
  const renamed = html => (html ? ` <em>${html}</em>` : '');
  // A layout that renames the field, or a section or Builder the entry type, says so. A field's new name is left out
  // where it's the layout's own name.
  const usedChip = u => chip(useKey(u), renamed(renameNote(u.el, byUid.field[u.el.field], { label: u.el.label !== u.owner.name, handle: false })));
  const fieldChip = ({ el, f }) => chip(fieldKey(f), '', usedNameHTML(el, f));
  const chips = (list, none = '—') => `<div class="chips">${list.join('') || `<span class="faint">${none}</span>`}</div>`;
  const handle = o => `<code class="faint">${esc(o.handle)}</code>`;
  const sitesOf = uids => model.sites.filter(s => uids.includes(s.uid));
  const groupsOfSites = uids => new Set(uids.map(u => byUid.site[u] && byUid.site[u].group).filter(Boolean));
  const sectionsOfGroup = g => model.sections.filter(s => s.groups.includes(g.uid));
  // Craft's propagation methods in a word, with the sentence for the tooltip.
  const PROPAGATION_SHORT = { none: 'None', siteGroup: 'Site group', language: 'Language', all: 'All sites', custom: 'Custom' };
  // What a user group or schema has rights on that the viewer knows, as [key, rights]: sections, and a schema's Builders.
  const rightsList = a => [
    ...Object.entries(a.sections).map(([uid, rights]) => [keyOf('section', uid), rights]),
    ...Object.entries(a.fields || {}).map(([uid, rights]) => [byUid.field[uid] ? fieldKey(byUid.field[uid]) : '', rights]),
  ].filter(([key]) => nodeOf(key));
  // A schema reads what it has `read` on and writes what it may create, save or delete.
  const reads = a => rightsList(a).filter(([, rights]) => rights.includes('read'));
  const writes = a => rightsList(a).map(([key, rights]) => /** @type {[string, string[]]} */ ([key, rights.filter(r => r !== 'read')])).filter(([, rights]) => rights.length);

  // ---- filters: a dropdown or a checkbox, kept in `state[id]`, that keeps a row if `test(o, value)` holds
  const groupFilter = test => ({ id: 'group', label: KIND.group.label, all: 'All site groups', options: () => model.siteGroups.map(g => [g.uid, g.name]), test });

  // ---- the table's modes, in the order of their tabs: the index of what they list, their columns and their filters.
  // A column is { id, label, cell(o) } with a width `w`, a `sort(o)` and `num` for a number. `minWidth` is how narrow
  // the table gets before it scrolls sideways.
  const name = { id: 'name', sort: o => o.name, w: '18%', cls: 'name', cell: o => `${glyph(o.kind, o)} ${esc(o.name)}${accessMarks(keyOf(o.kind, o.uid))}` };
  const MODES = {
    groups: { index: 'group', label: KIND.group.plural, one: 'site group', other: 'site groups', minWidth: 640, columns: [
      { ...name, label: 'Site group', w: '24%' },
      { id: 'sites', label: 'Sites', cell: o => chips(o.sites.map(s => chip(keyOf('site', s.uid)))) },
      { id: 'sections', label: 'Sections', sort: o => sectionsOfGroup(o).length, num: true, w: '96px', cell: o => sectionsOfGroup(o).length },
    ], filters: [] },
    sites: { index: 'site', label: KIND.site.plural, one: 'site', other: 'sites', minWidth: 980, columns: [
      { ...name, label: 'Site', cell: o => `${name.cell(o)}${o.primary ? ' <span class="tag outline">primary</span>' : ''}` },
      { id: 'handle', label: 'Handle', sort: o => o.handle, w: '12%', cell: handle },
      { id: 'language', label: 'Language', sort: o => o.language, w: '96px', cell: o => `<code>${esc(o.language)}</code>` },
      { id: 'baseUrl', label: 'Base URL', sort: o => o.baseUrl || '', w: '24%', cell: o => `<code class="faint">${esc(o.baseUrl)}</code>` },
      { id: 'group', label: KIND.group.label, sort: o => (byUid.group[o.group] || {}).name || '', cell: o => chips([chip(keyOf('group', o.group))]) },
      { id: 'sections', label: 'Sections', sort: o => o.sections.length, num: true, w: '96px', cell: o => o.sections.length },
    ], filters: [
      groupFilter((o, g) => o.group === g),
      { id: 'language', label: 'Language', all: 'All languages', options: () => languages.map(l => [l, l]), test: (o, l) => o.language === l },
    ] },
    sections: { index: 'section', label: KIND.section.plural, one: 'section', other: 'sections', minWidth: 1320, columns: [
      { ...name, label: 'Section', w: '15%' },
      { id: 'handle', label: 'Handle', sort: o => o.handle, w: '12%', cell: handle },
      { id: 'type', label: 'Type', sort: o => o.type, w: '96px', cell: o => `<span class="tag">${esc(o.type)}</span>` },
      { id: 'propagation', label: 'Propagation', sort: o => o.propagationMethod, w: '108px', cell: o => `<span title="${esc(propagationText(o))}">${esc(PROPAGATION_SHORT[o.propagationMethod] || o.propagationMethod)}</span>` },
      // Each site as a small table of its own: the site, its URI format, and whether new entries start out enabled there.
      { id: 'sites', label: 'Sites · URI format', w: '36%', sort: o => (o.sites.find(ss => ss.hasUrls) || {}).uriFormat || '', cell: o => `<div class="uris">${o.sites.filter(ss => byUid.site[ss.site]).map(ss => `<span>${chip(keyOf('site', ss.site))}</span><span>${ss.hasUrls
        ? `<code>${esc(ss.uriFormat)}</code>`
        : '<span class="faint">no URLs</span>'}</span><span>${statusToggle(ss)}</span>`).join('')}</div>` },
      { id: 'entryTypes', label: 'Entry types', cell: o => chips(o.entryTypes.map(u => byUid.et[u] && chip(etKey(byUid.et[u]), '', usedNameHTML(o.as[u], byUid.et[u]))).filter(Boolean)) },
    ], filters: [
      { id: 'sectionType', label: 'Section type', all: 'All types', options: () => ['single', 'channel', 'structure'].map(t => [t, t]), test: (o, t) => o.type === t },
      groupFilter((o, g) => o.groups.includes(g)),
    ] },
    entryTypes: { index: 'et', label: 'Entry types', one: 'entry type', other: 'entry types', minWidth: 1100, columns: [
      { ...name, label: 'Entry type' },
      { id: 'handle', label: 'Handle', sort: o => o.handle, w: '16%', cell: o => `${handle(o)} ${prefixTag(o)}` },
      { id: 'kind', label: 'Kind', sort: o => o.kind, w: '76px', cell: o => `<span class="tag">${KIND[o.kind].label}</span>` },
      { id: 'lives', label: 'Lives in', w: '22%', cell: o => chips(o.kind === 'page'
        ? o.sections.map(s => chip(keyOf('section', s.uid), renamed(renameNote(s.as[o.uid], o, { handle: false }))))
        : o.builders.map(b => chip(fieldKey(b.field), renamed(renameNote(b.as, o, { handle: false }))))) },
      { id: 'uses', label: '#', sort: o => layoutFields(o.tabs).length, num: true, w: '52px', cell: o => layoutFields(o.tabs).length },
      { id: 'where', label: 'Fields', cell: o => `<div class="chips">${layoutFields(o.tabs).map(fieldChip).join('')}</div>` },
    ], filters: [
      { id: 'kind', label: 'Kind', all: 'All kinds', options: () => Object.keys(KIND).filter(isEntryType).map(k => [k, KIND[k].plural]), test: (o, k) => o.kind === k },
      groupFilter((o, g) => groupsOfEt(o).has(g)),
      ...(checksHandles ? [{ id: 'unprefixed', label: 'only without prefix', check: true, test: o => !o.conventionOk }] : []),
    ] },
    fields: { index: 'field', label: 'Fields', one: 'field', other: 'fields', minWidth: 1000, columns: [
      { ...name, label: 'Field', w: '20%' },
      { id: 'handle', label: 'Handle', sort: o => o.handle, w: '17%', cell: handle },
      { id: 'type', label: 'Type', sort: o => fieldTypeLabel(o), w: '120px', cell: typeTag },
      { id: 'uses', label: 'Uses', sort: o => o.usedIn.length, num: true, w: '64px', cls: o => (o.usedIn.length ? '' : 'zero'), cell: o => o.usedIn.length },
      { id: 'where', label: 'Used in', cell: o => chips(o.usedIn.map(usedChip), 'not used') },
    ], filters: [
      { id: 'type', label: 'Field type', all: 'All types', options: () => fieldTypes.map(t => [t, t]), test: (o, t) => fieldTypeLabel(o) === t },
      groupFilter((o, g) => groupsOfField(o).has(g)),
      { id: 'unused', label: 'only unused', check: true, test: o => !o.usedIn.length },
    ] },
    userGroups: { index: 'usergroup', label: KIND.usergroup.plural, one: 'user group', other: 'user groups', minWidth: 1000, columns: [
      { ...name, label: 'User group' },
      { id: 'handle', label: 'Handle', sort: o => o.handle, w: '13%', cell: handle },
      { id: 'sites', label: 'Sites', w: '20%', cell: o => chips(sitesOf(o.sites).map(s => chip(keyOf('site', s.uid)))) },
      { id: 'count', label: '#', sort: o => rightsList(o).length, num: true, w: '52px', cell: o => rightsList(o).length },
      { id: 'sections', label: 'Sections', cell: o => chips(rightsList(o).map(([key, rights]) => chip(key, renamed(esc(rightsText('usergroup', rights)))))) },
    ], filters: [groupFilter((o, g) => groupsOfSites(o.sites).has(g))] },
    schemas: { index: 'schema', label: KIND.schema.plural, one: 'schema', other: 'schemas', minWidth: 1100, columns: [
      { ...name, label: 'Schema', w: '15%', cell: o => `${name.cell(o)}${o.public ? ' <span class="tag outline">public</span>' : ''}` },
      { id: 'sites', label: 'Sites', w: '16%', cell: o => chips(sitesOf(o.sites).map(s => chip(keyOf('site', s.uid)))) },
      { id: 'read', label: 'Reads', sort: o => reads(o).length, cell: o => chips(reads(o).map(([key]) => chip(key))) },
      { id: 'write', label: 'Writes', sort: o => writes(o).length, w: '28%', cell: o => chips(writes(o).map(([key, rights]) => chip(key, renamed(esc(rights.join(', ')))))) },
      { id: 'elements', label: 'Also queries', w: '14%', cell: o => chips(o.elements.map(e => `<span class="chip">${esc(ELEMENT_SCOPES[e] || e)}</span>`)) },
    ], filters: [
      { id: 'rights', label: 'Rights', all: 'Reads and writes', options: () => [['write', 'Can write'], ['read', 'Only reads']], test: (o, r) => (r === 'write') === writes(o).length > 0 },
      groupFilter((o, g) => groupsOfSites(o.sites).has(g)),
    ] },
  };
  const mode = () => MODES[state.mode];

  // ---- column widths: dragged ones are kept per mode, in px, until a double-click on a column's edge resets the mode
  const WIDTHS_KEY = 'orrery-table-widths';
  let widths = {};
  try { widths = JSON.parse(localStorage.getItem(WIDTHS_KEY) || '{}'); } catch (e) {}
  const saveWidths = () => { try { localStorage.setItem(WIDTHS_KEY, JSON.stringify(widths)); } catch (e) {} };
  // The last column takes what's left, at least AUTO_MIN.
  const AUTO_MIN = 240;
  const minWidth = () => Math.max(mode().minWidth, Object.values(widths[state.mode] || {}).reduce((a, w) => a + w, 0) + AUTO_MIN);

  function rows() {
    const m = mode();
    return Object.values(byUid[m.index]).filter(o => matchesSearch(o, state.q) && m.filters.every(f => !state[f.id] || f.test(o, state[f.id])));
  }

  function draw() {
    const m = mode(), cols = m.columns, own = widths[state.mode] || {};
    const sortCol = cols.find(c => c.id === state.sort && c.sort) || cols[0];
    const list = rows().sort((a, b) => {
      const x = sortCol.sort(a), y = sortCol.sort(b);
      return (typeof x === 'number' ? x - y : String(x).localeCompare(String(y))) * state.dir || byName(a, b);
    });
    countEl.textContent = count(list.length, m.one, m.other);
    const last = cols.length - 1;
    const head = cols.map((c, i) => `<th class="${c.sort ? 'sort' : ''}" data-sort="${c.sort ? c.id : ''}" ${c.num ? 'style="text-align:right"' : ''}>${c.label}<span class="arrow">${c.id === sortCol.id ? (state.dir > 0 ? ' ↑' : ' ↓') : ''}</span>${i < last ? `<span class="rsz" data-col="${c.id}" title="Drag to resize, double-click to reset"></span>` : ''}</th>`).join('');
    const cell = (c, o) => `<td class="${[c.num && 'num', typeof c.cls === 'function' ? c.cls(o) : c.cls].filter(Boolean).join(' ')}">${c.cell(o)}</td>`;
    body.innerHTML = `<table class="t" style="min-width:${minWidth()}px"><colgroup>${cols.map((c, i) => `<col data-col="${c.id}" style="width:${i < last && own[c.id] ? `${own[c.id]}px` : c.w || 'auto'}">`).join('')}</colgroup><thead><tr>${head}</tr></thead><tbody>${list.map(o => `<tr data-row="${keyOf(o.kind, o.uid)}">${cols.map(c => cell(c, o)).join('')}</tr>`).join('')}</tbody></table>`;
    mark();
    body.querySelectorAll('th[data-sort]').forEach(th => th.dataset.sort && th.addEventListener('click', ev => {
      if (/** @type {Element} */ (ev.target).closest('.rsz')) return;
      state.dir = state.sort === th.dataset.sort ? -state.dir : cols.find(c => c.id === th.dataset.sort).num ? -1 : 1;
      state.sort = th.dataset.sort;
      draw();
    }));
    body.querySelectorAll('.rsz').forEach(r => resizer(/** @type {HTMLElement} */ (r)));
    body.querySelectorAll('tr[data-row]').forEach(tr => tr.addEventListener('click', () => App.go('table', tr.dataset.row)));
    bindGo(body, (k, chipEl) => {
      const tr = chipEl.closest('tr');
      App.go('table', k, { row: tr.dataset.row, chip: [...tr.querySelectorAll('[data-go]')].indexOf(chipEl) });
    });
  }
  // Dragging a column's edge sets its width. The first drag in a mode keeps every column but the last at the width it
  // has, so the others stay put.
  function resizer(handle) {
    const table = /** @type {HTMLElement} */ (body.querySelector('table'));
    handle.addEventListener('dblclick', ev => { ev.stopPropagation(); delete widths[state.mode]; saveWidths(); draw(); });
    handle.addEventListener('pointerdown', ev => {
      ev.preventDefault();
      ev.stopPropagation();
      const cols = mode().columns;
      if (!widths[state.mode]) {
        const ths = [...table.querySelectorAll('th')];
        widths[state.mode] = Object.fromEntries(cols.slice(0, -1).map((c, i) => [c.id, Math.round(ths[i].getBoundingClientRect().width)]));
      }
      const own = widths[state.mode], id = handle.dataset.col, x0 = ev.clientX, w0 = own[id];
      const col = /** @type {HTMLElement} */ (table.querySelector(`col[data-col="${id}"]`));
      cols.slice(0, -1).forEach(c => { /** @type {HTMLElement} */ (table.querySelector(`col[data-col="${c.id}"]`)).style.width = `${own[c.id]}px`; });
      handle.classList.add('on');
      handle.setPointerCapture(ev.pointerId);
      const move = e => {
        own[id] = Math.max(48, Math.round(w0 + e.clientX - x0));
        col.style.width = `${own[id]}px`;
        table.style.minWidth = `${minWidth()}px`;
      };
      const up = () => { handle.classList.remove('on'); handle.removeEventListener('pointermove', move); saveWidths(); };
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', up, { once: true });
      handle.addEventListener('pointercancel', up, { once: true });
    });
    handle.addEventListener('click', ev => ev.stopPropagation());
  }
  // Marks the selected row. A chip picked in a row keeps that row marked, and the chip itself too. The chip goes by
  // its place in the row: a field placed twice in one layout gives two chips to the same entry type.
  function mark() {
    const at = state.row || state.selected;
    body.querySelectorAll('tr[data-row]').forEach(tr => {
      tr.classList.toggle('on', tr.dataset.row === at);
      tr.querySelectorAll('[data-go]').forEach((c, i) => c.classList.toggle('on', tr.dataset.row === state.row && i === state.chip));
    });
  }
  function filters() {
    const f = el.querySelector('[data-filters]');
    f.innerHTML = mode().filters.map(x => (x.check
      ? `<label class="check"><input type="checkbox" data-f="${x.id}" ${state[x.id] ? 'checked' : ''}> ${x.label}</label>`
      : `<select data-f="${x.id}" aria-label="${x.label}"><option value="">${x.all}</option>${x.options().map(([value, label]) => `<option value="${esc(value)}" ${value === state[x.id] ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select>`)).join('');
    f.querySelectorAll('[data-f]').forEach(x => x.addEventListener('change', () => { state[x.dataset.f] = x.type === 'checkbox' ? x.checked : x.value; draw(); }));
  }
  function setMode(id) {
    state.mode = id;
    state.sort = 'name';
    state.dir = 1;
    el.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('on', b.dataset.mode === id));
    filters();
    draw();
  }
  const panel = () => showDetails(side, state.selected, 'table', k => App.go('table', k));
  const info = () => `<h2>The content model as lists</h2><p>One tab for each kind, from site groups down to fields, and the user groups and GraphQL schemas that reach into it. Each row has what it’s tied to as chips: a field the layouts it’s placed in, an entry type its fields, a schema what it reads and what it writes.</p><p>A pencil marks a field or entry type renamed where it’s used.</p><p>Click a row or a chip for details. Drag the edge of a column to resize it, double-click it to reset the widths.</p>`;

  function mount(root) {
    el = root;
    el.innerHTML = `
      <div class="tbl-wrap">
        <div class="tbl-head">
          <div class="seg" role="tablist">${Object.keys(MODES).map(id => `<button data-mode="${id}" class="${id === state.mode ? 'on' : ''}">${MODES[id].label}</button>`).join('')}</div>
          <div class="toolbar">
            <input type="search" placeholder="Search name or handle" aria-label="Search">
            <div class="toolbar" data-filters></div>
            <span class="tbl-count"></span>
          </div>
        </div>
        <div class="tbl-body">
          <div class="scroll" data-body></div>
          ${infoCard(info())}
        </div>
      </div>
      ${PANEL_HTML}`;
    body = el.querySelector('[data-body]');
    side = el.querySelector('.panel');
    countEl = el.querySelector('.tbl-count');
    el.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));
    const search = el.querySelector('input[type=search]');
    search.addEventListener('input', () => { state.q = search.value.trim().toLowerCase(); draw(); });
    filters();
    draw();
    panel();
  }

  return {
    id: 'table',
    label: 'Table',
    crossLink: 'Show in table',
    // Whatever has a tab, and whatever holds fields in a field layout.
    kinds: Object.keys(KIND).filter(k => Object.values(MODES).some(m => m.index === KIND[k].index) || isLayoutOwner(k)),
    info,
    mount,
    show(key, opts = {}) {
      const n = nodeOf(key);
      // a deep link opens the tab of its kind
      if (n && opts.fromHash) {
        const id = Object.keys(MODES).find(m => MODES[m].index === KIND[n.kind].index) || state.mode;
        if (id !== state.mode) setMode(id);
      }
      state.selected = n ? key : null;
      state.row = (n && opts.row) || null;
      state.chip = state.row ? opts.chip : -1;
      mark();
      const on = body.querySelector('tr.on');
      if (on && opts.fromHash) on.scrollIntoView({ block: 'center' });
      panel();
    },
    escape() { if (state.selected) App.go('table', null); },
    refresh() { draw(); panel(); },
  };
})());
