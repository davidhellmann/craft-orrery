<?php

namespace davidhellmann\orrery\console;

use CraftCms\Aliases\Aliases;
use CraftCms\Cms\Support\File;
use CraftCms\Cms\Support\Json;
use davidhellmann\orrery\services\ContentModel;
use davidhellmann\orrery\services\Viewer;
use Illuminate\Console\Command;

/**
 * Exports the content model.
 */
class ExportCommand extends Command
{
    protected $signature = 'orrery:export
        {path=content-model.html : File to write. Aliases like `@storage` work.}';

    protected $description = 'Writes the viewer as a standalone HTML file, or the raw data if the path ends in `.json`.';

    public function handle(ContentModel $contentModel, Viewer $viewer): int
    {
        $file = Aliases::get((string)$this->argument('path'));
        $isJson = strtolower(pathinfo($file, PATHINFO_EXTENSION)) === 'json';

        $contents = $isJson
            ? Json::encode($contentModel->getData(), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n"
            : $viewer->render();

        File::ensureDirectoryExists(dirname($file));
        File::put($file, $contents);
        $this->components->info(sprintf('Wrote %s (%s KB)', $file, round(strlen($contents) / 1024)));

        return self::SUCCESS;
    }
}
