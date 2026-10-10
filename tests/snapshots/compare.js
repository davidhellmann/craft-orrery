// Answers "does the viewer still show the same as on <ref>?". Builds the viewer page of the working tree and of the ref,
// each from its own files (page.php), opens the same deep links in both in headless Chromium, and compares what they
// show: the DOM without scripts and styles, form state, the hash, scroll positions and focus. Exits non-zero on any
// difference, and on any console error, even where both sides agree.
// Usage: npm run snapshots -- [ref]   (HEAD by default)
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright-core');
const { loadViewer } = require('../viewer/load.js');

const ROOT = path.join(__dirname, '../..');
const ORIGIN = 'http://orrery.test';
const WORKERS = 6;
const LISTED = 30;
const SHOWN = 3;

async function main(ref = 'HEAD') {
  if (ref === '--help' || ref === '-h') return console.log('Usage: npm run snapshots -- [ref]   (compares the working tree with ref, HEAD by default)'), 0;
  const commit = git('rev-parse', '--short', '--verify', `${ref}^{commit}`).trim();
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'orrery-snapshots-'));
  const sides = [side(`ref ${ref}`, extract(commit, path.join(out, 'ref-files')), path.join(out, 'ref')), side('working tree', ROOT, path.join(out, 'working-tree'))];
  const links = [...new Set(sides.flatMap(s => s.links))];
  if (!links.length) throw new Error('Neither side lists its views in Node, so there are no links to compare.');
  sides.forEach((s, i) => { s.access = s.access || sides[1 - i].access; });
  const passes = [
    { name: 'plain', storage: () => ({}) },
    { name: 'access', label: 'with every user group and schema on and the info card open', storage: s => ({ 'orrery-access': JSON.stringify(s.access), 'orrery-info': 'shown' }) },
  ];
  console.log(`Viewer of the working tree vs ${ref} (${commit}): ${links.length} links, ${passes.length} passes`);

  const browser = await launch();
  try {
    for (const s of sides) {
      for (const pass of passes) s.shots[pass.name] = await shoot(browser, s, links, pass.storage(s));
    }
  } finally {
    await browser.close();
  }

  const differ = [], errors = [];
  if (sides[0].styles !== sides[1].styles) differ.push({ what: 'viewer.css', a: sides[0].styles, b: sides[1].styles });
  for (const pass of passes) {
    for (const link of links) {
      const [a, b] = sides.map(s => s.shots[pass.name][link]);
      const what = `${pass.name.padEnd(6)} ${link || '(start)'}`;
      if (a.text !== b.text) differ.push({ what, a: a.text, b: b.text });
      sides.forEach((s, i) => [a, b][i].errors.forEach(e => errors.push(`${what}  (${s.label}) ${e}`)));
      sides.forEach(s => fs.writeFileSync(path.join(s.dir, `${pass.name}-${link.replace(/[^\w.-]+/g, '_') || 'start'}.txt`), s.shots[pass.name][link].text));
    }
  }

  if (!differ.length && !errors.length) {
    fs.rmSync(out, { recursive: true, force: true });
    console.log(`✓ Same on all ${links.length * passes.length} snapshots, and no console errors.`);
    return 0;
  }
  if (differ.length) {
    fs.writeFileSync(path.join(out, 'differ.txt'), differ.map(d => `${d.what}\n`).join(''));
    console.log(`\n✗ ${differ.length} differ ("access" = ${passes[1].label}):`);
    differ.slice(0, LISTED).forEach(d => console.log(`  ${d.what}`));
    if (differ.length > LISTED) console.log(`  … ${differ.length - LISTED} more, listed in ${path.join(out, 'differ.txt')}`);
    differ.slice(0, SHOWN).forEach(d => console.log(`\n${d.what}\n${excerpt(d.a, d.b, ref)}`));
  }
  if (errors.length) {
    console.log(`\n✗ ${errors.length} console errors:`);
    errors.forEach(e => console.log(`  ${e}`));
  }
  console.log(`\nAll snapshots: ${out}`);
  return 1;
}

function git(...args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

// The plugin files and the fixture as they are at the commit. (`git archive` would leave out tests/, which
// .gitattributes keeps out of the Composer package.)
function extract(commit, dir) {
  const files = git('ls-tree', '-r', '--name-only', commit, '--', 'src', 'tests/fixtures').split('\n').filter(Boolean);
  if (!files.includes('tests/fixtures/content-model.json')) {
    throw new Error(`Can't build the viewer at ${commit}: it has no fixture data (tests/fixtures/content-model.json).`);
  }
  for (const file of files) {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), execFileSync('git', ['show', `${commit}:${file}`], { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 }));
  }
  return dir;
}

// One side of the comparison: its page, the links its views have, and the access layers to switch on.
function side(label, root, dir) {
  fs.mkdirSync(dir);
  const html = path.join(dir, 'page.html');
  execFileSync('php', [path.join(__dirname, 'page.php'), root, html], { stdio: ['ignore', 'inherit', 'inherit'] });
  const s = { label, dir, html: fs.readFileSync(html), styles: fs.readFileSync(path.join(root, 'src/viewer/viewer.css'), 'utf8'), links: [], access: null, shots: {} };
  // Viewers older than registerView() can't list their links; the other side's links and access layers then do for both.
  let scope;
  try {
    scope = loadViewer({ root });
    scope.VIEWS.forEach(() => {});
  } catch (e) {
    console.log(`Note: the links come from the other side only, as the ${label}'s views can't be listed in Node (${e.message}).`);
    return s;
  }
  const { VIEWS, ACCESS, ofKind } = scope;
  s.links.push('');
  for (const v of VIEWS) {
    s.links.push(`#${v.id}`);
    for (const kind of v.kinds) {
      const items = ofKind(kind);
      items.forEach(o => s.links.push(`#${v.id}/${kind}:${o.uid}`));
      // The Diff also takes two items, A and B.
      if (v.id === 'diff' && items.length > 1) s.links.push(`#diff/${kind}:${items[0].uid}/${kind}:${items[1].uid}`);
    }
  }
  s.access = Object.fromEntries(ACCESS.map(kind => [kind, ofKind(kind).map(o => o.uid)]));
  return s;
}

