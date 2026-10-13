<?php

namespace davidhellmann\orrery\tests;

use davidhellmann\orrery\models\Settings;
use PHPUnit\Framework\TestCase;

/**
 * What saving the settings form keeps of the settings `config/craft/orrery.php` overrides.
 */
class SettingsTest extends TestCase
{
    public function testSavingTheFormKeepsTheProjectConfigValueOfASettingTheConfigFileOverrides(): void
    {
        $file = ['pageHandlePrefix' => ['page_', 'single_']];
        $stored = ['pageHandlePrefix' => 'pg_', 'blockHandlePrefix' => 'block_'];

        $this->assertSame(['pageHandlePrefix' => 'pg_'], (new Settings())->storedOverrides($file, $stored));
    }

    public function testAnOverriddenSettingTheProjectConfigLacksKeepsItsDefault(): void
    {
        $this->assertSame(['blockHandlePrefix' => ''], (new Settings())->storedOverrides(['blockHandlePrefix' => 'b_'], []));
    }

    public function testOnlySettingsCanBeOverridden(): void
    {
        $this->assertSame([], (new Settings())->storedOverrides(['somethingElse' => true], ['pageHandlePrefix' => 'pg_']));
    }
}
