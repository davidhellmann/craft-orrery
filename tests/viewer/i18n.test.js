// The viewer in the language the server sends it, with Orrery's messages translated into it (src/translations).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadViewer } = require('./load');

// The buttons in a node's details that lead to other views: [where to, what it says].
const links = html => [...html.matchAll(/href="#(\w+)\/[^"]*">([^<]+)</g)].map(m => [m[1], m[2]]);

test('the viewer says what the server translated, and the English for whatever it didn’t', () => {
  const { crossLinks } = loadViewer({ language: 'de', messages: { 'Show in table': 'In Tabelle zeigen', Compare: 'Vergleichen' } });

  assert.deepEqual(links(crossLinks('page:et-article', 'graph')), [['table', 'In Tabelle zeigen'], ['layout', 'Open layout'], ['diff', 'Vergleichen']]);
});

test('kinds and the names Orrery gives things come in the viewer’s language', () => {
  const german = { 'Global Set': 'Globales Set', Users: 'Benutzer', 'as {name}': 'als {name}', '“{text}”': '„{text}“', 'Available in': 'Verfügbar in' };
  const { chip, nodeOf, detailHTML } = loadViewer({ language: 'de', messages: german });

  assert.match(chip('globalset:global-footer'), /Footer <span class="faint">· Globales Set<\/span>/);
  assert.equal(nodeOf('fieldlayout:users').obj.name, 'Benutzer');
  assert.match(detailHTML(nodeOf('block:et-quote')), /<h3>Verfügbar in<\/h3>.*<span class="note">als „Pull quote“<\/span>/);
});

test('a message gets its placeholders filled in, in either language', () => {
  const english = loadViewer();
  const german = loadViewer({ language: 'de', messages: { 'Up to {n} entries': 'Bis zu {n} Einträge' } });

  assert.equal(english.t('Up to {n} entries', { n: 3 }), 'Up to 3 entries');
  assert.equal(german.t('Up to {n} entries', { n: 3 }), 'Bis zu 3 Einträge');
  assert.equal(german.t('Up to {n} entries'), 'Bis zu {n} Einträge');
});

test('a count says one thing for 1 and another for every other number', () => {
  const { tn } = loadViewer({ language: 'de', messages: { '{n} difference': '{n} Unterschied', '{n} differences': '{n} Unterschiede' } });

  assert.deepEqual([0, 1, 2].map(n => tn(n, '{n} difference', '{n} differences')), ['0 Unterschiede', '1 Unterschied', '2 Unterschiede']);
});

test('a label in quotes gets the quotes of the language', () => {
  assert.equal(loadViewer().quoted('Intro'), '“Intro”');
  assert.equal(loadViewer({ language: 'de', messages: { '“{text}”': '„{text}“' } }).quoted('Intro'), '„Intro“');
});

test('dates are written the way the language writes them', () => {
  // Noon UTC on 1 January 2026, so the 1st in every time zone a test might run in.
  const noon = 1767268800;

  assert.match(loadViewer({ language: 'en-US' }).formatDate(noon), /^1\/1\/2026, \d{1,2}:00:00\s[AP]M$/);
  assert.match(loadViewer({ language: 'en-GB' }).formatDate(noon), /^01\/01\/2026, \d\d:00:00$/);
  assert.match(loadViewer({ language: 'de' }).formatDate(noon), /^1\.1\.2026, \d\d:00:00$/);
});
