<?php

namespace davidhellmann\orrery\services;

use Craft;
use craft\base\FieldInterface;
use craft\fieldlayoutelements\CustomField;
use craft\fieldlayoutelements\Heading;
use craft\fieldlayoutelements\Tip;
use craft\fieldlayoutelements\TitleField;
use craft\fields\BaseOptionsField;
use craft\fields\BaseRelationField;
use craft\fields\ContentBlock;
use craft\fields\Entries;
use craft\fields\Matrix;
use craft\helpers\App;
use craft\helpers\ProjectConfig as ProjectConfigHelper;
use yii\base\Component;

/**
 * Reads the project config into the plain data the viewer renders.
 */
class ContentModel extends Component
{
    /**
     * User permissions that concern entries, keyed by how they're stored in the project config.
     */
    private const ENTRY_PERMISSIONS = [
        'viewentries' => 'view',
        'createentries' => 'create',
        'saveentries' => 'save',
        'deleteentries' => 'delete',
        'deleteentriesforsite' => 'delete',
        'viewpeerentries' => 'viewPeer',
        'savepeerentries' => 'savePeer',
        'deletepeerentries' => 'deletePeer',
        'deletepeerentriesforsite' => 'deletePeer',
        'viewpeerentrydrafts' => 'viewPeerDrafts',
        'savepeerentrydrafts' => 'savePeerDrafts',
        'deletepeerentrydrafts' => 'deletePeerDrafts',
    ];

    private const SCHEMA_ACTIONS = ['read', 'create', 'save', 'delete'];

    public function getData(): array
    {
        return $this->fromConfig(Craft::$app->getProjectConfig()->get());
    }

    /**
     * The content model of a project config, given as `ProjectConfig::get()` returns it.
     */
    public function fromConfig(array $config): array
    {
        $config = ProjectConfigHelper::unpackAssociativeArrays($config);

        return [
            'dateModified' => $config['dateModified'] ?? null,
            'siteGroups' => $this->siteGroups($config['siteGroups'] ?? []),
            'sites' => $this->sites($config['sites'] ?? []),
            'sections' => $this->sections($config['sections'] ?? []),
            'entryTypes' => $this->entryTypes($config['entryTypes'] ?? []),
            'fields' => $this->fields($config['fields'] ?? []),
            'userGroups' => $this->userGroups($config['users']['groups'] ?? [], array_keys($config['sites'] ?? [])),
            'gqlSchemas' => $this->gqlSchemas($config['graphql']['schemas'] ?? []),
        ];
    }

    /**
     * Each group with the sites it may edit and what it may do with the entries of each section.
     */
    private function userGroups(array $groups, array $siteUids): array
    {
        $order = array_values(array_unique(self::ENTRY_PERMISSIONS));
        $data = [];
        foreach ($groups as $uid => $group) {
            // Single-site installs have no site permissions: every group with control panel access edits the site.
            $sites = count($siteUids) > 1 ? [] : $siteUids;
            $sections = [];
            foreach ($group['permissions'] ?? [] as $permission) {
                [$name, $target] = array_pad(explode(':', $permission, 2), 2, null);
                if ($name === 'editsite' && $target) {
                    $sites[] = $target;
                } elseif ($target && isset(self::ENTRY_PERMISSIONS[$name])) {
                    $sections[$target][] = self::ENTRY_PERMISSIONS[$name];
                }
            }

            $data[] = $this->withoutNulls([
                'uid' => $uid,
                'name' => $group['name'] ?? '',
                'handle' => $group['handle'] ?? '',
                'description' => $this->filled($group, 'description'),
                'sites' => array_values(array_unique($sites)),
                'sections' => array_map(fn(array $rights) => array_values(array_intersect($order, $rights)), $sections),
            ]);
        }

        return $this->sortBy($data, 'name');
    }

