<?php

namespace davidhellmann\orrery\tests;

use Craft;
use davidhellmann\orrery\services\Viewer;
use PHPUnit\Framework\TestCase;

/**
 * The language the viewer speaks and the messages it gets in it.
 */
class ViewerTest extends TestCase
{
    protected function tearDown(): void
    {
        Craft::$app->language = 'en-US';
    }

    public function testGermanSpeakersGetTheViewerInGerman(): void
    {
        $this->assertSame(['de', 'de-CH', 'de-AT'], array_map(fn(string $language) => $this->languageFor($language), ['de', 'de-CH', 'de-AT']));
    }

    public function testEveryOtherLanguageGetsEnglish(): void
    {
        $this->assertSame(['en-US', 'en-GB', 'en', 'en'], array_map(fn(string $language) => $this->languageFor($language), ['en-US', 'en-GB', 'fr', 'nl-BE']));
    }

    public function testMessagesInGermanByTheirEnglishWithPlaceholdersForTheViewerToFillIn(): void
    {
        $messages = (new Viewer())->messages('de-CH');

        $this->assertSame('Herunterladen', $messages['Download']);
        $this->assertSame('Konfiguration vom {date}', $messages['Config updated {date}']);
    }

    public function testMessagesInEnglish(): void
    {
        $messages = (new Viewer())->messages('en-GB');

        $this->assertSame('Download', $messages['Download']);
        $this->assertSame('Config updated {date}', $messages['Config updated {date}']);
    }

    private function languageFor(string $appLanguage): string
    {
        Craft::$app->language = $appLanguage;

        return (new Viewer())->language();
    }
}
