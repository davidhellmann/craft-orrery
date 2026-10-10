<?php

namespace davidhellmann\orrery\models;

use Craft;
use craft\base\Model;

/**
 * Orrery settings
 */
class Settings extends Model
{
    /**
     * @var string|string[] Prefix that handles of entry types attached to a section should start with. Several
     * prefixes go in `config/orrery.php` as an array. Empty skips the check.
     */
    public string|array $pageHandlePrefix = '';

    /**
     * @var string|string[] Prefix that handles of entry types attached to a Matrix field should start with. Several
     * prefixes go in `config/orrery.php` as an array. Empty skips the check.
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
     * The settings form shows them read-only and posts these values along: Craft saves only the settings a form posts,
     * so without them saving the form would drop what the project config has.
     *
     * @param array $fileConfig The settings `config/orrery.php` sets.
     * @param array $stored The settings the project config stores.
     * @return array<string, string|string[]>
     */
    public function storedOverrides(array $fileConfig, array $stored): array
    {
        $overridden = array_intersect_key((new self())->getAttributes(), $fileConfig);

        return array_intersect_key($stored, $overridden) + $overridden;
    }

    protected function defineRules(): array
    {
        return [
            [['pageHandlePrefix', 'blockHandlePrefix'], function(string $attribute) {
                foreach ((array)$this->$attribute as $prefix) {
                    if (!is_string($prefix) || mb_strlen($prefix) > 64) {
                        $this->addError($attribute, Craft::t('orrery', 'Prefixes must be text, up to 64 characters each.'));
                        return;
                    }
                }
            }],
        ];
    }
}
