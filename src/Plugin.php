<?php

namespace davidhellmann\orrery;

use Craft;
use craft\base\Model;
use craft\base\Plugin as BasePlugin;
use craft\events\RegisterUrlRulesEvent;
use craft\web\UrlManager;
use davidhellmann\orrery\models\Settings;
use davidhellmann\orrery\services\ContentModel;
use davidhellmann\orrery\services\Viewer;
use yii\base\Event;

/**
 * Orrery plugin
 *
 * @method static Plugin getInstance()
 * @method Settings getSettings()
 * @property-read ContentModel $contentModel
 * @property-read Viewer $viewer
 * @author David Hellmann <david@hellmann.io>
 * @copyright David Hellmann
 * @license MIT
 */
class Plugin extends BasePlugin
{
    public string $schemaVersion = '1.0.0';
    public bool $hasCpSection = true;
    public bool $hasCpSettings = true;

    public static function config(): array
    {
        return [
            'components' => [
                'contentModel' => ContentModel::class,
                'viewer' => Viewer::class,
            ],
        ];
    }

    public function init(): void
    {
        parent::init();

        Event::on(
            UrlManager::class,
            UrlManager::EVENT_REGISTER_CP_URL_RULES,
            function(RegisterUrlRulesEvent $event) {
                $event->rules['orrery/app'] = 'orrery/viewer';
            }
        );
    }

    protected function createSettingsModel(): ?Model
    {
        return Craft::createObject(Settings::class);
    }

    protected function settingsHtml(): ?string
    {
        $config = Craft::$app->getConfig()->getConfigFromFile($this->handle);

        return Craft::$app->getView()->renderTemplate('orrery/_settings.twig', [
            'settings' => $this->getSettings(),
            'overrides' => is_array($config) ? array_keys($config) : [],
        ]);
    }
}
