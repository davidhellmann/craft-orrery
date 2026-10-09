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
