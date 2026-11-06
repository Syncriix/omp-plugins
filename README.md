<div align="center">

# Syncriix · OMP Plugins

**Focused plugins for Oh My Pi.**

Make the tools you use every day work a little more like you do.

[Quick start](#quick-start) · [Plugin catalog](#plugin-catalog) · [Credits](#credits-and-license)

</div>

## Quick start

With [Oh My Pi](https://github.com/can1357/oh-my-pi) installed, add this marketplace and install its first plugin:

```sh
omp plugin marketplace add Syncriix/omp-plugins
omp plugin install model-prompt@syncriix
```

**Restart OMP** to load the extension module. `/reload-plugins` does not reload extension modules.

Then, inside OMP:

```text
/model-prompt
```

Search saved model prompts, preview a selection, and press **Enter** to edit it. The active model is included even without a saved prompt, and browsing does not switch models. Saved instructions are added to OMP's system prompt—not substituted for it—on your next prompt to that model.

## Plugin catalog

| Plugin | What it does | Version |
| --- | --- | --- |
| [**model-prompt**](plugins/model-prompt/README.md) | Browse and edit persistent Markdown instructions for each provider/model pair. | `0.2.0` |
| [**strip-autonomy-push**](plugins/strip-autonomy-push/README.md) | Remove OMP's built-in keep-going/don't-ask lines from the main session, so the agent checks in instead of pushing on. | `0.1.0` |

The catalog is [`syncriix`](.omp-plugin/marketplace.json). Install identifiers use `plugin@syncriix`; scoped package names follow `@syncriix/omp-<plugin>`, such as `@syncriix/omp-model-prompt`.

### Why model-prompt?

- **Instructions that follow the model.** Tune one provider/model pair without changing the others.
- **Browse before you edit.** Search saved prompts and read a live preview without switching models.
- **Ordinary Markdown.** Edit in OMP or your own editor; back up and sync the files with tools you already use.
- **Additive, not a replacement.** Keep OMP's existing system-prompt blocks intact.

This is a native OMP port of [Luke Melnik's pi-model-prompt](https://github.com/lukemelnik/pi-model-prompt). See the [plugin guide](plugins/model-prompt/README.md) for commands, storage, privacy, and port details.

### Why strip-autonomy-push?

OMP tells every agent that finishing the task is the only reason to stop, to act rather than ask, and to verify changes before yielding. That suits an agent working alone, not one you are thinking alongside. This plugin removes those three lines from the main session and leaves subagents as they are. See the [plugin guide](plugins/strip-autonomy-push/README.md) for exactly what it matches and its limits.

## Manage your installation

Installations are user-scoped by default. To install only for the current project instead:

```sh
omp plugin install --scope project model-prompt@syncriix
```

To check the latest catalog and explicitly upgrade:

```sh
omp plugin marketplace update syncriix
omp plugin upgrade model-prompt@syncriix
```

Restart OMP after an upgrade. Refreshing the catalog alone does not upgrade installed code. This repository adds no automatic updater; OMP's own marketplace update policy remains yours to configure.

To remove the plugin:

```sh
omp plugin uninstall model-prompt@syncriix
```

If installed in both scopes, specify `--scope user` or `--scope project` when uninstalling. Restart OMP afterward. Prompt files live separately from the installed plugin; remove or archive them yourself if no longer needed.

## Contributing

[Issues](https://github.com/Syncriix/omp-plugins/issues) and [pull requests](https://github.com/Syncriix/omp-plugins/pulls) are welcome. Start with the [contribution guide](CONTRIBUTING.md) for local setup, tests, and verification.

Use the [bug report](https://github.com/Syncriix/omp-plugins/issues/new?template=bug_report.yml) or [feature request](https://github.com/Syncriix/omp-plugins/issues/new?template=feature_request.yml) form. Never include credentials or private prompt content.

See the [changelog](CHANGELOG.md) for releases and [authors](AUTHORS.md) for provenance and credits.

## Credits and license

- **Original plugin:** [pi-model-prompt](https://github.com/lukemelnik/pi-model-prompt) by **Luke Melnik**, MIT licensed. Original copyright is preserved in the [plugin license](plugins/model-prompt/LICENSE).
- **OMP port and marketplace:** [Sync / Syncriix](https://github.com/Syncriix), [MIT](LICENSE).

This is an independent community marketplace, not an official OMP distribution.
