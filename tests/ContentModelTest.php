<?php

namespace davidhellmann\orrery\tests;

use craft\helpers\Json;
use davidhellmann\orrery\services\ContentModel;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Yaml\Yaml;

/**
 * The content model of the fixture project config in `fixtures/project.yaml`.
 */
class ContentModelTest extends TestCase
{
    private array $data;

    protected function setUp(): void
    {
        $_SERVER['FIXTURE_PRIMARY_SITE_URL'] = 'https://museum.test/';
        $this->data = (new ContentModel())->fromConfig(Yaml::parseFile(__DIR__ . '/fixtures/project.yaml'));
    }

    protected function tearDown(): void
    {
        unset($_SERVER['FIXTURE_PRIMARY_SITE_URL']);
    }

    public function testSiteGroups(): void
    {
        $this->assertSame([
            ['uid' => 'group-museum', 'name' => 'Museum'],
            ['uid' => 'group-shop', 'name' => 'Shop'],
        ], $this->data['siteGroups']);
    }

    public function testSitesInTheirOrderWithEnvironmentValuesResolved(): void
    {
        $this->assertSame([
            [
                'uid' => 'site-en',
                'name' => 'English',
                'handle' => 'en',
                'group' => 'group-museum',
                'baseUrl' => 'https://museum.test/',
                'language' => 'en-GB',
                'primary' => true,
                'sortOrder' => 1,
            ],
            [
                'uid' => 'site-de',
                'name' => 'Deutsch',
                'handle' => 'de',
                'group' => 'group-museum',
                'baseUrl' => 'https://museum.test/de/',
                'language' => 'de-DE',
                'primary' => false,
                'sortOrder' => 2,
            ],
            [
                'uid' => 'site-shop',
                'name' => 'Shop',
                'handle' => 'shop',
                'group' => 'group-shop',
                'baseUrl' => 'https://shop.museum.test/',
                'language' => 'en-GB',
                'primary' => false,
                'sortOrder' => 3,
            ],
        ], $this->data['sites']);
    }

    public function testSectionWithItsOwnNameForAnEntryType(): void
    {
        $this->assertSame([
            'uid' => 'section-news',
            'name' => 'News',
            'handle' => 'news',
            'type' => 'channel',
            'entryTypes' => ['et-article', 'et-link'],
            'contexts' => ['et-article' => 'News article'],
            'sites' => [
                ['site' => 'site-en', 'hasUrls' => true, 'uriFormat' => 'news/{slug}'],
                ['site' => 'site-de', 'hasUrls' => true, 'uriFormat' => 'aktuelles/{slug}'],
            ],
            'previewTargets' => ['Primary entry page'],
        ], $this->item('sections', 'section-news'));
    }

    public function testSectionListingEntryTypesAsUids(): void
    {
        $section = $this->item('sections', 'section-exhibitions');

        $this->assertSame(['et-exhibition', 'et-article'], $section['entryTypes']);
        $this->assertSame([], $section['contexts']);
    }

    public function testSectionWithoutUrls(): void
    {
        $this->assertSame([
            ['site' => 'site-en', 'hasUrls' => false, 'uriFormat' => null],
        ], $this->item('sections', 'section-people')['sites']);
    }

    public function testEntryTypeWithItsTabsAndWhatTheyHold(): void
    {
        $this->assertSame([
            'uid' => 'et-article',
            'name' => 'Article',
            'handle' => 'page_article',
            'icon' => 'newspaper',
            'hasTitleField' => true,
            'tabs' => [
                [
                    'name' => 'Content',
                    'conditional' => false,
                    'elements' => [
                        ['kind' => 'Title', 'width' => 100, 'label' => 'Headline', 'required' => true],
                        [
                            'kind' => 'CustomField',
                            'width' => 50,
                            'field' => 'field-body',
                            'handle' => 'intro',
                            'label' => 'Introduction',
                            'instructions' => 'Two sentences at most.',
                            'required' => true,
                            'conditional' => false,
                        ],
                        ['kind' => 'Heading', 'width' => 100, 'text' => 'Story'],
                        ['kind' => 'CustomField', 'width' => 100, 'field' => 'field-page-builder', 'required' => false, 'conditional' => false],
                    ],
                ],
                [
                    'name' => 'SEO',
                    'conditional' => true,
                    'elements' => [
                        ['kind' => 'Tip', 'width' => 100, 'text' => 'Search engines show the summary under the title.', 'style' => 'warning'],
                        ['kind' => 'CustomField', 'width' => 100, 'field' => 'field-seo', 'required' => false, 'conditional' => false],
                        ['kind' => 'HorizontalRule', 'width' => 100],
                    ],
                ],
            ],
        ], $this->item('entryTypes', 'et-article'));
    }

