<?php

namespace davidhellmann\orrery\services;

use CraftCms\Cms\Support\Json;
use CraftCms\Cms\View\TemplateMode;
use davidhellmann\orrery\Plugin;

use function CraftCms\Cms\template;

/**
 * Renders the viewer as one self-contained HTML page, with data, styles and scripts inlined.
 */
class Viewer
{
    /**
     * Scripts share one scope, so later files can use what earlier ones define.
     */
    private const SCRIPTS = ['model', 'ui', 'graph', 'table', 'layout', 'diff', 'app'];

    /**
     * The data goes into a `<script>` element, so nothing in it may close the element or start markup.
     */
    public const JSON_FLAGS = JSON_UNESCAPED_UNICODE | JSON_HEX_QUOT | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS;

    public function __construct(private ContentModel $contentModel)
    {
    }

    public function render(): string
    {
        $plugin = Plugin::getInstance();
        $settings = $plugin->getSettings();

        $data = $this->contentModel->getData(forViewer: true) + [
            'prefixes' => [
                'page' => $settings->prefixes('pageHandlePrefix'),
                'block' => $settings->prefixes('blockHandlePrefix'),
            ],
        ];

        return template('orrery/_viewer.twig', [
            'title' => $plugin->name,
            'styles' => $this->read('viewer.css'),
            'data' => Json::encode($data, self::JSON_FLAGS),
            'script' => $this->script(),
        ], TemplateMode::Cp);
    }

    private function script(): string
    {
        $sources = array_map(fn(string $name) => $this->read("$name.js"), self::SCRIPTS);
        $script = "(() => {\n'use strict';\n" . implode("\n", $sources) . "\n})();";

        return str_ireplace('</script', '<\/script', $script);
    }

    private function read(string $file): string
    {
        return file_get_contents(Plugin::getInstance()->getBasePath() . "/viewer/$file");
    }
}
