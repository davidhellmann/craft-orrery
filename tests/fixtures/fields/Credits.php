<?php

namespace davidhellmann\orrery\tests\fixtures\fields;

use craft\fields\ContentBlock;

/**
 * A plugin's field type built on ContentBlock, for the fixture project config.
 */
class Credits extends ContentBlock
{
    public static function displayName(): string
    {
        return 'Credits';
    }
}