    /**
     * Each schema with the sites, sections and nested entry fields it may query or change.
     */
    private function gqlSchemas(array $schemas): array
    {
        $data = [];
        foreach ($schemas as $uid => $schema) {
            $sites = $sections = $fields = $elements = [];
            foreach ($schema['scope'] ?? [] as $scope) {
                [$target, $action] = array_pad(explode(':', $scope, 2), 2, null);
                [$type, $targetUid] = array_pad(explode('.', $target, 2), 2, null);
                if ($type === 'sites' && $action === 'read') {
                    $sites[] = $targetUid;
                } elseif ($type === 'sections' && in_array($action, self::SCHEMA_ACTIONS, true)) {
                    $sections[$targetUid][] = $action;
                } elseif ($type === 'nestedentryfields' && in_array($action, self::SCHEMA_ACTIONS, true)) {
                    $fields[$targetUid][] = $action;
                } elseif ($type === 'elements' && $action === 'read') {
                    $elements[] = $targetUid;
                }
            }

            $order = fn(array $actions) => array_values(array_intersect(self::SCHEMA_ACTIONS, $actions));
            $data[] = [
                'uid' => $uid,
                'name' => $schema['name'] ?? '',
                'public' => (bool)($schema['isPublic'] ?? false),
                'sites' => $sites,
                'sections' => array_map($order, $sections),
                'fields' => array_map($order, $fields),
                'elements' => $elements,
            ];
        }

        return $this->sortBy($data, 'name');
    }

    private function siteGroups(array $siteGroups): array
    {
        $data = [];
        foreach ($siteGroups as $uid => $group) {
            $data[] = [
                'uid' => $uid,
                'name' => App::parseEnv($group['name'] ?? ''),
            ];
        }

        return $this->sortBy($data, 'name');
    }

    private function sites(array $sites): array
    {
        $data = [];
        foreach ($sites as $uid => $site) {
            $data[] = [
                'uid' => $uid,
                'name' => App::parseEnv($site['name'] ?? ''),
                'handle' => $site['handle'] ?? '',
                'group' => $site['siteGroup'] ?? null,
                'baseUrl' => App::parseEnv($site['baseUrl'] ?? null),
                'language' => App::parseEnv($site['language'] ?? ''),
                'primary' => (bool)($site['primary'] ?? false),
                'sortOrder' => (int)($site['sortOrder'] ?? 0),
            ];
        }

        usort($data, fn(array $a, array $b) => $a['sortOrder'] <=> $b['sortOrder']);

        return $data;
    }

    private function sections(array $sections): array
    {
        $data = [];
        foreach ($sections as $uid => $section) {
            $entryTypes = $this->entryTypeUsages($section['entryTypes'] ?? []);
            $sites = [];
            foreach ($section['siteSettings'] ?? [] as $siteUid => $settings) {
                $sites[] = [
                    'site' => $siteUid,
                    'hasUrls' => (bool)($settings['hasUrls'] ?? false),
                    'uriFormat' => $this->filled($settings, 'uriFormat'),
                ];
            }

            $data[] = [
                'uid' => $uid,
                'name' => $section['name'] ?? '',
                'handle' => $section['handle'] ?? '',
                'type' => $section['type'] ?? '',
                'entryTypes' => array_column($entryTypes, 'uid'),
                'contexts' => array_column($entryTypes, 'name', 'uid'),
                'sites' => $sites,
                'previewTargets' => array_column($section['previewTargets'] ?? [], 'label'),
            ];
        }

        return $this->sortBy($data, 'handle');
    }

    private function entryTypes(array $entryTypes): array
    {
        $data = [];
        foreach ($entryTypes as $uid => $entryType) {
            $data[] = $this->withoutNulls([
                'uid' => $uid,
                'name' => $entryType['name'] ?? '',
                'handle' => $entryType['handle'] ?? '',
                'icon' => $this->filled($entryType, 'icon'),
                'hasTitleField' => ($entryType['hasTitleField'] ?? true) !== false,
                'tabs' => $this->tabs($entryType['fieldLayouts'] ?? []),
            ]);
        }

        return $this->sortBy($data, 'handle');
    }

    private function fields(array $fields): array
    {
        $data = [];
        foreach ($fields as $uid => $field) {
            $type = $field['type'] ?? '';
            $settings = $field['settings'] ?? [];
            $item = [
                'uid' => $uid,
                'name' => $field['name'] ?? '',
                'handle' => $field['handle'] ?? '',
                'type' => $this->shortName($type),
                'typeClass' => $type,
                'typeLabel' => $this->typeLabel($type),
                'role' => $this->role($type),
                'instructions' => $this->filled($field, 'instructions'),
            ];

            if (is_a($type, Matrix::class, true)) {
                $item['blocks'] = array_map(fn(array $usage) => $this->withoutNulls([
                    'entryType' => $usage['uid'],
                    'context' => $usage['name'] ?? null,
                    'group' => $usage['group'] ?? null,
                ]), $this->entryTypeUsages($settings['entryTypes'] ?? []));
                $item['viewMode'] = $settings['viewMode'] ?? null;
                $item['min'] = $settings['minEntries'] ?? null;
                $item['max'] = $settings['maxEntries'] ?? null;
            } elseif (is_a($type, ContentBlock::class, true)) {
                $item['tabs'] = $this->tabs($settings['fieldLayouts'] ?? []);
            } elseif (is_a($type, BaseOptionsField::class, true)) {
                $item['options'] = $this->options($settings['options'] ?? []);
            } elseif (is_a($type, BaseRelationField::class, true)) {
                $item['sources'] = (array)($settings['sources'] ?? '*');
                $item['max'] = $settings['maxRelations'] ?? null;
            } elseif (isset($settings['maxLinks'])) {
                $item['max'] = $settings['maxLinks'];
            }

            $data[] = $this->withoutNulls($item);
        }

        return $this->sortBy($data, 'handle');
    }