    public function testConditionalField(): void
    {
        $this->assertSame([
            'kind' => 'CustomField',
            'width' => 100,
            'field' => 'field-body',
            'label' => 'Description',
            'required' => false,
            'conditional' => true,
        ], $this->item('entryTypes', 'et-exhibition')['tabs'][0]['elements'][2]);
    }

    public function testEntryTypeWithoutTitleField(): void
    {
        $entryType = $this->item('entryTypes', 'et-text');

        $this->assertFalse($entryType['hasTitleField']);
        $this->assertSame(['CustomField', 'CustomField'], array_column($entryType['tabs'][0]['elements'], 'kind'));
    }

    public function testPlainField(): void
    {
        $this->assertSame([
            'uid' => 'field-body',
            'name' => 'Body',
            'handle' => 'body',
            'type' => 'PlainText',
            'typeClass' => 'craft\fields\PlainText',
            'typeLabel' => 'Plain Text',
            'role' => 'field',
            'instructions' => 'Plain text, no formatting.',
        ], $this->item('fields', 'field-body'));
    }

    public function testMatrixFieldWithGroupedBlocks(): void
    {
        $this->assertSame([
            'uid' => 'field-page-builder',
            'name' => 'Page builder',
            'handle' => 'pageBuilder',
            'type' => 'Matrix',
            'typeClass' => 'craft\fields\Matrix',
            'typeLabel' => 'Matrix',
            'role' => 'builder',
            'blocks' => [
                ['entryType' => 'et-text', 'group' => 'Text'],
                ['entryType' => 'et-quote', 'context' => 'Pull quote', 'group' => 'Text'],
                ['entryType' => 'et-image', 'group' => 'Media'],
                ['entryType' => 'et-link', 'group' => 'Media'],
                ['entryType' => 'et-teaser'],
                ['entryType' => 'et-columns', 'group' => 'Layout'],
            ],
            'viewMode' => 'blocks',
            'min' => 1,
            'max' => 20,
        ], $this->item('fields', 'field-page-builder'));
    }

    public function testContentBlockFieldWithItsTabs(): void
    {
        $this->assertSame([
            'uid' => 'field-seo',
            'name' => 'SEO',
            'handle' => 'seo',
            'type' => 'ContentBlock',
            'typeClass' => 'craft\fields\ContentBlock',
            'typeLabel' => 'Content Block',
            'role' => 'builder',
            'tabs' => [
                [
                    'name' => 'Content',
                    'conditional' => false,
                    'elements' => [
                        ['kind' => 'CustomField', 'width' => 100, 'field' => 'field-summary', 'label' => 'Meta description', 'required' => true, 'conditional' => false],
                        ['kind' => 'CustomField', 'width' => 50, 'field' => 'field-image', 'handle' => 'shareImage', 'label' => 'Share image', 'required' => false, 'conditional' => false],
                    ],
                ],
            ],
        ], $this->item('fields', 'field-seo'));
    }

    public function testOptionsFieldWithoutItsOptionGroups(): void
    {
        $this->assertSame([
            ['label' => 'Wide', 'value' => 'wide', 'default' => true],
            ['label' => 'Narrow', 'value' => 'narrow', 'default' => false],
        ], $this->item('fields', 'field-layout-style')['options']);
    }

    public function testEntriesFieldPullingFromASection(): void
    {
        $this->assertSame([
            'uid' => 'field-related-news',
            'name' => 'Related news',
            'handle' => 'relatedNews',
            'type' => 'Entries',
            'typeClass' => 'craft\fields\Entries',
            'typeLabel' => 'Entries',
            'role' => 'relation',
            'sources' => ['section:section-news'],
            'max' => 3,
        ], $this->item('fields', 'field-related-news'));
    }

    public function testRelationFieldSources(): void
    {
        $this->assertSame(['*'], $this->item('fields', 'field-featured')['sources']);
        $this->assertSame(['section:section-people', 'section:section-archive'], $this->item('fields', 'field-curators')['sources']);
        $this->assertArrayNotHasKey('max', $this->item('fields', 'field-curators'));
        $this->assertSame(['volume:volume-images'], $this->item('fields', 'field-image')['sources']);
    }

    public function testEachFieldSaysWhetherItIsABuilderOrARelationToEntries(): void
    {
        $roles = array_column($this->data['fields'], 'role', 'handle');

        $this->assertSame('builder', $roles['pageBuilder']);
        $this->assertSame('builder', $roles['seo']);
        $this->assertSame('relation', $roles['relatedNews']);
        $this->assertSame('relation', $roles['featured']);
        $this->assertSame('field', $roles['image'], 'Assets relate to assets, not to entries.');
        $this->assertSame('field', $roles['layoutStyle']);
        $this->assertSame('field', $roles['body']);
    }

