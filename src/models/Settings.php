<?php

namespace davidhellmann\orrery\models;

use craft\base\Model;

/**
 * Orrery settings
 */
class Settings extends Model
{
    /**
     * @var string Prefix that handles of entry types attached to a section should start with. Empty skips the check.
     */
    public string $pageHandlePrefix = '';

    /**
     * @var string Prefix that handles of entry types attached to a Matrix field should start with. Empty skips the check.
     */
    public string $blockHandlePrefix = '';

    protected function defineRules(): array
    {
        return [
            [['pageHandlePrefix', 'blockHandlePrefix'], 'trim'],
            [['pageHandlePrefix', 'blockHandlePrefix'], 'string', 'max' => 64],
        ];
    }
}
