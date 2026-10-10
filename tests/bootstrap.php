<?php

/**
 * Loads Craft's classes without booting Craft: no database, no request. The app is just enough for `Craft::t()` to
 * translate Craft's own messages, so field types name themselves in the app's language: `en-US`, as in a console
 * request, unless a test changes it.
 */

use craft\console\Application;
use yii\i18n\I18N;
use yii\i18n\PhpMessageSource;

require dirname(__DIR__) . '/vendor/autoload.php';
require dirname(__DIR__) . '/vendor/yiisoft/yii2/Yii.php';
require dirname(__DIR__) . '/vendor/craftcms/cms/src/Craft.php';

Craft::$app = new class() extends Application {
    private I18N $i18n;

    public function __construct()
    {
        $this->i18n = new I18N([
            'translations' => [
                'app' => [
                    'class' => PhpMessageSource::class,
                    'sourceLanguage' => 'en-US',
                    'basePath' => dirname(__DIR__) . '/vendor/craftcms/cms/src/translations',
                    'forceTranslation' => true,
                ],
            ],
        ]);
    }

    public function getI18n(): I18N
    {
        return $this->i18n;
    }
};
