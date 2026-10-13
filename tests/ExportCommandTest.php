<?php

namespace davidhellmann\orrery\tests;

use CraftCms\Aliases\Aliases;

/**
 * `php artisan orrery:export` writes the viewer, or the raw data for a path ending in `.json`.
 */
class ExportCommandTest extends TestCase
{
    private string $dir;

    protected function setUp(): void
    {
        parent::setUp();
        $this->dir = sys_get_temp_dir() . '/orrery-export-' . bin2hex(random_bytes(4));
        Aliases::set('@exports', $this->dir);
    }

    protected function tearDown(): void
    {
        array_map('unlink', glob("$this->dir/*") ?: []);
        @rmdir($this->dir);
        parent::tearDown();
    }

    public function testWritesTheViewerToAPathWithAnAlias(): void
    {
        $this->artisan('orrery:export', ['path' => '@exports/model.html'])->assertSuccessful();

        $this->assertStringContainsString('window.CONTENT_MODEL = {', (string)file_get_contents("$this->dir/model.html"));
    }

    public function testWritesTheRawDataForAJsonPath(): void
    {
        $this->artisan('orrery:export', ['path' => '@exports/model.json'])->assertSuccessful();

        $data = json_decode((string)file_get_contents("$this->dir/model.json"), true);
        $this->assertArrayNotHasKey('dateModified', $data);
        $this->assertSame(['default'], array_column($data['sites'], 'handle'));
    }
}
