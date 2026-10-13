<?php

namespace davidhellmann\orrery\tests;

use CraftCms\Aliases\Aliases;
use CraftCms\Cms\FieldLayout\LayoutElements\Html;
use CraftCms\Cms\FieldLayout\LayoutElements\Missing;
use CraftCms\Cms\Support\Json;
use davidhellmann\orrery\services\ContentModel;
use Symfony\Component\Yaml\Yaml;

/**
 * The content model of the fixture project config in `fixtures/project.yaml`.
 */
class ContentModelTest extends TestCase
{
    /**
     * Environment variables the fixture refers to.
     */
    private const ENV = [
        'FIXTURE_MUSEUM_NAME' => 'Museum',
        'FIXTURE_PRIMARY_SITE_URL' => 'https://museum.test/',
        'FIXTURE_SHOP_LANGUAGE' => 'en-GB',
        'FIXTURE_SHOP_NAME' => 'Shop',
    ];

    private array $config;
    private array $data;

    protected function setUp(): void
    {
        parent::setUp();
        $_SERVER = self::ENV + $_SERVER;
        Aliases::set('@web', 'https://shop.museum.test');
        $this->config = Yaml::parseFile(__DIR__ . '/fixtures/project.yaml');
        $this->data = (new ContentModel())->fromConfig($this->config);
    }

    protected function tearDown(): void
    {
        $_SERVER = array_diff_key($_SERVER, self::ENV);
        parent::tearDown();
    }

    public function testUnrelatedConfigChangesLeaveTheDataAsItIs(): void
    {
        $config = $this->config;
        $config['dateModified'] = 1767312000;
        $config['system']['name'] = 'Museum (staging)';
        $config['plugins']['orrery']['settings']['pageHandlePrefix'] = 'page_';

        $this->assertSame($this->data, (new ContentModel())->fromConfig($config));
    }

    public function testDataForTheViewerSaysWhenTheConfigLastChanged(): void
    {
        $this->assertSame(1767225600, (new ContentModel())->fromConfig($this->config, forViewer: true)['dateModified']);
    }

    public function testSiteGroupsWithRawConfigValues(): void
    {
        $this->assertSame([
            ['uid' => 'group-museum', 'name' => '$FIXTURE_MUSEUM_NAME'],
            ['uid' => 'group-shop', 'name' => 'Shop'],
        ], $this->data['siteGroups']);
    }

    public function testSitesInTheirOrderWithRawConfigValues(): void
    {
        $this->assertSame([
            [
                'uid' => 'site-en',
                'name' => 'English',
                'handle' => 'en',
                'group' => 'group-museum',
                'baseUrl' => '$FIXTURE_PRIMARY_SITE_URL',
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
                'name' => '$FIXTURE_SHOP_NAME',
                'handle' => 'shop',
                'group' => 'group-shop',
                'baseUrl' => '@web/',
                'language' => '$FIXTURE_SHOP_LANGUAGE',
                'primary' => false,
                'sortOrder' => 3,
            ],
        ], $this->data['sites']);
    }