// Opens every link in a fresh page load, with `storage` in localStorage as the viewer remembers it per browser.
async function shoot(browser, s, links, storage) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light', reducedMotion: 'reduce', locale: 'en-US', timezoneId: 'UTC' });
  await context.route(`${ORIGIN}/**`, route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: s.html }));
  await context.addInitScript(items => {
    localStorage.clear();
    Object.entries(items).forEach(([key, value]) => localStorage.setItem(key, value));
  }, storage);
  const shots = {}, queue = links.map((link, i) => [link, i]);
  await Promise.all(Array.from({ length: WORKERS }, async () => {
    const page = await context.newPage();
    let errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => m.type() === 'error' && errors.push(m.text()));
    for (let next; (next = queue.shift());) {
      const [link, i] = next;
      errors = [];
      // A query of its own makes each link a fresh page load, not a hash change.
      await page.goto(`${ORIGIN}/?${i}${link}`);
      await settle(page);
      shots[link] = { text: await snapshot(page), errors };
    }
  }));
  await context.close();
  return shots;
}

// Waits until the page has stopped changing for a moment.
function settle(page) {
  return page.evaluate(() => document.fonts.ready.then(() => new Promise(resolve => {
    let quiet;
    const done = () => { observer.disconnect(); clearTimeout(quiet); clearTimeout(limit); resolve(); };
    const observer = new MutationObserver(() => { clearTimeout(quiet); quiet = setTimeout(done, 300); });
    observer.observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
    quiet = setTimeout(done, 300);
    const limit = setTimeout(done, 5000);
  })));
}

function snapshot(page) {
  return page.evaluate(() => {
    const where = el => {
      const parts = [];
      for (; el && el !== document.documentElement; el = el.parentElement) {
        parts.unshift(el.tagName.toLowerCase() + (el.id ? `#${el.id}` : '') + [...el.classList].map(c => `.${c}`).join(''));
      }
      return parts.join(' > ') || 'html';
    };
    const all = [...document.querySelectorAll('*')];
    const lines = [
      `hash: ${location.hash}`,
      `focus: ${where(document.activeElement)}`,
      `scroll: window ${scrollY},${scrollX}`,
      ...all.filter(el => el.scrollTop || el.scrollLeft).map(el => `scroll: ${where(el)} ${el.scrollTop},${el.scrollLeft}`),
      ...all.filter(el => /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)).map(el => `form: ${where(el)} ${JSON.stringify(el.value)}${el.checked ? ' checked' : ''}${el.indeterminate ? ' indeterminate' : ''}`),
    ];
    const clone = document.documentElement.cloneNode(true);
    clone.querySelectorAll('script, style').forEach(el => el.remove());
    return `${lines.join('\n')}\n\n${clone.outerHTML.replace(/></g, '>\n<')}\n`;
  });
}

// Where two snapshots part: a little context, then each side's lines up to where they agree again.
function excerpt(a, b, ref) {
  const x = a.split('\n'), y = b.split('\n');
  let start = 0, end = 0;
  while (start < x.length && start < y.length && x[start] === y[start]) start++;
  while (end < x.length - start && end < y.length - start && x[x.length - 1 - end] === y[y.length - 1 - end]) end++;
  const cut = line => (line.length > 200 ? `${line.slice(0, 200)}…` : line);
  const changed = (lines, sign) => {
    const own = lines.slice(start, lines.length - end);
    return [...own.slice(0, 12).map(l => `${sign} ${cut(l)}`), ...(own.length > 12 ? [`${sign} … ${own.length - 12} more lines`] : [])];
  };
  return [`--- ${ref}`, '+++ working tree', ...x.slice(Math.max(0, start - 2), start).map(l => `  ${cut(l)}`), ...changed(x, '-'), ...changed(y, '+')].join('\n');
}

// Any Chromium does, as both sides run in the same one: Playwright's own, or else the newest headless shell in its
// download cache.
async function launch() {
  try {
    return await chromium.launch();
  } catch (e) {
    const cached = cachedChromium();
    if (cached) return chromium.launch({ executablePath: cached });
    throw new Error(`${e.message.split('\n')[0]}\nNo Chromium found. Install one with \`npx playwright-core install chromium-headless-shell\`.`);
  }
}

function cachedChromium() {
  const home = os.homedir();
  const cache = process.env.PLAYWRIGHT_BROWSERS_PATH
    || { darwin: path.join(home, 'Library/Caches/ms-playwright'), win32: path.join(process.env.LOCALAPPDATA || home, 'ms-playwright') }[process.platform]
    || path.join(home, '.cache/ms-playwright');
  if (!fs.existsSync(cache)) return null;
  const shells = fs.readdirSync(cache).filter(d => d.startsWith('chromium_headless_shell-')).sort((a, b) => b.split('-')[1] - a.split('-')[1]);
  for (const shell of shells) {
    for (const sub of fs.readdirSync(path.join(cache, shell))) {
      const exe = ['chrome-headless-shell', 'chrome-headless-shell.exe'].map(name => path.join(cache, shell, sub, name)).find(f => fs.existsSync(f));
      if (exe) return exe;
    }
  }
  return null;
}

main(process.argv[2]).then(code => { process.exitCode = code; }, e => { console.error(e.message); process.exitCode = 2; });
