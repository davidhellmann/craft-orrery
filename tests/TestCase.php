<?php

namespace davidhellmann\orrery\tests;

use CraftCms\Aliases\AliasesServiceProvider;
use CraftCms\Cms\Plugin\Testing\PluginTestCase;
use CraftCms\DependencyAwareCache\CacheServiceProvider;
use CraftCms\RulesetValidation\RulesetValidationServiceProvider;
use Inertia\ServiceProvider as InertiaServiceProvider;

/**
 * A Craft app with Orrery installed, on an in-memory SQLite database that each test starts afresh.
 */
abstract class TestCase extends PluginTestCase
{
    /**
     * A Craft project discovers these from Craft's own dependencies. Testbench doesn't, so they're listed here.
     */
    protected function getPackageProviders($app): array
    {
        return [
            InertiaServiceProvider::class,
            AliasesServiceProvider::class,
            CacheServiceProvider::class,
            RulesetValidationServiceProvider::class,
            ...parent::getPackageProviders($app),
        ];
    }

    /**
     * The facades Craft declares for a project to discover, which its control panel templates use, like `DeltaRegistry`.
     */
    protected function getPackageAliases($app): array
    {
        $composer = json_decode((string)file_get_contents(dirname(__DIR__) . '/vendor/craftcms/cms/composer.json'), true);

        return $composer['extra']['laravel']['aliases'] ?? [];
    }
}
