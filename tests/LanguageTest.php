<?php

namespace davidhellmann\orrery\tests;

use Craft;
use davidhellmann\orrery\helpers\Language;
use PHPUnit\Framework\TestCase;

/**
 * Doing something with the app in another language for a moment.
 */
class LanguageTest extends TestCase
{
    protected function tearDown(): void
    {
        Craft::$app->language = 'en-US';
    }

    public function testTheAppSpeaksTheLanguageMeanwhileAndItsOwnAfterwards(): void
    {
        Craft::$app->language = 'fr';

        $this->assertSame(['de', 'Reiner Text'], Language::during('de', fn() => [Craft::$app->language, Craft::t('app', 'Plain Text')]));
        $this->assertSame('fr', Craft::$app->language);
    }

    public function testTheAppGetsItsLanguageBackWhenSomethingGoesWrong(): void
    {
        Craft::$app->language = 'fr';

        try {
            Language::during('de', fn() => throw new \RuntimeException('Nope'));
        } catch (\RuntimeException) {
        }

        $this->assertSame('fr', Craft::$app->language);
    }
}
