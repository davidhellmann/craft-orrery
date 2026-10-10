<?php

namespace davidhellmann\orrery\tests;

use craft\web\Controller;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;
use ReflectionMethod;

/**
 * Craft checks a plugin's permission for its control panel templates, but not for its controller actions, which anyone
 * logged in could reach through `actions/…` or `?action=`. So every web controller of the plugin turns other requests
 * away itself, before any action runs: in its own `beforeAction()`, after Craft's checks, it requires a control panel
 * request and *Access Orrery*, in either order. A running Craft would be needed to send it requests, so this test reads
 * the code.
 */
class WebControllersTest extends TestCase
{
    private const CRAFT_CHECK = 'parent::beforeAction(';
    private const PLUGIN_CHECKS = [
        '$this->requireCpRequest()',
        "\$this->requirePermission('accessPlugin-orrery')",
    ];

    /**
     * @return array<string, array{class-string}>
     */
    public static function webControllers(): array
    {
        $dir = dirname(__DIR__) . '/src/controllers';
        $controllers = [];
        foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir, RecursiveDirectoryIterator::SKIP_DOTS)) as $file) {
            $class = 'davidhellmann\\orrery\\controllers\\' . str_replace('/', '\\', substr($file->getPathname(), strlen($dir) + 1, -4));
            if ($file->getExtension() === 'php' && is_subclass_of($class, Controller::class)) {
                $controllers[$class] = [$class];
            }
        }

        return $controllers;
    }

    /**
     * @param class-string $class
     */
    #[DataProvider('webControllers')]
    public function testRequiresTheControlPanelAndAccessOrreryBeforeAnyAction(string $class): void
    {
        $method = new ReflectionMethod($class, 'beforeAction');
        $this->assertSame($class, $method->getDeclaringClass()->getName(), "$class has no beforeAction() of its own, so it doesn't check access.");

        $code = $this->code($method);
        $craft = strpos($code, self::CRAFT_CHECK);
        $this->assertNotFalse($craft, "$class::beforeAction() skips Craft's own checks (`" . self::CRAFT_CHECK . '`).');
        foreach (self::PLUGIN_CHECKS as $check) {
            $found = strpos($code, $check);
            $this->assertNotFalse($found, "$class::beforeAction() lacks `$check`.");
            $this->assertGreaterThan($craft, $found, "$class::beforeAction() runs `$check` before Craft's own checks.");
        }
    }

    /**
     * The method's code without comments and whitespace.
     */
    private function code(ReflectionMethod $method): string
    {
        $lines = file((string)$method->getFileName()) ?: [];
        $source = implode('', array_slice($lines, $method->getStartLine() - 1, $method->getEndLine() - $method->getStartLine() + 1));
        $code = '';
        foreach (token_get_all("<?php $source") as $token) {
            if (is_array($token) && in_array($token[0], [T_OPEN_TAG, T_COMMENT, T_DOC_COMMENT, T_WHITESPACE], true)) {
                continue;
            }
            $code .= is_array($token) ? $token[1] : $token;
        }

        return $code;
    }
}
