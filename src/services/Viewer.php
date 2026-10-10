<?php

namespace davidhellmann\orrery\services;

use Craft;
use craft\helpers\Json;
use craft\web\View;
use davidhellmann\orrery\helpers\Language;
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
    private const SCRIPTS = ['i18n', 'model', 'ui', 'graph', 'table', 'layout', 'diff', 'app'];

    /**
     * The languages Orrery speaks. The first is the one for everybody else.
     */
    private const LANGUAGES = ['en', 'de'];

    /**
     * The app's language if Orrery speaks it, which in the control panel is the user's, or else English.
     */
    public function language(): string
    {
        $language = Craft::$app->language;

        return in_array(explode('-', $language)[0], self::LANGUAGES, true) ? $language : self::LANGUAGES[0];
    }

    /**
     * Every Orrery message in a language, by its English. One that language lacks stays English. Placeholders like
     * `{date}` stay for the viewer to fill in.
     *
     * @return array<string, string>
     */
    public function messages(string $language): array
    {
        $english = array_keys(require dirname(__DIR__) . '/translations/en/orrery.php');

        return array_combine($english, array_map(fn(string $message) => Craft::t('orrery', $message, [], $language), $english));
    }

    public function render(): string
    {
        $plugin = Plugin::getInstance();
        $settings = $plugin->getSettings();
        $language = $this->language();

        // The page speaks the viewer's language throughout, also where it isn't the app's: field types name
        // themselves in the app's language, and the template's messages are in it too.
        return Language::during($language, function() use ($plugin, $settings, $language) {
            $data = $plugin->contentModel->getData(forViewer: true) + [
                'prefixes' => [
                    'page' => $settings->prefixes('pageHandlePrefix'),
                    'block' => $settings->prefixes('blockHandlePrefix'),
                ],
            ];

            return Craft::$app->getView()->renderTemplate('orrery/_viewer.twig', [
                'title' => $plugin->name,
                'language' => $language,
                'styles' => $this->read('viewer.css'),
                'data' => Json::htmlEncode($data),
                'i18n' => Json::htmlEncode(['language' => $language, 'messages' => $this->messages($language)]),
                'script' => $this->script(),
            ], View::TEMPLATE_MODE_CP);
        });
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
