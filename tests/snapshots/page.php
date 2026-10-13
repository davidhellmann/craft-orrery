<?php

/**
 * Builds the viewer page of the plugin at <root> from its own files, the way `Viewer::render()` does: its template,
 * styles and scripts in the order its `Viewer::SCRIPTS` lists them, with the data of its fixture project and handle
 * prefixes set. Craft isn't booted, so <root> may be an older checkout.
 *
 * Usage: php tests/snapshots/page.php <root> <out.html>
 */

use Twig\Environment;
use Twig\Loader\FilesystemLoader;
use Twig\TwigFilter;

require dirname(__DIR__, 2) . '/vendor/autoload.php';

[, $root, $out] = $_SERVER['argv'] + [null, null, null];
if (!$root || !$out) {
    fwrite(STDERR, "Usage: php tests/snapshots/page.php <root> <out.html>\n");
    exit(2);
}
$root = rtrim($root, '/');

preg_match('/SCRIPTS = \[([^\]]*)\]/', (string)file_get_contents("$root/src/services/Viewer.php"), $list);
preg_match_all("/'([^']+)'/", $list[1] ?? '', $names);
$sources = array_map(fn(string $name) => file_get_contents("$root/src/viewer/$name.js"), $names[1]);
$script = str_ireplace('</script', '<\/script', "(() => {\n'use strict';\n" . implode("\n", $sources) . "\n})();");

$data = json_decode((string)file_get_contents("$root/tests/fixtures/content-model.json"), true) + [
    // Some handles of the fixture project have these prefixes and some don't, so both show.
    'prefixes' => ['page' => ['page_', 'single_'], 'block' => ['block_']],
];

$twig = new Environment(new FilesystemLoader("$root/src/templates"), ['autoescape' => 'html']);
// Craft's translation filter, for templates that use it: the plugin's messages are their English.
$twig->addFilter(new TwigFilter('t', fn(string $message) => $message));

file_put_contents($out, $twig->render('_viewer.twig', [
    'title' => 'Orrery',
    'styles' => file_get_contents("$root/src/viewer/viewer.css"),
    // As `Viewer::JSON_FLAGS` encodes it.
    'data' => json_encode($data, JSON_UNESCAPED_UNICODE | JSON_HEX_QUOT | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS),
    'script' => $script,
]));
