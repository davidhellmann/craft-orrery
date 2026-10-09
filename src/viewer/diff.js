// Diff view: pick what to compare, then two of them, and see where they differ.
const DiffView = (() => {
  const TYPES = [
    { id: 'site', label: 'Sites', one: 'site', kinds: ['site'], list: () => M.sites },
    { id: 'section', label: 'Sections', one: 'section', kinds: ['section'], list: () => M.sections },
    { id: 'entrytype', label: 'Entry types', one: 'entry type', kinds: ['page', 'block'], list: () => M.entryTypes },
    { id: 'field', label: 'Fields', one: 'field', kinds: ['field', 'matrix'], list: () => M.fields },
    { id: 'usergroup', label: 'User groups', one: 'user group', kinds: ['usergroup'], list: () => M.userGroups },
    { id: 'schema', label: 'GraphQL schemas', one: 'GraphQL schema', kinds: ['schema'], list: () => M.gqlSchemas },
  ].filter(t => t.list().length);
  const keyFor = (type, o) => (type.id === 'entrytype' ? etKey(o) : type.id === 'field' ? fieldKey(o) : keyOf(type.id, o.uid));
  const typeOf = key => { const n = nodeOf(key); return n ? TYPES.find(t => t.kinds.includes(n.kind)) : null; };

  // ---- what each kind of thing is made of: properties compared as values, groups compared item by item
  const yes = v => (v ? 'Yes' : 'No');
  const RIGHTS = {
    view: 'view', create: 'create', save: 'save', delete: 'delete', edit: 'edit', read: 'read',
    viewPeer: 'view others’', savePeer: 'save others’', deletePeer: 'delete others’',
    viewPeerDrafts: 'view others’ drafts', savePeerDrafts: 'save others’ drafts', deletePeerDrafts: 'delete others’ drafts',
  };
  const rightTags = rights => rights.map(r => RIGHTS[r] || r);
  const quoted = (s, name) => (s && s !== name ? `as “${s}”` : null);
  function item(key, tags = [], id = key) {
    const n = nodeOf(key);
    return n ? { id, key, name: n.obj.name, tags: tags.filter(Boolean) } : null;
  }
  const fieldItems = tabs => tabs.flatMap(t => t.elements.filter(el => el.kind === 'CustomField' && by.field[el.field]).map(el => {
    const f = by.field[el.field];
    const handle = el.handle && el.handle !== f.handle ? el.handle : null;
    return item(fieldKey(f), [t.name, el.label && `“${el.label}”`, handle && `handle ${handle}`, el.required && 'required', el.conditional && 'conditional', el.width !== 100 && `${el.width}%`], handle ? `${fieldKey(f)}#${handle}` : fieldKey(f));
  }));
  const accessGroups = key => ACCESS.filter(kind => accessList(kind).length && accessApplies(kind, nodeOf(key).kind)).map(kind => ({
    title: KIND[kind].plural,
    items: accessList(kind).map(a => { const r = rightsOn(a, kind, key); return r && item(keyOf(kind, a.uid), rightTags(r)); }),
  }));

  function describe(n) {
    const o = n.obj;
    if (n.kind === 'site') {
      return {
        props: [['Handle', o.handle], ['Site group', (by.group[o.group] || {}).name], ['Language', o.language], ['Base URL', o.baseUrl], ['Primary', yes(o.primary)]],
        groups: [
          { title: 'Sections', items: o.sections.map(s => { const ss = s.sites.find(x => x.site === o.uid); return item(keyOf('section', s.uid), [s.type, ss && ss.hasUrls ? ss.uriFormat : 'no URLs']); }) },
          ...accessGroups(n.key),
        ],
      };
    }
    if (n.kind === 'section') {
      return {
        props: [['Handle', o.handle], ['Type', o.type]],
        groups: [
          { title: 'Sites', items: o.sites.map(ss => item(keyOf('site', ss.site), [ss.hasUrls ? ss.uriFormat : 'no URLs'])) },
          { title: 'Entry types', items: o.entryTypes.map(u => by.et[u] && item(etKey(by.et[u]), [quoted(o.contexts[u], by.et[u].name)])) },
          { title: 'Pulled in by', items: o.referencedBy.map(f => item(fieldKey(f))) },
          { title: 'Preview targets', items: o.previewTargets.map(p => ({ id: p, name: p, tags: [] })) },
          ...accessGroups(n.key),
        ],
      };
    }
    if (n.kind === 'page' || n.kind === 'block') {
      return {
        props: [['Handle', o.handle], ['Kind', KIND[o.kind].label], ['Title field', yes(o.hasTitleField)], ['Tabs', o.tabs.map(t => t.name).join(', ')], ['GraphQL type', o.gql]],
        groups: [
          { title: 'Lives in', items: [
            ...o.sections.map(s => item(keyOf('section', s.uid), [quoted(s.contexts[o.uid], o.name)])),
            ...o.builders.map(b => item(fieldKey(b.field), [quoted(b.context, o.name), b.group])),
          ] },
          { title: 'Fields', items: fieldItems(o.tabs) },
          ...accessGroups(n.key),
        ],
      };
    }
    if (n.kind === 'field' || n.kind === 'matrix') {
      const props = [['Handle', o.handle], ['Type', fieldTypeLabel(o)], ['Instructions', o.instructions]];
      if (o.blocks) props.push(['View mode', o.viewMode], ['Min entries', o.min], ['Max entries', o.max]);
      if (o.sources) props.push(['Sources', o.allSources ? 'All sections' : null], ['Max relations', o.max]);
      const groups = [];
      if (o.options) groups.push({ title: 'Options', items: o.options.map(op => ({ id: op.value, name: op.label, tags: [op.value, op.default && 'default'] })) });
      if (o.blocks) groups.push({ title: 'Blocks', items: o.blocks.map(b => by.et[b.entryType] && item(etKey(by.et[b.entryType]), [quoted(b.context, by.et[b.entryType].name), b.group])) });
      if (o.targets.length) groups.push({ title: 'Pulls from', items: o.targets.map(s => item(keyOf('section', s.uid))) });
      if (o.type === 'ContentBlock') groups.push({ title: 'Contains', items: fieldItems(o.tabs) });
      groups.push({ title: 'Used in', items: o.usedIn.map(u => item(useKey(u), [u.el.label && `“${u.el.label}”`, u.el.required && 'required', u.el.conditional && 'conditional'])) });
      return { props, groups: [...groups, ...accessGroups(n.key)] };
    }
    const sites = { title: 'Sites', items: M.sites.filter(s => o.sites.includes(s.uid)).map(s => item(keyOf('site', s.uid), [n.kind === 'schema' ? 'read' : 'edit'])) };
    const sections = { title: 'Sections', items: M.sections.filter(s => o.sections[s.uid]).map(s => item(keyOf('section', s.uid), rightTags(o.sections[s.uid]))) };
    if (n.kind === 'usergroup') return { props: [['Handle', o.handle], ['Description', o.description]], groups: [sites, sections] };
    return {
      props: [['Public', yes(o.public)], ['Also queries', o.elements.map(e => ELEMENT_SCOPES[e] || e).join(', ')]],
      groups: [sites, sections, { title: 'Builders', items: M.fields.filter(f => o.fields[f.uid]).map(f => item(fieldKey(f), rightTags(o.fields[f.uid]))) }],
    };
  }

  // ---- comparison: rows are 'same', 'changed', or only on one side ('a', 'b')
  const sameTags = (x, y) => x.length === y.length && x.every(t => y.includes(t));
  function compare(a, b) {
    const da = describe(a), db = describe(b);
    const value = (d, label) => { const p = d.props.find(x => x[0] === label); return p && p[1] != null && p[1] !== '' ? String(p[1]) : null; };
    const labels = [...new Set([...da.props, ...db.props].map(p => p[0]))];
    const props = labels.map(label => {
      const x = value(da, label), y = value(db, label);
      return { label, x, y, status: x === y ? 'same' : 'changed' };
    });
    const titles = [...new Set([...da.groups, ...db.groups].map(g => g.title))];
    const groups = titles.map(title => {
      const list = d => ((d.groups.find(g => g.title === title) || {}).items || []).filter(Boolean);
      const ia = new Map(list(da).map(i => [i.id, i])), ib = new Map(list(db).map(i => [i.id, i]));
      const rows = [...new Set([...ia.keys(), ...ib.keys()])].map(id => {
        const x = ia.get(id), y = ib.get(id);
        return { x, y, ref: x || y, status: !y ? 'a' : !x ? 'b' : sameTags(x.tags, y.tags) ? 'same' : 'changed' };
      });
      return { title, rows };
    });
    return { props, groups };
  }

  // ---- view
  let el, bar, body, countEl;
  const state = { type: TYPES.find(t => t.id === 'entrytype') || TYPES[0], a: null, b: null, onlyDiff: false };
  const STATUS = { a: 'only in A', b: 'only in B', changed: 'differs' };
  const CODE = ['Handle', 'GraphQL type', 'Base URL', 'Language'];

  const diffKey = () => (state.a && state.b ? `${state.a}/${state.b}` : state.a || state.type.id);
  function pick(changes) {
    Object.assign(state, changes);
    App.go('diff', diffKey());
  }

  function options(side) {
    const other = side === 'a' ? state.b : state.a;
    const opt = o => { const k = keyFor(state.type, o); return `<option value="${k}" ${k === state[side] ? 'selected' : ''} ${k === other ? 'disabled' : ''}>${esc(o.name)}</option>`; };
    const list = state.type.list().slice().sort(byName);
    const grouped = state.type.id === 'entrytype' ? [['Pages', list.filter(e => e.kind === 'page')], ['Blocks', list.filter(e => e.kind === 'block')]]
      : state.type.id === 'field' ? [['Builders', list.filter(f => f.isBuilder)], ['Fields', list.filter(f => !f.isBuilder)]] : null;
    return `<option value="">${side.toUpperCase()}: pick a ${esc(state.type.one)}</option>${grouped
      ? grouped.filter(([, l]) => l.length).map(([label, l]) => `<optgroup label="${label}">${l.map(opt).join('')}</optgroup>`).join('')
      : list.map(opt).join('')}`;
  }

  function drawBar() {
    bar.innerHTML = `
      <div class="seg" role="tablist">${TYPES.map(t => `<button data-type="${t.id}" class="${t === state.type ? 'on' : ''}">${t.label}</button>`).join('')}</div>
      <div class="toolbar">
        <select data-side="a" aria-label="First to compare">${options('a')}</select>
        <button class="btn" data-swap title="Swap A and B" aria-label="Swap A and B" ${state.a && state.b ? '' : 'disabled'}>⇄</button>
        <select data-side="b" aria-label="Second to compare">${options('b')}</select>
        <label class="check"><input type="checkbox" data-only ${state.onlyDiff ? 'checked' : ''}> only differences</label>
        <span class="tbl-count"></span>
      </div>`;
    countEl = bar.querySelector('.tbl-count');
    bar.querySelectorAll('[data-type]').forEach(b => b.addEventListener('click', () => {
      const type = TYPES.find(t => t.id === b.dataset.type);
      if (type !== state.type) pick({ type, a: null, b: null });
    }));
    bar.querySelectorAll('select[data-side]').forEach(s => s.addEventListener('change', () => pick({ [s.dataset.side]: s.value || null })));
    bar.querySelector('[data-swap]').addEventListener('click', () => pick({ a: state.b, b: state.a }));
    bar.querySelector('[data-only]').addEventListener('change', ev => { state.onlyDiff = ev.target.checked; drawBody(); });
  }

  const tagsHTML = (i, other) => (i.tags.length
    ? i.tags.map(t => `<span class="tag ${other && !other.tags.includes(t) ? 'solid' : ''}">${esc(t)}</span>`).join(' ')
    : '<span class="muted">✓</span>');
  const missing = '<span class="faint">—</span>';
  const statusCell = s => `<td class="st">${STATUS[s] ? `<span class="tag outline">${STATUS[s]}</span>` : ''}</td>`;

  function drawBody() {
    if (!state.a || !state.b) {
      countEl.textContent = '';
      body.innerHTML = `<div class="diff-empty"><h2>Compare two ${esc(state.type.label.toLowerCase())}</h2><p class="muted">Pick one on each side to see what they share and where they differ. Anything with a <b>Compare</b> button in its details can start a comparison too.</p></div>`;
      return;
    }
    const a = nodeOf(state.a), b = nodeOf(state.b);
    const { props, groups } = compare(a, b);
    const differs = [...props, ...groups.flatMap(g => g.rows)].filter(r => r.status !== 'same').length;
    countEl.textContent = differs ? `${differs} difference${differs === 1 ? '' : 's'}` : 'No differences';
    const show = r => !state.onlyDiff || r.status !== 'same';

    let h = `<table class="t diff"><colgroup><col style="width:24%"><col><col><col style="width:104px"></colgroup>
      <thead><tr><th></th><th><span class="ab">A</span>${chip(state.a)}</th><th><span class="ab">B</span>${chip(state.b)}</th><th></th></tr></thead><tbody>`;
    const shownProps = props.filter(show);
    if (shownProps.length) {
      h += `<tr class="grp"><td colspan="4">Properties</td></tr>`;
      const val = (p, v) => (v == null ? missing : CODE.includes(p.label) ? `<code>${esc(v)}</code>` : esc(v));
      h += shownProps.map(p => `<tr class="${p.status}"><td class="lbl">${esc(p.label)}</td><td>${val(p, p.x)}</td><td>${val(p, p.y)}</td>${statusCell(p.status)}</tr>`).join('');
    }
    groups.forEach(g => {
      const rows = g.rows.filter(show);
      if (!rows.length) return;
      const changed = g.rows.filter(r => r.status !== 'same').length;
      h += `<tr class="grp"><td colspan="4">${esc(g.title)} <span class="faint">${g.rows.length}${changed ? ` · ${changed} differ${changed === 1 ? 's' : ''}` : ''}</span></td></tr>`;
      h += rows.map(r => `<tr class="${r.status}"><td class="lbl">${r.ref.key ? chip(r.ref.key) : esc(r.ref.name)}</td><td>${r.x ? tagsHTML(r.x, r.y) : missing}</td><td>${r.y ? tagsHTML(r.y, r.x) : missing}</td>${statusCell(r.status)}</tr>`).join('');
    });
    h += '</tbody></table>';
    if (state.onlyDiff && !differs) h = '<div class="diff-empty"><p class="muted">These two are the same in everything Orrery reads.</p></div>';
    body.innerHTML = h;
    bindGo(body, k => App.go('graph', k));
  }

  function mount(root) {
    el = root;
    el.innerHTML = `<div class="tbl-wrap"><div class="tbl-head" data-bar></div><div class="scroll" data-body></div></div>`;
    bar = el.querySelector('[data-bar]');
    body = el.querySelector('[data-body]');
  }

  return {
    id: 'diff',
    label: 'Diff',
    mount,
    // keys: "<type>", "<kind>:<uid>" for A, or "<kind>:<uid>/<kind>:<uid>" for A and B
    show(key) {
      if (key) {
        const [ka, kb] = key.split('/');
        const type = typeOf(ka) || TYPES.find(t => t.id === ka);
        if (type) Object.assign(state, { type, a: nodeOf(ka) ? ka : null, b: kb && typeOf(kb) === type && kb !== ka ? kb : null });
      }
      drawBar();
      drawBody();
    },
    escape() {},
    refresh() { drawBody(); },
  };
})();
