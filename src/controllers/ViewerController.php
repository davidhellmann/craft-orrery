<?php

namespace davidhellmann\orrery\controllers;

use CraftCms\Cms\Cms;
use CraftCms\Cms\Support\Str;
use CraftCms\Cms\View\TemplateMode;
use davidhellmann\orrery\services\Viewer;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Symfony\Component\HttpFoundation\HeaderUtils;

use function CraftCms\Cms\pageTemplate;

/**
 * The control panel section, and the bare viewer page it embeds. `routes/cp.php` says who may reach them.
 */
class ViewerController
{
    public function index(): string
    {
        return pageTemplate('orrery/index', templateMode: TemplateMode::Cp);
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
