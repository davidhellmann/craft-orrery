<?php

namespace davidhellmann\orrery\tests\fixtures\fields;

use CraftCms\Cms\Field\ContentBlock;

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
