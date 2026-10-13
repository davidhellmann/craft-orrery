<?php

namespace davidhellmann\orrery;

use CraftCms\Cms\Form\Controls\Text;
use CraftCms\Cms\Form\Enums\ControlMode;
use CraftCms\Cms\Form\Form;
use CraftCms\Cms\Form\FormContext;
use CraftCms\Cms\Form\Nodes\Field;
use CraftCms\Cms\Form\Nodes\MarkdownContent;
use CraftCms\Cms\Plugin\Plugin as BasePlugin;
use CraftCms\Cms\ProjectConfig\ProjectConfig;
use davidhellmann\orrery\console\ExportCommand;
use davidhellmann\orrery\models\Settings;

use function CraftCms\Cms\t;

/**
 * Orrery plugin
 *
 * @method Settings getSettings()
 * @author David Hellmann <david@hellmann.io>
 * @copyright David Hellmann
 * @license MIT
 */
class Plugin extends BasePlugin
{
    public string $schemaVersion = '1.0.0';
    public bool $hasCpSection = true;
    public bool $hasCpSettings = true;

    protected array $commands = [
        ExportCommand::class,
    ];

    protected static function createSettings(): Settings
    {
        return new Settings();
    }

    public function settingsForm(FormContext $context = new FormContext()): Form
    {
        return Form::make([
            MarkdownContent::make('orrery-intro', t('If your entry type handles follow a naming convention, Orrery can point out the ones that don’t. They get flagged in the viewer; nothing in your project is renamed or changed.', category: 'orrery'))
                ->displayInPane(false),
            $this->prefixField(
                'pageHandlePrefix',
                t('Page handle prefix', category: 'orrery'),
                t('Expected at the start of every handle of an entry type used in a section, like `page_article`. Leave blank to skip the check. For more than one prefix, set an array in `config/craft/orrery.php`.', category: 'orrery'),
                t('e.g. page_', category: 'orrery'),
            ),
            $this->prefixField(
                'blockHandlePrefix',
                t('Block handle prefix', category: 'orrery'),
                t('Expected at the start of every handle of an entry type used in a Matrix field, like `block_hero`. Leave blank to skip the check. For more than one prefix, set an array in `config/craft/orrery.php`.', category: 'orrery'),
                t('e.g. block_', category: 'orrery'),
            ),
        ]);
    }

    /**
     * Craft saves every setting the model holds, and for a setting `config/craft/orrery.php` overrides, that's the
     * file's value. The project config keeps what it stored for it instead.
     */
    public function beforeSaveSettings(): bool
    {
        $stored = app(ProjectConfig::class)->get(ProjectConfig::PATH_PLUGINS . ".$this->handle.settings") ?? [];
        $this->getSettings()->setAttributes($this->getSettings()->storedOverrides($this->fileConfig(), $stored));

        return true;
    }

    /**
     * A setting in `config/craft/orrery.php` wins over the form, so it shows there read-only, with the file's value.
     */
    private function prefixField(string $attribute, string $label, string $instructions, string $placeholder): Field
    {
        $control = Text::make($attribute)->placeholder($placeholder)->monospace();
        $field = Field::make($label, $control)->instructions($instructions);

        $fileConfig = $this->fileConfig();
        if (array_key_exists($attribute, $fileConfig)) {
            $control->value(implode(', ', (array)$fileConfig[$attribute]))->mode(ControlMode::Disabled);
            $field->warning(t('Set in `config/craft/orrery.php`, which wins over this setting.', category: 'orrery'));
        }

        return $field;
    }

    /**
     * The settings `config/craft/orrery.php` sets.
     */
    private function fileConfig(): array
    {
        $config = config("craft.$this->handle");

        return is_array($config) ? $config : [];
    }
}
