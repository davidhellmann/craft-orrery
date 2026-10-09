<?php

namespace davidhellmann\orrery\tests;

use PHPUnit\Framework\TestCase;

/**
 * Orrery speaks English and German: `src/translations/en/orrery.php` has every message, by its English, and the German
 * file translates each of them.
 */
class TranslationsTest extends TestCase
{
    private const SRC = __DIR__ . '/../src';

    /**
     * How the code asks for a message: `t('…')` and `tn(n, '…', '…')` in the viewer, `'…'|t('orrery')` in templates,
     * `Craft::t('orrery', '…')` in PHP.
     */
    private const ASKS = [
        'js' => ["/\\bt\\('((?:[^'\\\\]|\\\\.)*)'/", "/\\btn\\([^,()]+, '((?:[^'\\\\]|\\\\.)*)', '((?:[^'\\\\]|\\\\.)*)'/"],
        'twig' => ["/'((?:[^'\\\\]|\\\\.)*)'\\|t\\('orrery'/"],
        'php' => ["/Craft::t\\('orrery', '((?:[^'\\\\]|\\\\.)*)'/"],
    ];

    public function testEveryMessageOrreryAsksForIsInEnglish(): void
    {
        $this->assertSame([], array_values(array_diff($this->askedFor(), array_keys($this->messages('en')))));
    }

    public function testEnglishHasNoMessageNobodyAsksFor(): void
    {
        $this->assertSame([], array_values(array_diff(array_keys($this->messages('en')), $this->askedFor())));
    }

    public function testEnglishMessagesAreTheirOwnEnglish(): void
    {
        $english = $this->messages('en');

        $this->assertSame(array_keys($english), array_values($english));
    }

    /**
     * One message per meaning: “User groups” and “User Groups” are one thing, worded one way.
     */
    public function testNoTwoMessagesDifferOnlyInCase(): void
    {
        $english = array_keys($this->messages('en'));

        $this->assertSame([], array_values(array_diff_key($english, array_unique(array_map('mb_strtolower', $english)))));
    }

    public function testGermanHasEveryMessageEnglishHas(): void
    {
        $this->assertSame([], array_values(array_diff(array_keys($this->messages('en')), array_keys($this->messages('de')))));
    }

    public function testGermanHasNoMessageEnglishLacks(): void
    {
        $this->assertSame([], array_values(array_diff(array_keys($this->messages('de')), array_keys($this->messages('en')))));
    }

    private function messages(string $language): array
    {
        return require self::SRC . "/translations/$language/orrery.php";
    }

    /**
     * Every message the plugin's code asks for.
     *
     * @return string[]
     */
    private function askedFor(): array
    {
        $messages = [];
        $files = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator(self::SRC, \FilesystemIterator::SKIP_DOTS));
        foreach ($files as $file) {
            foreach (self::ASKS[$file->getExtension()] ?? [] as $pattern) {
                preg_match_all($pattern, file_get_contents($file->getPathname()), $matches);
                array_push($messages, ...array_merge(...array_slice($matches, 1)));
            }
        }

        return array_values(array_unique(array_map(fn(string $message) => str_replace("\\'", "'", $message), $messages)));
    }
}
