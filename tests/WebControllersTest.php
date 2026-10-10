<?php

namespace davidhellmann\orrery\tests;

use craft\web\Controller;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;

/**
 * Craft checks a plugin's permission for its control panel templates, but not for its controller actions, which anyone
 * logged in could reach through `actions/…` or `?action=`. So every web controller of the plugin turns other requests
 * away itself, before any action runs: in its own `beforeAction()`, after Craft's checks, it requires a control panel
 * request and *Access Orrery*. A running Craft would be needed to send it requests, so this test reads the code.
 */
class WebControllersTest extends TestCase
{
    private const CHECKS = [
        'parent::beforeAction(',
        '$this->requireCpRequest()',
        "\$this->requirePermission('accessPlugin-orrery')",
    ];

    /**
     * @return array<string, array{class-string}>
     */
    public static function webControllers(): array
    {
        $controllers = [];
        foreach (glob(dirname(__DIR__) . '/src/controllers/*.php') ?: [] as $file) {
            $class = 'davidhellmann\\orrery\\controllers\\' . basename($file, '.php');
            if (is_subclass_of($class, Controller::class)) {
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
        $at = -1;
        foreach (self::CHECKS as $check) {
            $found = strpos($code, $check);
            $this->assertNotFalse($found, "$class::beforeAction() lacks `$check`. Its checks: " . implode(', then ', self::CHECKS) . '.');
            $this->assertGreaterThan($at, $found, "$class::beforeAction() runs `$check` too early. Its checks: " . implode(', then ', self::CHECKS) . '.');
            $at = $found;
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
