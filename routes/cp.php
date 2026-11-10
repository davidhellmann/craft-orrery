<?php

/**
 * Control panel routes. Craft registers them for logged-in users who may use the control panel, and checks nothing
 * else, so they require *Access Orrery* on top.
 */

use davidhellmann\orrery\controllers\ViewerController;
use Illuminate\Support\Facades\Route;

Route::middleware('can:accessPlugin-orrery')->group(function() {
    Route::get('orrery', [ViewerController::class, 'index']);
    Route::get('orrery/app', [ViewerController::class, 'app']);
});