    public function testSiteGroupsAndSitesForTheViewerAreResolved(): void
    {
        $data = (new ContentModel())->fromConfig($this->config, forViewer: true);

        $this->assertSame(['Museum', 'Shop'], array_column($data['siteGroups'], 'name'));
        $this->assertSame([
            ['English', 'https://museum.test/', 'en-GB'],
            ['Deutsch', 'https://museum.test/de/', 'de-DE'],
            ['Shop', 'https://shop.museum.test/', 'en-GB'],
        ], array_map(fn(array $site) => [$site['name'], $site['baseUrl'], $site['language']], $data['sites']));
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
                        ['kind' => 'Title', 'width' => 100, 'label' => 'Headline', 'required' => true, 'conditional' => false],
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
            'typeClass' => 'CraftCms\Cms\Field\PlainText',
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
            'typeClass' => 'CraftCms\Cms\Field\Matrix',
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
            'typeClass' => 'CraftCms\Cms\Field\ContentBlock',
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
            'typeClass' => 'CraftCms\Cms\Field\Entries',
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

    public function testFieldTypeLabelsInEnglishWhateverTheAppLanguage(): void
    {
        app()->setLocale('de');
        $data = (new ContentModel())->fromConfig($this->config);

        $this->assertSame([
            'body' => 'Plain Text',
            'columns' => 'Matrix',
            'copyright' => 'Plain Text',
            'credits' => 'Credits',
            'curators' => 'Entries',
            'featured' => 'Entries',
            'gallery' => 'Gallery',
            'image' => 'Assets',
            'layoutStyle' => 'Dropdown',
            'notes' => 'Plain Text',
            'oldTeaser' => 'Plain Text',
            'pageBuilder' => 'Matrix',
            'photographer' => 'Plain Text',
            'relatedNews' => 'Entries',
            'seo' => 'Content Block',
            'summary' => 'Plain Text',
        ], array_column($data['fields'], 'typeLabel', 'handle'));
    }

    public function testFieldTypeLabelsForTheViewerInEnglishWhateverTheAppLanguage(): void
    {
        foreach (['de', 'fr'] as $language) {
            app()->setLocale($language);
            $labels = array_column((new ContentModel())->fromConfig($this->config, forViewer: true)['fields'], 'typeLabel', 'handle');

            $this->assertSame(['Plain Text', 'Entries', 'Content Block'], [$labels['body'], $labels['relatedNews'], $labels['seo']]);
            $this->assertSame($language, app()->getLocale());
        }
    }

    public function testGlobalSetWithItsTabs(): void
    {
        $this->assertSame([
            'uid' => 'global-footer',
            'name' => 'Footer',
            'handle' => 'footer',
            'tabs' => [
                [
                    'name' => 'Content',
                    'conditional' => false,
                    'elements' => [
                        ['kind' => 'CustomField', 'width' => 100, 'field' => 'field-copyright', 'label' => 'Copyright line', 'required' => false, 'conditional' => false],
                    ],
                ],
            ],
        ], $this->item('globalSets', 'global-footer'));
    }

    public function testGlobalSetWithoutFields(): void
    {
        $this->assertSame([], $this->item('globalSets', 'global-contact')['tabs']);
    }

    public function testVolumeWithItsTabs(): void
    {
        $this->assertSame([
            'uid' => 'volume-images',
            'name' => 'Images',
            'handle' => 'images',
            'tabs' => [
                [
                    'name' => 'Content',
                    'conditional' => false,
                    'elements' => [
                        ['kind' => 'Title', 'width' => 100, 'required' => true, 'conditional' => false],
                        ['kind' => 'AltField', 'width' => 100, 'required' => false, 'conditional' => false],
                        ['kind' => 'CustomField', 'width' => 100, 'field' => 'field-notes', 'label' => 'Caption', 'required' => false, 'conditional' => false],
                    ],
                ],
            ],
        ], $this->item('volumes', 'volume-images'));
    }

    public function testCategoryAndTagGroupsWithTheirTabs(): void
    {
        $topics = $this->item('categoryGroups', 'catgroup-topics');
        $this->assertSame(['Topics', 'topics'], [$topics['name'], $topics['handle']]);
        $this->assertSame([
            ['kind' => 'Title', 'width' => 100, 'required' => true, 'conditional' => false],
            ['kind' => 'CustomField', 'width' => 100, 'field' => 'field-notes', 'label' => 'Description', 'required' => false, 'conditional' => false],
        ], $topics['tabs'][0]['elements']);

        $keywords = $this->item('tagGroups', 'taggroup-keywords');
        $this->assertSame(['Keywords', 'keywords'], [$keywords['name'], $keywords['handle']]);
        $this->assertSame([
            ['kind' => 'Title', 'width' => 100, 'required' => true, 'conditional' => false],
            ['kind' => 'CustomField', 'width' => 100, 'field' => 'field-notes', 'required' => false, 'conditional' => false],
            ['kind' => 'TextField', 'width' => 50, 'required' => false, 'conditional' => false],
            ['kind' => 'TextareaField', 'width' => 50, 'label' => 'How to use it', 'required' => true, 'conditional' => false],
        ], $keywords['tabs'][0]['elements']);
    }

    /**
     * Users and addresses have one field layout each, with no name or UID of its own.
     */
    public function testFieldLayoutsOfUsersAndAddresses(): void
    {
        $this->assertSame([
            'tabs' => [
                [
                    'name' => 'Profile',
                    'conditional' => false,
                    'elements' => [
                        ['kind' => 'UsernameField', 'width' => 100, 'required' => false, 'conditional' => false],
                        ['kind' => 'FullNameField', 'width' => 100, 'required' => false, 'conditional' => false],
                        ['kind' => 'PhotoField', 'width' => 50, 'label' => 'Portrait', 'required' => false, 'conditional' => false],
                        ['kind' => 'EmailField', 'width' => 50, 'required' => true, 'conditional' => false],
                        ['kind' => 'AffiliatedSiteField', 'width' => 100, 'required' => false, 'conditional' => true],
                        ['kind' => 'Markdown', 'width' => 100],
                        ['kind' => 'LineBreak', 'width' => 100],
                        ['kind' => 'CustomField', 'width' => 100, 'field' => 'field-notes', 'label' => 'Bio', 'required' => false, 'conditional' => false],
                    ],
                ],
            ],
        ], $this->data['users']);
        $this->assertSame([
            ['kind' => 'Title', 'width' => 100, 'required' => false, 'conditional' => false],
            ['kind' => 'CountryCodeField', 'width' => 100, 'required' => false, 'conditional' => false],
            ['kind' => 'AddressField', 'width' => 100, 'required' => false, 'conditional' => false],
            ['kind' => 'FullNameField', 'width' => 100, 'required' => false, 'conditional' => false],
            ['kind' => 'OrganizationField', 'width' => 50, 'label' => 'Company', 'required' => false, 'conditional' => true],
            ['kind' => 'OrganizationTaxIdField', 'width' => 50, 'required' => false, 'conditional' => false],
            ['kind' => 'LatLongField', 'width' => 100, 'required' => false, 'conditional' => false],
            ['kind' => 'Template', 'width' => 100],
            ['kind' => 'CustomField', 'width' => 50, 'field' => 'field-notes', 'label' => 'Directions', 'required' => false, 'conditional' => false],
        ], $this->data['addresses']['tabs'][0]['elements']);
    }

    /**
     * Like a custom field, each of Craft's own fields can get a label, be required and show only under a condition.
     */
    public function testCraftsOwnFieldsCarryTheLabelRequiredAndConditionTheLayoutGivesThem(): void
    {
        $elements = array_column($this->data['users']['tabs'][0]['elements'], null, 'kind');

        $this->assertSame([
            ['Portrait', false, false],
            [null, true, false],
            [null, false, true],
        ], array_map(fn(array $el) => [$el['label'] ?? null, $el['required'], $el['conditional']], [$elements['PhotoField'], $elements['EmailField'], $elements['AffiliatedSiteField']]));
    }

    /**
     * The viewer names every element of a field layout, so the fixture holds every one Craft ships, but `Html` and
     * `Missing`: `Html` is only for code, and `Missing` stands in for an element whose class is gone. Craft stores
     * neither in a field layout.
     */
    public function testTheFixtureHoldsEveryLayoutElementCraftShips(): void
    {
        $dir = dirname(__DIR__) . '/vendor/craftcms/cms/src/FieldLayout/LayoutElements';
        $files = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($dir, \FilesystemIterator::SKIP_DOTS));
        $elements = [];
        foreach ($files as $file) {
            $class = 'CraftCms\\Cms\\FieldLayout\\LayoutElements\\' . str_replace(['/', '.php'], ['\\', ''], substr($file->getPathname(), strlen($dir) + 1));
            if (!(new \ReflectionClass($class))->isAbstract() && !in_array($class, [Html::class, Missing::class], true)) {
                $elements[] = $class;
            }
        }
        preg_match_all('/type: (CraftCms\\\\Cms\\\\FieldLayout\\\\LayoutElements\\\\\S+)/', file_get_contents(__DIR__ . '/fixtures/project.yaml'), $matches);

        $this->assertSame([], array_values(array_diff($elements, $matches[1])));
    }

