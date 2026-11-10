<?php

namespace davidhellmann\orrery\controllers;

use CraftCms\Cms\Cms;
use CraftCms\Cms\Support\Str;
use davidhellmann\orrery\services\Viewer;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;
use Symfony\Component\HttpFoundation\HeaderUtils;

use function CraftCms\Cms\cp_url;
use function CraftCms\Cms\t;

/**
 * The control panel section, and the bare viewer page it embeds. `routes/cp.php` says who may reach them.
 */
class ViewerController
{
    /**
     * The page is `resources/js/cp.js`, which Craft draws inside the control panel.
     */
    public function index(): InertiaResponse
    {
        return Inertia::render('orrery/Index', [
            'title' => t('Content Model', category: 'orrery'),
            'appUrl' => cp_url('orrery/app'),
            'downloadUrl' => cp_url('orrery/app', ['download' => 1]),
            'labels' => [
                'fullscreen' => t('Fullscreen', category: 'orrery'),
                'newTab' => t('Open in new tab', category: 'orrery'),
                'download' => t('Download', category: 'orrery'),
            ],
        ]);
    }

    public function app(Request $request, Viewer $viewer): Response
    {
        $headers = ['Content-Type' => 'text/html; charset=UTF-8'];

        if ($request->boolean('download')) {
            $filename = Str::slug(Cms::systemName()) . '-content-model.html';
            $headers['Content-Disposition'] = HeaderUtils::makeDisposition(HeaderUtils::DISPOSITION_ATTACHMENT, $filename);
        }

        return new Response($viewer->render(), 200, $headers);
    }
}
