<?php

/**
 * Control panel routes. Craft registers them under the control panel trigger, but checks nothing else, so they require
 * a logged-in user who may use the control panel and *Access Orrery*.
 */

use davidhellmann\orrery\controllers\ViewerController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth', 'can:accessCp', 'can:accessPlugin-orrery'])->group(function() {
    Route::get('orrery', [ViewerController::class, 'index']);
    Route::get('orrery/app', [ViewerController::class, 'app']);
});
