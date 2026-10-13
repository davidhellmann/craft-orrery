<?php

namespace davidhellmann\orrery\models;

use Closure;
use CraftCms\Cms\Plugin\PluginSettings;

use function CraftCms\Cms\t;

/**
 * Orrery settings
 */
class Settings extends PluginSettings
{
    /**
     * @var string|string[] Prefix that handles of entry types attached to a section should start with. Several
     * prefixes go in `config/craft/orrery.php` as an array. Empty skips the check.
     */
    public string|array $pageHandlePrefix = '';

    /**
     * @var string|string[] Prefix that handles of entry types attached to a Matrix field should start with. Several
     * prefixes go in `config/craft/orrery.php` as an array. Empty skips the check.
     */
    public string|array $blockHandlePrefix = '';

    /**
     * @return string[] The prefixes set for an attribute, without blanks.
     */
    public function prefixes(string $attribute): array
    {
        $prefixes = array_map(fn($prefix) => trim((string)$prefix), (array)$this->$attribute);

        return array_values(array_filter($prefixes, fn(string $prefix) => $prefix !== ''));
    }

    /**
     * The settings a config file overrides, each with the value the project config stores for it, or its default.
     * Craft saves every setting the model holds, and the model holds the config file's values, so before saving, the
     * plugin puts these back: without them saving the form would write the config file's values into the project
     * config.
     *
     * @param array $fileConfig The settings `config/craft/orrery.php` sets.
     * @param array $stored The settings the project config stores.
     * @return array<string, string|string[]>
     */
    public function storedOverrides(array $fileConfig, array $stored): array
    {
        $overridden = array_intersect_key((new self())->validationData(), $fileConfig);

        return array_intersect_key($stored, $overridden) + $overridden;
    }

    public function getRules(): array
    {
        return array_merge(parent::getRules(), [
            'pageHandlePrefix' => [$this->validatePrefixes(...)],
            'blockHandlePrefix' => [$this->validatePrefixes(...)],
        ]);
    }

    private function validatePrefixes(string $attribute, mixed $value, Closure $fail): void
    {
        foreach ((array)$value as $prefix) {
            if (!is_string($prefix) || mb_strlen($prefix) > 64) {
                $fail(t('Prefixes must be text, up to 64 characters each.', category: 'orrery'));
                return;
            }
        }
    }
}
