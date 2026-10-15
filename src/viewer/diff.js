// Diff view: pick what to compare, then two of them, and see where they differ.
registerView((() => {
  // ---- what each type of thing is made of: properties compared as values, groups compared item by item. Each has a
  // key of its own, which A and B are matched by.
  const yes = v => (v ? 'Yes' : 'No');
  // Rights on others’ entries in words; the rest read as Craft stores them: view, create, save, …
  const RIGHTS = {
    viewPeer: 'view others’', savePeer: 'save others’', deletePeer: 'delete others’',
    viewPeerDrafts: 'view others’ drafts', savePeerDrafts: 'save others’ drafts', deletePeerDrafts: 'delete others’ drafts',
  };
  const rightTags = rights => rights.map(r => RIGHTS[r] || r);
  // How a Matrix field shows its entries.
  const VIEW_MODES = { cards: 'Cards', blocks: 'Blocks', index: 'Index' };
  function item(key, tags = [], id = key) {
    const n = nodeOf(key);
    return n ? { id, key, name: n.obj.name, tags: tags.filter(Boolean) } : null;
  }
  const fieldItems = tabs => layoutFields(tabs).map(({ el, f, tab }) => {
    const handle = el.handle && el.handle !== f.handle ? el.handle : null;
    return item(fieldKey(f), [tab.name, el.label && `“${el.label}”`, handle && `handle ${handle}`, el.required && 'required', el.conditional && 'conditional', el.width !== 100 && `${el.width}%`], handle ? `${fieldKey(f)}#${handle}` : fieldKey(f));
  });
  const accessGroups = key => ACCESS.filter(kind => ofKind(kind).length && accessApplies(kind, nodeOf(key).kind)).map(kind => ({
    key: kind,
    title: KIND[kind].plural,
    items: ofKind(kind).map(a => { const r = rightsOn(a, kind, key); return r && item(keyOf(kind, a.uid), rightTags(r)); }),
  }));
  // The sites and sections a user group or schema reaches, with what it may do there.
  const reachGroups = (a, kind) => [
    { key: 'sites', title: 'Sites', items: model.sites.filter(s => a.sites.includes(s.uid)).map(s => item(keyOf('site', s.uid), rightTags([KIND[kind].siteRight]))) },
    { key: 'sections', title: 'Sections', items: model.sections.filter(s => a.sections[s.uid]).map(s => item(keyOf('section', s.uid), rightTags(a.sections[s.uid]))) },
  ];

  // What can be compared: the kinds that share an index, so Pages with Blocks and Builders with Fields. Each type
  // describes its things as properties, [key, label, value], and groups of items.
  const kindsOf = type => Object.keys(KIND).filter(k => KIND[k].index === type.index);
  const listOf = type => kindsOf(type).flatMap(ofKind);
  const TYPES = [
    { id: 'site', label: KIND.site.plural, pick: 'pick a site', compare: 'Compare two sites', index: 'site', describe: (o, key) => ({
      props: [['handle', 'Handle', o.handle], ['group', KIND.group.label, (byUid.group[o.group] || {}).name], ['language', 'Language', o.language], ['baseUrl', 'Base URL', o.baseUrl], ['primary', 'Primary', yes(o.primary)]],
      groups: [
        { key: 'sections', title: 'Sections', items: o.sections.map(s => { const ss = s.sites.find(x => x.site === o.uid); return item(keyOf('section', s.uid), [s.type, ss && ss.hasUrls ? ss.uriFormat : 'no URLs', ss && statusText(ss)]); }) },
        ...accessGroups(key),
      ],
    }) },
    { id: 'section', label: KIND.section.plural, pick: 'pick a section', compare: 'Compare two sections', index: 'section', describe: (o, key) => ({
      props: [['handle', 'Handle', o.handle], ['type', 'Type', o.type], ['propagationMethod', 'Propagation', propagationText(o)]],
      groups: [
        { key: 'sites', title: 'Sites', items: o.sites.map(ss => item(keyOf('site', ss.site), [ss.hasUrls ? ss.uriFormat : 'no URLs', statusText(ss)])) },
        { key: 'entryTypes', title: 'Entry types', items: o.entryTypes.map(u => byUid.et[u] && item(etKey(byUid.et[u]), [renamedAs(o.as[u], byUid.et[u])])) },
        { key: 'pulledInBy', title: 'Pulled in by', items: o.referencedBy.map(f => item(fieldKey(f))) },
        { key: 'previewTargets', title: 'Preview targets', items: o.previewTargets.map(p => ({ id: p, name: p, tags: [] })) },
        ...accessGroups(key),
      ],
    }) },
    { id: 'entrytype', label: 'Entry types', pick: 'pick an entry type', compare: 'Compare two entry types', index: 'et', describe: (o, key) => ({
      props: [['handle', 'Handle', o.handle], ['kind', 'Kind', KIND[o.kind].label], ['hasTitleField', 'Title field', yes(o.hasTitleField)], ['tabs', 'Tabs', o.tabs.map(tab => tab.name).join(', ')], ['gql', 'GraphQL type', o.gql]],
      groups: [
        { key: 'livesIn', title: 'Lives in', items: [
          ...o.sections.map(s => item(keyOf('section', s.uid), [renamedAs(s.as[o.uid], o)])),
          ...o.builders.map(b => item(fieldKey(b.field), [renamedAs(b.as, o), b.group])),
        ] },
        { key: 'fields', title: 'Fields', items: fieldItems(o.tabs) },
        ...accessGroups(key),
      ],
    }) },
    { id: 'field', label: 'Fields', pick: 'pick a field', compare: 'Compare two fields', index: 'field', describe: (o, key) => {
      const props = [['handle', 'Handle', o.handle], ['type', 'Type', fieldTypeLabel(o)], ['instructions', 'Instructions', o.instructions]];
      if (o.blocks) props.push(['viewMode', 'View mode', VIEW_MODES[o.viewMode] || o.viewMode], ['minEntries', 'Min entries', o.min], ['maxEntries', 'Max entries', o.max]);
      if (o.sources) props.push(['sources', 'Sources', o.allSources ? 'All sections' : null], ['maxRelations', 'Max relations', o.max]);
      const groups = [];
      if (o.options) groups.push({ key: 'options', title: 'Options', items: o.options.map(op => ({ id: op.value, name: op.label, tags: [op.value, op.default && 'default'].filter(Boolean) })) });
      if (o.blocks) groups.push({ key: 'blocks', title: 'Blocks', items: o.blocks.map(b => byUid.et[b.entryType] && item(etKey(byUid.et[b.entryType]), [renamedAs(b.as, byUid.et[b.entryType]), b.group])) });
      if (o.targets.length) groups.push({ key: 'pullsFrom', title: 'Pulls from', items: o.targets.map(s => item(keyOf('section', s.uid))) });
      if (o.tabs) groups.push({ key: 'contains', title: 'Contains', items: fieldItems(o.tabs) });
      groups.push({ key: 'usedIn', title: 'Used in', items: o.usedIn.map(u => item(useKey(u), [u.el.label && `“${u.el.label}”`, u.el.required && 'required', u.el.conditional && 'conditional'])) });
      return { props, groups: [...groups, ...accessGroups(key)] };
    } },
    { id: 'usergroup', label: KIND.usergroup.plural, pick: 'pick a user group', compare: 'Compare two user groups', index: 'usergroup', describe: o => ({
      props: [['handle', 'Handle', o.handle], ['description', 'Description', o.description]],
      groups: reachGroups(o, 'usergroup'),
    }) },
    { id: 'schema', label: KIND.schema.plural, pick: 'pick a GraphQL schema', compare: 'Compare two GraphQL schemas', index: 'schema', describe: o => ({
      props: [['public', 'Public', yes(o.public)], ['elements', 'Also queries', o.elements.map(e => ELEMENT_SCOPES[e] || e).join(', ')]],
      groups: [...reachGroups(o, 'schema'), { key: 'builders', title: 'Builders', items: model.fields.filter(f => o.fields[f.uid]).map(f => item(fieldKey(f), rightTags(o.fields[f.uid]))) }],
    }) },
  ].filter(type => listOf(type).length);
  const typeOf = key => { const n = nodeOf(key); return n ? TYPES.find(type => type.index === KIND[n.kind].index) : null; };

  // ---- comparison: rows are 'same', 'changed', or only on one side ('a', 'b'), in the order A and B have them
  const sameTags = (x, y) => x.length === y.length && x.every(tag => y.includes(tag));
  const keysOf = (xs, ys) => [...new Map([...xs, ...ys].map(x => [x.key, x])).values()];
  function compare(keyA, keyB) {
    const da = typeOf(keyA).describe(nodeOf(keyA).obj, keyA), db = typeOf(keyB).describe(nodeOf(keyB).obj, keyB);
    const asProp = ([key, label, value]) => ({ key, label, value: value != null && value !== '' ? String(value) : null });
    const pa = da.props.map(asProp), pb = db.props.map(asProp);
    const valueOf = (list, key) => { const p = list.find(x => x.key === key); return p ? p.value : null; };
    const props = keysOf(pa, pb).map(({ key, label }) => {
      const x = valueOf(pa, key), y = valueOf(pb, key);
      return { key, label, x, y, status: x === y ? 'same' : 'changed' };
    });
    const groups = keysOf(da.groups, db.groups).map(({ key, title }) => {
      const list = d => ((d.groups.find(g => g.key === key) || {}).items || []).filter(Boolean);
      const ia = new Map(list(da).map(i => [i.id, i])), ib = new Map(list(db).map(i => [i.id, i]));
      const rows = [...new Set([...ia.keys(), ...ib.keys()])].map(id => {
        const x = ia.get(id), y = ib.get(id);
        return { x, y, ref: x || y, status: !y ? 'a' : !x ? 'b' : sameTags(x.tags, y.tags) ? 'same' : 'changed' };
      });
      return { key, title, rows };
    });
    return { props, groups };
  }

  // ---- view
  let el, bar, body, countEl;
  const state = { type: TYPES.find(type => type.id === 'entrytype') || TYPES[0], a: null, b: null, onlyDiff: false };
  const STATUS = { a: 'only in A', b: 'only in B', changed: 'differs' };
  // Properties shown as code.
  const CODE = ['handle', 'gql', 'baseUrl', 'language'];

  const diffKey = () => (state.a && state.b ? `${state.a}/${state.b}` : state.a || state.type.id);
  function pick(changes) {
    Object.assign(state, changes);
    App.go('diff', diffKey());
  }

  function options(side) {
    const other = side === 'a' ? state.b : state.a;
    const opt = o => { const k = keyOf(o.kind, o.uid); return `<option value="${k}" ${k === state[side] ? 'selected' : ''} ${k === other ? 'disabled' : ''}>${esc(o.name)}</option>`; };
    const list = listOf(state.type).sort(byName);
    // a type that holds several kinds lists them apart, Pages and Blocks, Builders and Fields
    const kinds = kindsOf(state.type);
    const grouped = kinds.length > 1 ? kinds.map(k => [KIND[k].plural, list.filter(o => o.kind === k)]) : null;
    return `<option value="">${side.toUpperCase()}: ${esc(state.type.pick)}</option>${grouped
      ? grouped.filter(([, l]) => l.length).map(([label, l]) => `<optgroup label="${label}">${l.map(opt).join('')}</optgroup>`).join('')
      : list.map(opt).join('')}`;
  }

  function drawBar() {
    bar.innerHTML = `
      <div class="seg" role="tablist">${TYPES.map(type => `<button data-type="${type.id}" class="${type === state.type ? 'on' : ''}">${type.label}</button>`).join('')}</div>
      <div class="toolbar">
        <select data-side="a" aria-label="First to compare">${options('a')}</select>
        <button class="btn" data-swap title="Swap A and B" aria-label="Swap A and B" ${state.a && state.b ? '' : 'disabled'}>⇄</button>
        <select data-side="b" aria-label="Second to compare">${options('b')}</select>
        <label class="check"><input type="checkbox" data-only ${state.onlyDiff ? 'checked' : ''}> only differences</label>
        <span class="tbl-count"></span>
      </div>`;
    countEl = bar.querySelector('.tbl-count');
    bar.querySelectorAll('[data-type]').forEach(b => b.addEventListener('click', () => {
      const type = TYPES.find(x => x.id === b.dataset.type);
      if (type !== state.type) pick({ type, a: null, b: null });
    }));
    bar.querySelectorAll('select[data-side]').forEach(s => s.addEventListener('change', () => pick({ [s.dataset.side]: s.value || null })));
    bar.querySelector('[data-swap]').addEventListener('click', () => pick({ a: state.b, b: state.a }));
    bar.querySelector('[data-only]').addEventListener('change', ev => { state.onlyDiff = ev.target.checked; drawBody(); });
  }

  const tagsHTML = (i, other) => (i.tags.length
    ? i.tags.map(tag => `<span class="tag ${other && !other.tags.includes(tag) ? 'solid' : ''}">${esc(tag)}</span>`).join(' ')
    : '<span class="muted">✓</span>');
  const missing = '<span class="faint">—</span>';
  const statusCell = s => `<td class="st">${STATUS[s] ? `<span class="tag outline">${STATUS[s]}</span>` : ''}</td>`;

  function drawBody() {
    if (!state.a || !state.b) {
      countEl.textContent = '';
      body.innerHTML = `<div class="diff-empty"><h2>${esc(state.type.compare)}</h2><p class="muted">Pick one on each side to see what they share and where they differ. Anything with a <b>Compare</b> button in its details can start a comparison too.</p></div>`;
      return;
    }
    const { props, groups } = compare(state.a, state.b);
    const differs =[...props, ...groups.flatMap(g => g.rows)].filter(r => r.status !== 'same').length;
    countEl.textContent = differs ? count(differs, 'difference', 'differences') : 'No differences';
    const show = r => !state.onlyDiff || r.status !== 'same';

    let h = `<table class="t diff"><colgroup><col style="width:24%"><col><col><col style="width:104px"></colgroup>
      <thead><tr><th></th><th><span class="ab">A</span>${chip(state.a)}</th><th><span class="ab">B</span>${chip(state.b)}</th><th></th></tr></thead><tbody>`;
    const shownProps = props.filter(show);
    if (shownProps.length) {
      h += '<tr class="grp"><td colspan="4">Properties</td></tr>';
      const val = (p, v) => (v == null ? missing : CODE.includes(p.key) ? `<code>${esc(v)}</code>` : esc(v));
      h += shownProps.map(p => `<tr class="${p.status}"><td class="lbl">${esc(p.label)}</td><td>${val(p, p.x)}</td><td>${val(p, p.y)}</td>${statusCell(p.status)}</tr>`).join('');
    }
    groups.forEach(g => {
      const rows = g.rows.filter(show);
      if (!rows.length) return;
      const changed = g.rows.filter(r => r.status !== 'same').length;
      h += `<tr class="grp"><td colspan="4">${esc(g.title)} <span class="faint">${g.rows.length}${changed ? ` · ${count(changed, 'differs', 'differ')}` : ''}</span></td></tr>`;
      h += rows.map(r => `<tr class="${r.status}"><td class="lbl">${r.ref.key ? chip(r.ref.key) : esc(r.ref.name)}</td><td>${r.x ? tagsHTML(r.x, r.y) : missing}</td><td>${r.y ? tagsHTML(r.y, r.x) : missing}</td>${statusCell(r.status)}</tr>`).join('');
    });
    h += '</tbody></table>';
    if (state.onlyDiff && !differs) h = '<div class="diff-empty"><p class="muted">These two are the same in everything Orrery reads.</p></div>';
    body.innerHTML = h;
    bindGo(body, k => App.go('graph', k));
  }

  const info = () => '<h2>Reading a comparison</h2><p>Each row is something A or B has. <b>Only in A</b> and <b>only in B</b> mark what the other one is missing; <b>differs</b> means both have it, set up differently, and the tags in black are the ones the other side lacks.</p><p>Turn on <b>only differences</b> to hide everything they share. Names lead to the graph, and back brings you here again.</p>';

  function mount(root) {
    el = root;
    el.innerHTML = `<div class="tbl-wrap"><div class="tbl-head" data-bar></div><div class="tbl-body"><div class="scroll" data-body></div>${infoCard(info())}</div></div>`;
    bar = el.querySelector('[data-bar]');
    body = el.querySelector('[data-body]');
  }

  return {
    id: 'diff',
    label: 'Diff',
    crossLink: 'Compare',
    // Whatever one of its types holds.
    kinds: Object.keys(KIND).filter(k => TYPES.some(type => type.index === KIND[k].index)),
    info,
    mount,
    // keys: "<type>", "<kind>:<uid>" for A, or "<kind>:<uid>/<kind>:<uid>" for A and B
    show(key) {
      if (key) {
        const [ka, kb] = key.split('/');
        const type = typeOf(ka) || TYPES.find(x => x.id === ka);
        if (type) Object.assign(state, { type, a: nodeOf(ka) ? ka : null, b: kb && typeOf(kb) === type && kb !== ka ? kb : null });
      }
      drawBar();
      drawBody();
    },
    refresh() { drawBody(); },
    // What A and B have, row by row, as the view draws it.
    compare,
  };
})());
