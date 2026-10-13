<?php

namespace davidhellmann\orrery\tests;

use CraftCms\Cms\Form\Enums\ControlMode;
use CraftCms\Cms\Form\Nodes\Field;
use CraftCms\Cms\ProjectConfig\ProjectConfig;
use CraftCms\Cms\User\Models\User;
use davidhellmann\orrery\Plugin;

use function CraftCms\Cms\cp_url;

/**
 * The settings form, and what saving it writes to the project config.
 */
class SettingsFormTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        // The admin Craft's install creates.
        $this->actingAs(User::firstOrFail());
        session()->passwordConfirmed();
    }

    public function testTheFormShows(): void
    {
        // The control panel's built scripts and styles aren't part of the Craft package.
        $this->withoutVite();

        $this->get(cp_url('settings/plugins/orrery'))->assertOk();
    }

    public function testASettingTheConfigFileSetsShowsDisabledWithTheFilesValue(): void
    {
        config()->set('craft.orrery', ['pageHandlePrefix' => ['page_', 'single_']]);

        $fields = array_values(array_filter(Plugin::getInstance()->settingsForm()->nodes(), fn($node) => $node instanceof Field));
        [$page, $block] = array_map(fn(Field $field) => $field->getControl(), $fields);

        $this->assertSame([ControlMode::Disabled, 'page_, single_'], [$page->getMode(), $page->getValue()]);
        $this->assertSame(ControlMode::Editable, $block->getMode());
    }

    public function testSavingTheFormStoresThePrefixes(): void
    {
        $this->save(['pageHandlePrefix' => 'page_', 'blockHandlePrefix' => 'block_']);

        $this->assertEquals(['pageHandlePrefix' => 'page_', 'blockHandlePrefix' => 'block_'], $this->stored());
    }

    public function testSavingTheFormKeepsWhatTheProjectConfigHasForASettingTheConfigFileOverrides(): void
    {
        $this->save(['pageHandlePrefix' => 'pg_', 'blockHandlePrefix' => 'block_']);
        config()->set('craft.orrery', ['pageHandlePrefix' => ['page_', 'single_']]);

        $this->save(['pageHandlePrefix' => 'page_, single_', 'blockHandlePrefix' => 'b_']);

        $this->assertEquals(['pageHandlePrefix' => 'pg_', 'blockHandlePrefix' => 'b_'], $this->stored());
    }

    public function testPrefixesLongerThan64CharactersAreRefused(): void
    {
        $this->save(['pageHandlePrefix' => str_repeat('p', 65), 'blockHandlePrefix' => '']);

        $this->assertSame([], $this->stored());
    }

    private function save(array $settings): void
    {
        $this->post(cp_url('settings/plugins/orrery'), ['settings' => $settings]);
    }

    private function stored(): array
    {
        return app(ProjectConfig::class)->get('plugins.orrery.settings') ?? [];
    }
}
