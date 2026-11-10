<?php

namespace davidhellmann\orrery\tests;

use PHPUnit\Framework\TestCase;

/**
 * Composer installs Orrery from an archive of the repository, without what `.gitattributes` marks `export-ignore`.
 */
class PackageTest extends TestCase
{
    /**
     * Craft reads these from the installed package: the icons, and the control panel section's page and styles.
     */
    private const LOADED_BY_CRAFT = [
        'resources/icon.svg',
        'resources/icon-mask.svg',
        'resources/js/cp.js',
        'resources/css/cp.css',
    ];

    public function testWhatCraftLoadsIsInThePackage(): void
    {
        $root = dirname(__DIR__);

        foreach (self::LOADED_BY_CRAFT as $path) {
            $this->assertFileExists("$root/$path");

            $attribute = exec('git -C ' . escapeshellarg($root) . ' check-attr export-ignore -- ' . escapeshellarg($path));
            $this->assertSame("$path: export-ignore: unspecified", $attribute);
        }
    }
}
