<?php

namespace davidhellmann\orrery\tests\fixtures\fields;

use craft\fields\Matrix;

/**
 * A plugin's field type built on Matrix, for the fixture project config.
 */
class Gallery extends Matrix
{
    public static function displayName(): string
    {
        return 'Gallery';
    }
}
