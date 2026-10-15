// Table view: which field sits where. Flip to entry types to read it the other way round.
registerView((() => {
  let el, body, side, countEl;
  const state = { mode: 'fields', q: '', type: '', kind: '', group: '', unused: false, unprefixed: false, sort: 'name', dir: 1, selected: null, row: null, chip: -1 };

  const fieldTypes = [...new Set(model.fields.map(fieldTypeLabel))].sort();
  const renamed = html => (html ? ` <em>${html}</em>` : '');
  // A layout that renames the field says so. Its new name is left out where it's the layout's own name.
  const usedChip = u => chip(useKey(u), renamed(renameNote(u.el, byUid.field[u.el.field], { label: u.el.label !== u.owner.name, handle: false })));
  const fieldChip = ({ el, f }) => chip(fieldKey(f), '', layoutFieldName(el, f));

  // The table's two modes, each with the index of the things it lists and its columns.
  const MODES = {
    fields: { index: 'field', columns: [
      { id: 'name', label: 'Field', sort: f => f.name, w: '20%' },
      { id: 'handle', label: 'Handle', sort: f => f.handle, w: '17%' },
      { id: 'type', label: 'Type', sort: f => fieldTypeLabel(f), w: '120px' },
      { id: 'uses', label: 'Uses', sort: f => f.usedIn.length, num: true, w: '64px' },
      { id: 'where', label: 'Used in' },
    ] },
    entryTypes: { index: 'et', columns: [
      { id: 'name', label: 'Entry type', sort: e => e.name, w: '18%' },
      { id: 'handle', label: 'Handle', sort: e => e.handle, w: '16%' },
      { id: 'kind', label: 'Kind', sort: e => e.kind, w: '76px' },
      { id: 'lives', label: 'Lives in', w: '22%' },
      { id: 'uses', label: '#', sort: e => layoutFields(e.tabs).length, num: true, w: '52px' },
      { id: 'where', label: 'Fields' },
    ] },
  };

  function rows() {
    if (state.mode === 'fields') {
      return model.fields.filter(f => matchesSearch(f, state.q) && (!state.type || fieldTypeLabel(f) === state.type) && (!state.unused || !f.usedIn.length) && (!state.group || groupsOfField(f).has(state.group)));
    }
    return model.entryTypes.filter(e => matchesSearch(e, state.q) && (!state.kind || e.kind === state.kind) && (!state.unprefixed || !e.conventionOk) && (!state.group || groupsOfEt(e).has(state.group)));
  }
  function cells(o) {
    if (state.mode === 'fields') {
      const key = fieldKey(o);
      return [key, `<td class="name">${glyph(o.kind)} ${esc(o.name)}${accessMarks(key)}</td><td><code class="faint">${esc(o.handle)}</code></td><td>${typeTag(o)}</td><td class="num ${o.usedIn.length ? '' : 'zero'}">${o.usedIn.length}</td><td><div class="chips">${o.usedIn.map(usedChip).join('') || '<span class="faint">not used</span>'}</div></td>`];
    }
    const key = etKey(o), els = layoutFields(o.tabs);
    const lives = o.kind === 'page'
      ? o.sections.map(s => chip(keyOf('section', s.uid))).join('')
      : o.builders.map(b => chip(fieldKey(b.field), perUseName(o, b.context) ? ` <em>${esc(perUseNote(o, b.context))}</em>` : '')).join('');
    return [key, `<td class="name">${glyph(o.kind)} ${esc(o.name)}${accessMarks(key)}</td><td><code class="faint">${esc(o.handle)}</code> ${prefixTag(o)}</td><td><span class="tag">${KIND[o.kind].label}</span></td><td><div class="chips">${lives || '<span class="faint">—</span>'}</div></td><td class="num">${els.length}</td><td><div class="chips">${els.map(fieldChip).join('')}</div></td>`];
  }

  function draw() {
    const cols = MODES[state.mode].columns;
    const sortCol = cols.find(c => c.id === state.sort && c.sort) || cols[0];
    const list = rows().sort((a, b) => {
      const x = sortCol.sort(a), y = sortCol.sort(b);
      return (typeof x === 'number' ? x - y : String(x).localeCompare(String(y))) * state.dir || byName(a, b);
    });
    countEl.textContent = state.mode === 'fields' ? count(list.length, 'field', 'fields') : count(list.length, 'entry type', 'entry types');
    const head = cols.map(c => `<th class="${c.sort ? 'sort' : ''}" data-sort="${c.sort ? c.id : ''}" ${c.num ? 'style="text-align:right"' : ''}>${c.label}<span class="arrow">${c.id === sortCol.id ? (state.dir > 0 ? ' ↑' : ' ↓') : ''}</span></th>`).join('');
    body.innerHTML = `<table class="t"><colgroup>${cols.map(c => `<col style="width:${c.w || 'auto'}">`).join('')}</colgroup><thead><tr>${head}</tr></thead><tbody>${list.map(o => { const [key, html] = cells(o); return `<tr data-row="${key}">${html}</tr>`; }).join('')}</tbody></table>`;
    mark();
    body.querySelectorAll('th[data-sort]').forEach(th => th.dataset.sort && th.addEventListener('click', () => {
      state.dir = state.sort === th.dataset.sort ? -state.dir : th.dataset.sort === 'uses' ? -1 : 1;
      state.sort = th.dataset.sort;
      draw();
    }));
    body.querySelectorAll('tr[data-row]').forEach(tr => tr.addEventListener('click', () => App.go('table', tr.dataset.row)));
    bindGo(body, (k, chipEl) => {
      const tr = chipEl.closest('tr');
      App.go('table', k, { row: tr.dataset.row, chip: [...tr.querySelectorAll('[data-go]')].indexOf(chipEl) });
    });
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
    const groups = `<select data-f="group" aria-label="${KIND.group.label}"><option value="">All site groups</option>${model.siteGroups.map(g => `<option value="${g.uid}" ${g.uid === state.group ? 'selected' : ''}>${esc(g.name)}</option>`).join('')}</select>`;
    f.innerHTML = state.mode === 'fields'
      ? `<select data-f="type" aria-label="Field type"><option value="">All types</option>${fieldTypes.map(type => `<option ${type === state.type ? 'selected' : ''}>${esc(type)}</option>`).join('')}</select>
         ${groups}
         <label class="check"><input type="checkbox" data-f="unused" ${state.unused ? 'checked' : ''}> only unused</label>`
      : `<select data-f="kind" aria-label="Kind"><option value="">All kinds</option>${Object.keys(KIND).filter(isEntryType).map(k => `<option value="${k}" ${state.kind === k ? 'selected' : ''}>${KIND[k].plural}</option>`).join('')}</select>
         ${groups}
         ${checksHandles ? `<label class="check"><input type="checkbox" data-f="unprefixed" ${state.unprefixed ? 'checked' : ''}> only without prefix</label>` : ''}`;
    f.querySelectorAll('[data-f]').forEach(x => x.addEventListener('change', () => { state[x.dataset.f] = x.type === 'checkbox' ? x.checked : x.value; draw(); }));
  }
  function setMode(mode) {
    state.mode = mode;
    state.sort = 'name';
    state.dir = 1;
    el.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('on', b.dataset.mode === mode));
    filters();
    draw();
  }
  const panel = () => showDetails(side, state.selected, 'table', k => App.go('table', k));
  const info = () => '<h2>Fields and where they sit</h2><p>Every field with each layout it’s placed in. A label in quotes is what that layout calls the field.</p><p>Switch to <b>Entry types</b> to read it from the other side: each page or block with its fields.</p><p>Click a row or a chip for details.</p>';

  function mount(root) {
    el = root;
    el.innerHTML = `
      <div class="tbl-wrap">
        <div class="tbl-head">
          <div class="toolbar">
            <div class="seg" role="tablist"><button data-mode="fields" class="on">Fields</button><button data-mode="entryTypes">Entry types</button></div>
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
    // Fields and whatever holds them in a field layout.
    kinds: Object.keys(KIND).filter(k => isField(k) || isEntryType(k) || isLayoutOwner(k)),
    info,
    mount,
    show(key, opts = {}) {
      const n = nodeOf(key);
      // a deep link to an entry type opens the entry type table, a field the field table
      if (n && opts.fromHash) {
        const mode = Object.keys(MODES).find(id => MODES[id].index === KIND[n.kind].index) || state.mode;
        if (mode !== state.mode) setMode(mode);
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