    /**
     * Sections and Matrix fields list their entry types as UIDs, or as configs with per-use overrides.
     */
    private function entryTypeUsages(array $usages): array
    {
        return array_map(fn($usage) => is_array($usage) ? $usage : ['uid' => $usage], $usages);
    }

    private function tabs(array $fieldLayouts): array
    {
        $tabs = [];
        foreach ($fieldLayouts as $layout) {
            foreach ($layout['tabs'] ?? [] as $tab) {
                $tabs[] = [
                    'name' => $tab['name'] ?? '',
                    'conditional' => $this->isConditional($tab),
                    'elements' => array_map(fn(array $element) => $this->element($element), $tab['elements'] ?? []),
                ];
            }
        }

        return $tabs;
    }

    private function element(array $element): array
    {
        $type = $element['type'] ?? '';
        $base = [
            'kind' => $this->shortName($type),
            'width' => (int)($element['width'] ?? 100),
        ];

        if (is_a($type, CustomField::class, true)) {
            return $this->withoutNulls([
                ...$base,
                'kind' => 'CustomField',
                'field' => $element['fieldUid'] ?? null,
                'handle' => $this->filled($element, 'handle'),
                'label' => $this->filled($element, 'label'),
                'instructions' => $this->filled($element, 'instructions'),
                'required' => (bool)($element['required'] ?? false),
                'conditional' => $this->isConditional($element),
            ]);
        }

        if (is_a($type, TitleField::class, true)) {
            return $this->withoutNulls([
                ...$base,
                'kind' => 'Title',
                'label' => $this->filled($element, 'label'),
                'required' => ($element['required'] ?? true) !== false,
            ]);
        }

        return match (true) {
            is_a($type, Heading::class, true) => [...$base, 'kind' => 'Heading', 'text' => $element['heading'] ?? ''],
            is_a($type, Tip::class, true) => [...$base, 'kind' => 'Tip', 'text' => $element['tip'] ?? '', 'style' => $element['style'] ?? 'tip'],
            default => $base,
        };
    }

    private function options(array $options): array
    {
        $data = [];
        foreach ($options as $option) {
            if (isset($option['value'])) {
                $data[] = [
                    'label' => $option['label'] ?? $option['value'],
                    'value' => $option['value'],
                    'default' => !empty($option['default']),
                ];
            }
        }

        return $data;
    }

    /**
     * What a field is to the viewer: a Builder holds Blocks or fields of its own, a relation pulls in entries.
     * Field types built on Matrix, ContentBlock or Entries count as those.
     */
    private function role(string $type): string
    {
        return match (true) {
            is_a($type, Matrix::class, true), is_a($type, ContentBlock::class, true) => 'builder',
            is_a($type, Entries::class, true) => 'relation',
            default => 'field',
        };
    }

    private function typeLabel(string $type): string
    {
        return is_subclass_of($type, FieldInterface::class) ? $type::displayName() : $this->shortName($type);
    }

    private function shortName(string $class): string
    {
        return basename(str_replace('\\', '/', $class));
    }

    private function isConditional(array $config): bool
    {
        return !empty($config['elementCondition']) || !empty($config['userCondition']);
    }

    private function filled(array $config, string $key): mixed
    {
        return ($config[$key] ?? null) ?: null;
    }

    private function withoutNulls(array $data): array
    {
        return array_filter($data, fn($value) => $value !== null);
    }

    private function sortBy(array $items, string $key): array
    {
        usort($items, fn(array $a, array $b) => strnatcasecmp((string)$a[$key], (string)$b[$key]));

        return $items;
    }
}