    public function testUsersAndAddressesWithoutFieldLayouts(): void
    {
        $data = (new ContentModel())->fromConfig(['users' => ['allowPublicRegistration' => false]]);

        $this->assertSame(['tabs' => []], $data['users']);
        $this->assertSame(['tabs' => []], $data['addresses']);
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

    /**
     * Craft 5 stored permissions lowercased, Craft 6 stores them as Craft names them. Both read the same.
     */
    public function testUserGroupRightsAsCraft6StoresThem(): void
    {
        $data = (new ContentModel())->fromConfig([
            'sites' => ['site-en' => ['handle' => 'en'], 'site-de' => ['handle' => 'de']],
            'users' => [
                'groups' => [
                    'ug-editors' => ['handle' => 'editors', 'name' => 'Editors', 'permissions' => [
                        'accessCp',
                        'editSite:site-de',
                        'viewEntries:section-news',
                        'savePeerEntries:section-news',
                        'deletePeerEntryDrafts:section-news',
                    ]],
                ],
            ],
        ]);

        $this->assertSame(['site-de'], $data['userGroups'][0]['sites']);
        $this->assertSame(['section-news' => ['view', 'savePeer', 'deletePeerDrafts']], $data['userGroups'][0]['sections']);
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

    /**
     * Craft has no site permissions with one site, so the shared fixture with its three sites can't show this.
     */
    public function testOnASingleSiteOnlyGroupsWithControlPanelAccessEditIt(): void
    {
        $data = (new ContentModel())->fromConfig([
            'sites' => [
                'site-blog' => ['baseUrl' => 'https://blog.test/', 'handle' => 'blog', 'name' => 'Blog', 'primary' => true, 'sortOrder' => 1],
            ],
            'users' => [
                'groups' => [
                    'ug-authors' => ['handle' => 'authors', 'name' => 'Authors', 'permissions' => ['accesscp']],
                    'ug-readers' => ['handle' => 'readers', 'name' => 'Readers', 'permissions' => []],
                    // Left over from when there were more sites; Craft ignores it now.
                    'ug-translators' => ['handle' => 'translators', 'name' => 'Translators', 'permissions' => ['editsite:site-blog']],
                ],
            ],
        ]);

        $this->assertSame([
            'Authors' => ['site-blog'],
            'Readers' => [],
            'Translators' => [],
        ], array_column($data['userGroups'], 'sites', 'name'));
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
        $this->assertSame(['$FIXTURE_MUSEUM_NAME', 'Shop'], array_column($this->data['siteGroups'], 'name'));
        $this->assertSame(['en', 'de', 'shop'], array_column($this->data['sites'], 'handle'));
        $this->assertSame(['exhibitions', 'home', 'news', 'people', 'products'], array_column($this->data['sections'], 'handle'));
        $this->assertSame([
            'block_columns',
            'block_image',
            'block_teaser',
            'block_text',
            'exhibition',
            'oldPromo',
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
            'copyright',
            'credits',
            'curators',
            'featured',
            'gallery',
            'image',
            'layoutStyle',
            'notes',
            'oldTeaser',
            'pageBuilder',
            'photographer',
            'relatedNews',
            'seo',
            'summary',
        ], array_column($this->data['fields'], 'handle'));
        $this->assertSame(['contact', 'footer'], array_column($this->data['globalSets'], 'handle'));
        $this->assertSame(['Editors', 'Members', 'Shop staff'], array_column($this->data['userGroups'], 'name'));
        $this->assertSame(['App', 'Public Schema'], array_column($this->data['gqlSchemas'], 'name'));
    }

    /**
     * The viewer tests run on the data of this fixture, so it's kept as the viewer gets it. After a change to the
     * fixture or the data, `UPDATE_FIXTURES=1 composer test` writes it again.
     */
    public function testViewerFixtureIsTheDataOfTheProjectFixture(): void
    {
        $file = __DIR__ . '/fixtures/content-model.json';
        $data = (new ContentModel())->fromConfig($this->config, forViewer: true);
        $json = Json::encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n";
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
