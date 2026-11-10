<?php

namespace davidhellmann\orrery\tests;

use CraftCms\Cms\Edition;
use CraftCms\Cms\Support\Facades\Elements;
use CraftCms\Cms\Support\Facades\UserPermissions;
use CraftCms\Cms\User\Elements\User as UserElement;
use CraftCms\Cms\User\Models\User;
use Inertia\Testing\AssertableInertia;

use function CraftCms\Cms\cp_url;

/**
 * The control panel section and the viewer page it embeds are for users who may use the control panel and
 * *Access Orrery*. Craft checks the first for a plugin's control panel routes, and Orrery's routes check the second.
 */
class CpRoutesTest extends TestCase
{
    private const PATHS = ['orrery', 'orrery/app'];

    public function testGuestsAreSentToLogIn(): void
    {
        foreach (self::PATHS as $path) {
            $this->get(cp_url($path))->assertRedirect();
        }
    }

    public function testUsersWithoutAccessOrreryAreTurnedAway(): void
    {
        $this->actingAs($this->user(['accessCp']));

        foreach (self::PATHS as $path) {
            $this->get(cp_url($path))->assertForbidden();
        }
    }

    public function testUsersWithAccessOrrerySeeTheSectionAndTheViewer(): void
    {
        $this->actingAs($this->user(['accessCp', 'accessPlugin-orrery']));

        // Craft draws a Twig control panel page inside its own shell, and hands it the page's content as a prop.
        $section = AssertableInertia::fromTestResponse($this->get(cp_url('orrery'))->assertOk());
        $section->where('content', fn(string $content) => str_contains($content, 'id="orrery-frame"'));
        $this->get(cp_url('orrery/app'))
            ->assertOk()
            ->assertHeader('Content-Type', 'text/html; charset=UTF-8')
            ->assertSee('window.CONTENT_MODEL = {', escape: false);
    }

    public function testTheViewerDownloadsAsAFileNamedAfterTheSystem(): void
    {
        // The admin Craft's install creates.
        $this->actingAs(User::firstOrFail());

        $this->get(cp_url('orrery/app', ['download' => 1]))
            ->assertOk()
            ->assertDownload('craft-test-site-content-model.html');
    }

    /**
     * A user who isn't an admin, with just these permissions.
     *
     * @param string[] $permissions
     */
    private function user(array $permissions): User
    {
        Edition::set(Edition::Pro);
        $element = new UserElement(['username' => 'editor', 'email' => 'editor@museum.test', 'active' => true]);
        $this->assertTrue(Elements::saveElement($element));
        UserPermissions::saveUserPermissions($element->id, $permissions);

        return User::findOrFail($element->id);
    }
}
