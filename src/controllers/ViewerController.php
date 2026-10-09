<?php

namespace davidhellmann\orrery\controllers;

use Craft;
use craft\helpers\StringHelper;
use craft\web\Controller;
use davidhellmann\orrery\Plugin;
use yii\web\Response;

/**
 * Serves the bare viewer page that the control panel section embeds.
 */
class ViewerController extends Controller
{
    public function actionIndex(bool $download = false): Response
    {
        $html = Plugin::getInstance()->viewer->render();

        if ($download) {
            $filename = StringHelper::toKebabCase(Craft::$app->getSystemName()) . '-content-model.html';

            return $this->response->sendContentAsFile($html, $filename, ['mimeType' => 'text/html']);
        }

        $this->response->format = Response::FORMAT_HTML;
        $this->response->data = $html;

        return $this->response;
    }
}