    public function testFieldTypesBuiltOnMatrixOrContentBlockAreBuilders(): void
    {
        $gallery = $this->item('fields', 'field-gallery');
        $this->assertSame('builder', $gallery['role']);
        $this->assertSame([['entryType' => 'et-image']], $gallery['blocks']);

        $credits = $this->item('fields', 'field-credits');
        $this->assertSame('builder', $credits['role']);
        $this->assertSame(['field-photographer'], array_column($credits['tabs'][0]['elements'], 'field'));
    }

    public function testUserGroupRightsOnSitesAndSections(): void
    {
        $this->assertSame([
            'uid' => 'ug-editors',
            'name' => 'Editors',
            'handle' => 'editors',
            'description' => 'Look after the museum sites.',
            'sites' => ['site-de', 'site-en'],
            'sections' => [
                'section-exhibitions' => ['view', 'create', 'save'],
                'section-news' => ['view', 'create', 'save', 'delete', 'viewPeer', 'savePeer', 'viewPeerDrafts', 'deletePeerDrafts'],
                'section-home' => ['view', 'save'],
            ],
        ], $this->item('userGroups', 'ug-editors'));
    }

    public function testUserGroupWithoutRights(): void
    {
        $this->assertSame([
            'uid' => 'ug-members',
            'name' => 'Members',
            'handle' => 'members',
            'description' => 'Signed-up visitors, without control panel access.',
            'sites' => [],
            'sections' => [],
        ], $this->item('userGroups', 'ug-members'));
    }

    public function testSchemaScopes(): void
    {
        $this->assertSame([
            'uid' => 'gql-app',
            'name' => 'App',
            'public' => false,
            'sites' => ['site-shop'],
            'sections' => ['section-products' => ['read', 'create', 'save', 'delete']],
            'fields' => ['field-columns' => ['read'], 'field-page-builder' => ['read', 'save']],
            'elements' => ['drafts', 'revisions'],
        ], $this->item('gqlSchemas', 'gql-app'));
    }

    public function testPublicSchema(): void
    {
        $this->assertSame([
            'uid' => 'gql-public',
            'name' => 'Public Schema',
            'public' => true,
            'sites' => ['site-de', 'site-en'],
            'sections' => ['section-home' => ['read'], 'section-news' => ['read']],
            'fields' => ['field-page-builder' => ['read']],
            'elements' => ['inactive'],
        ], $this->item('gqlSchemas', 'gql-public'));
    }

    public function testEachKindIsSorted(): void
    {
        $this->assertSame(['Museum', 'Shop'], array_column($this->data['siteGroups'], 'name'));
        $this->assertSame(['en', 'de', 'shop'], array_column($this->data['sites'], 'handle'));
        $this->assertSame(['exhibitions', 'home', 'news', 'people', 'products'], array_column($this->data['sections'], 'handle'));
        $this->assertSame([
            'block_columns',
            'block_image',
            'block_teaser',
            'block_text',
            'exhibition',
            'page_article',
            'page_link',
            'page_person',
            'page_product',
            'quote',
            'single_home',
        ], array_column($this->data['entryTypes'], 'handle'));
        $this->assertSame([
            'body',
            'columns',
            'credits',
            'curators',
            'featured',
            'gallery',
            'image',
            'layoutStyle',
            'oldTeaser',
            'pageBuilder',
            'photographer',
            'relatedNews',
            'seo',
            'summary',
        ], array_column($this->data['fields'], 'handle'));
        $this->assertSame(['Editors', 'Members', 'Shop staff'], array_column($this->data['userGroups'], 'name'));
        $this->assertSame(['App', 'Public Schema'], array_column($this->data['gqlSchemas'], 'name'));
    }

    /**
     * The viewer tests run on the data of this fixture, so it's kept as the JSON export would write it. After a change
     * to the fixture or the data, `UPDATE_FIXTURES=1 composer test` writes it again.
     */
    public function testViewerFixtureIsTheDataOfTheProjectFixture(): void
    {
        $file = __DIR__ . '/fixtures/content-model.json';
        $json = Json::encode($this->data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n";
        if (getenv('UPDATE_FIXTURES')) {
            file_put_contents($file, $json);
        }

        $this->assertStringEqualsFile($file, $json, 'The viewer fixture is out of date. Run `UPDATE_FIXTURES=1 composer test`.');
    }

    private function item(string $kind, string $uid): array
    {
        $items = array_values(array_filter($this->data[$kind], fn(array $item) => $item['uid'] === $uid));
        $this->assertCount(1, $items, "No $kind item $uid");

        return $items[0];
    }
}
