<?php

/**
 * Loads Craft's classes without booting Craft: no app, no database. Without an app, `Craft::t()` returns the
 * message as written, so field type labels come out in English.
 */

require dirname(__DIR__) . '/vendor/autoload.php';
require dirname(__DIR__) . '/vendor/yiisoft/yii2/Yii.php';
require dirname(__DIR__) . '/vendor/craftcms/cms/src/Craft.php';
