// The viewer speaks the language the server picked, with Orrery's messages translated into it by their English. A
// message without a translation stays English.
const { language: LANGUAGE, messages: MESSAGES } = window.ORRERY_I18N;

// t('Up to {n} entries', { n: 3 }): the message in the viewer's language, its placeholders filled in.
const t = (message, params = {}) => (MESSAGES[message] || message).replace(/\{(\w+)\}/g, (m, name) => (name in params ? params[name] : m));
// tn(3, '{n} field', '{n} fields'): English and German both say one thing for 1 and another for every other number.
const tn = (n, one, other, params = {}) => t(n === 1 ? one : other, { n, ...params });
// A label in the quotes of the language: “Intro”, „Intro“.
const quoted = text => t('“{text}”', { text });
// A unix timestamp as a date and time, written the way the language writes them.
const formatDate = ts => new Date(ts * 1000).toLocaleString(LANGUAGE);
