<?php

namespace davidhellmann\orrery\helpers;

use Craft;

/**
 * Lets the app speak another language for a moment, so that whatever Craft translates comes in it.
 */
class Language
{
    /**
     * Calls `$callback` with the app set to `$language`, then sets the app's own language back, also when it throws.
     *
     * @template T
     * @param callable(): T $callback
     * @return T
     */
    public static function during(string $language, callable $callback): mixed
    {
        $appLanguage = Craft::$app->language;
        Craft::$app->language = $language;
        try {
            return $callback();
        } finally {
            Craft::$app->language = $appLanguage;
        }
    }
}
