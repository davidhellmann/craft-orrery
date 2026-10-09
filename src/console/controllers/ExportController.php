<?php

namespace davidhellmann\orrery\console\controllers;

use Craft;
use craft\console\Controller;
use craft\helpers\FileHelper;
use craft\helpers\Json;
use davidhellmann\orrery\Plugin;
use yii\console\ExitCode;

/**
 * Exports the content model.
 */
class ExportController extends Controller
{
    /**
     * Writes the viewer as a standalone HTML file, or the raw data if the path ends in `.json`.
     *
     * @param string $path File to write. Aliases like `@storage` work.
     */
    public function actionIndex(string $path = 'content-model.html'): int
    {
        $plugin = Plugin::getInstance();
        $file = Craft::getAlias($path);
        $isJson = strtolower(pathinfo($file, PATHINFO_EXTENSION)) === 'json';

        $contents = $isJson
            ? Json::encode($plugin->contentModel->getData(), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n"
            : $plugin->viewer->render();

        FileHelper::writeToFile($file, $contents);
        $this->success(sprintf('Wrote %s (%s KB)', $file, round(strlen($contents) / 1024)));

        return ExitCode::OK;
    }
}
