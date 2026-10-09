<?php

namespace davidhellmann\orrery\services;

use Craft;
use craft\helpers\Json;
use craft\web\View;
use davidhellmann\orrery\Plugin;
use yii\base\Component;

/**
 * Renders the viewer as one self-contained HTML page, with data, styles and scripts inlined.
 */
class Viewer extends Component
{
    /**
     * Scripts share one scope, so later files can use what earlier ones define.
     */
    private const SCRIPTS = ['model', 'ui', 'graph', 'table', 'layout', 'diff', 'app'];

    public function render(): string
    {
        $plugin = Plugin::getInstance();
        $settings = $plugin->getSettings();

        $data = $plugin->contentModel->getData() + [
            'prefixes' => [
                'page' => $settings->pageHandlePrefix,
                'block' => $settings->blockHandlePrefix,
            ],
        ];

        return Craft::$app->getView()->renderTemplate('orrery/_viewer.twig', [
            'title' => $plugin->name,
            'styles' => $this->read('viewer.css'),
            'data' => Json::htmlEncode($data),
            'script' => $this->script(),
        ], View::TEMPLATE_MODE_CP);
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
