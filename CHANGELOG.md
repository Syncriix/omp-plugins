# Changelog

Notable user-visible changes to this marketplace and its plugins are recorded here.
Plugins are versioned independently; refreshing the catalog does not upgrade installed code.

## Model Prompt 0.2.0 — 2026-09-07

### Added

- Helm-style searchable prompt browser for bare `/model-prompt`, listing saved prompts plus the active model.
- Selection preview with side-by-side panes on wide terminals and a stacked layout on narrow terminals; search covers provider, model, and prompt content.
- Edit the selected prompt with Enter without changing OMP's active model.

### Changed

- Bare `/model-prompt` opens the browser instead of going straight to the editor. Explicit `edit`, `show`, and `clear` still target the active model.
- Compact `[+P]` status text, with optional placement through OMP's native custom status segment; the plugin does not change global status-line layout settings.

## Model Prompt 0.1.0 — 2026-09-07

Initial public release of `model-prompt@syncriix`, an OMP adaptation of
[Luke Melnik's pi-model-prompt 0.1.0](https://github.com/lukemelnik/pi-model-prompt/tree/074b766f03f12c4851829bee095bc6640954cbed).

### Added

- Git-backed `syncriix` marketplace with user- and project-scoped installation.
- Persistent Markdown instructions for each provider/model pair.
- `/model-prompt edit`, `show`, and `clear` commands.
- `model_prompt_show` and `model_prompt_edit` agent tools.
- Focused exact-edit regression tests and a GitHub Actions test workflow.

### OMP adaptations

- Preserve OMP's existing system-prompt blocks and append model instructions as a separate block.
- Select instructions from the active model at each new user prompt, without relying on Pi's `model_select` event.
- Apply exact, unique text replacements directly; reject the entire batch before writing if any match is missing or ambiguous.
- Use OMP's bundled runtime compatibility imports and schemas, without installing Bun or npm dependencies for the plugin.

### Compatibility

- Verified with OMP 18.1.11 on Windows: marketplace installation, installed-plugin discovery,
  editor/viewer/clear commands, prompt selection, and agent-tool behavior.
- Other OMP versions and operating systems were not runtime-tested for this release.
- The custom prompt viewer requires OMP's terminal UI; see the [plugin guide](plugins/model-prompt/README.md#commands).

## Updating

```sh
omp plugin marketplace update syncriix
omp plugin upgrade model-prompt@syncriix
```

Restart OMP after upgrading extension code. Editing prompt text requires only a new user prompt.
