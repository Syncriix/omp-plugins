<div align="center">

# model-prompt

**Different models. Different instructions. One Markdown file per pair.**

Persistent, additive model prompts for [Oh My Pi](https://github.com/can1357/oh-my-pi).

[Install](#install) · [Commands](#commands) · [Storage](#storage-and-sync) · [Upstream](#upstream-and-port-scope)

</div>

A native OMP port of [pi-model-prompt](https://github.com/lukemelnik/pi-model-prompt) by **Luke Melnik**. Keep your preferred style or model-specific guidance attached to the selected provider/model instead of repeating it in every conversation.

## Install

```sh
omp plugin marketplace add Syncriix/omp-plugins
omp plugin install model-prompt@syncriix
```

**Restart OMP** after installation to load the extension module. This plugin needs OMP's marketplace extension-module support; it is not a standalone program or a Claude Code plugin.

In OMP, select the model you want to customize and run:

```text
/model-prompt edit
```

For example, save this as its addendum:

```markdown
Prefer concise answers with concrete examples.
When reviewing code, lead with correctness issues before style suggestions.
Distinguish observed results from assumptions.
```

Send your next prompt to use it. No restart is needed when changing prompt text.

## Commands

Use the browser to manage saved prompts across models. Explicit subcommands operate on the **currently selected provider/model pair**.

| Command | Action |
| --- | --- |
| `/model-prompt` | Browse saved prompts plus the active model, with search and a preview. |
| `/model-prompt edit` | Create or edit the pair's Markdown addendum. |
| `/model-prompt show` | View the saved addendum. |
| `/model-prompt clear` | Confirm and remove the pair's saved addendum. |

In the browser, type to search provider, model, or prompt content. Search is case-insensitive; all space-separated terms must match. **Up/Down** selects a row and updates its preview; **Page Up/Page Down** scrolls the preview. **Enter** opens the selected prompt's editor; **Escape** closes the browser.

Editing another model's prompt does **not** change OMP's active model. The active model is marked `[current]` and listed even without saved instructions. Wide terminals show the list and preview side by side; narrow terminals stack them.

The editor and confirmation require an interactive UI. The browser and custom `show` viewer require OMP's terminal UI; they are unavailable in headless mode or the native RPC custom-UI surface. Use the `model_prompt_show` agent tool for the active model or read the Markdown files when custom UI is unavailable.

### Agent tools

The extension also exposes:

- **`model_prompt_show`** — read the current pair's saved prompt and path.
- **`model_prompt_edit`** — edit it through exact text replacements.

For example, ask OMP: “Show my model prompt, then change the instruction about code reviews to prioritize security as well.” These tools target the current pair, not an arbitrary file path.

Each replacement must match exactly once. Edits are evaluated in order and saved only if all succeed; missing or ambiguous matches leave the file unchanged. A single empty-text match can initialize an absent or empty prompt.

## How it applies

At the start of each user prompt, the extension reads the file for OMP's current `ctx.model`. If it contains instructions, they are appended as an extra system-prompt block. Existing blocks are preserved; the extension does not replace or flatten OMP's system prompt.

- **Switch models:** the next user prompt uses the new pair's file.
- **Edit or clear a prompt:** the change applies on the next user prompt, not to a response already running.
- **No saved instructions:** no model-specific addendum is appended.
- **Same model ID, different provider:** separate files and separate instructions.

Prompts are global to the active OMP agent directory, not tied to a project or conversation. Project-scoped plugin installation does not make its prompt storage project-scoped.

### Status indicator

`[+P]` indicates that the active model has a non-empty saved prompt. Status refreshes at session start, on a new user prompt, and after prompt commands; switching models is reflected on the next refresh.

To place it between the model and path using OMP's native accent color, optionally configure a custom status line in your OMP settings:

```yaml
statusLine:
  preset: custom
  leftSegments: [model, status, path, git]
  rightSegments: [context_pct, cost]
  showHookStatus: false
```

This is an example layout, not a required replacement for your existing settings: retain your preferred segments and add `status` where you want it. `showHookStatus: false` hides the separate extension-status footer to avoid duplication. The plugin only supplies `[+P]`; it never rewrites your global layout.

## Storage and sync

Files live beneath OMP's native `getAgentDir()` directory:

```text
<agent-dir>/model-prompts/<provider>/<encoded-model-id>.md
```

The default is:

```text
~/.omp/agent/model-prompts/<provider>/<encoded-model-id>.md
```

An OMP profile or agent-directory override, such as `PI_CODING_AGENT_DIR`, can relocate the root. Let the plugin show the actual path rather than assuming the default. Model IDs are filename-encoded, so an ID containing `/` does not create another directory.

These are plain Markdown files: edit them directly, keep a backup, or sync the `model-prompts` directory using your own tools. There is no built-in sync service or migration of old Pi files. To bring existing Pi prompts over, copy the relevant files from `~/.pi/agent/model-prompts/` into OMP's `model-prompts/` directory, retaining the provider directories and filenames.

### Prompt content is not secret storage

The files are stored locally, but their instructions are **sent to the selected model's provider** as part of the system prompt. Do not store passwords, API keys, or other secrets in them. Agent tools can also read and modify this content; only add instructions you trust, and review what you choose to sync or commit.

## Updates and removal

```sh
omp plugin marketplace update syncriix
omp plugin upgrade model-prompt@syncriix
```

Restart OMP to load upgraded extension code. Prompt-file edits themselves need only a new user prompt. The plugin contains no automatic software updater.

To uninstall:

```sh
omp plugin uninstall model-prompt@syncriix
```

Restart OMP afterward. Uninstalling the plugin does not remove the separately stored prompt files. Use `/model-prompt clear` before uninstalling, or manage the files directly. See the [marketplace guide](../../README.md#manage-your-installation) for installation scopes.

## Upstream and port scope

Based on [`@lukemelnik/pi-model-prompt` 0.1.0](https://www.npmjs.com/package/@lukemelnik/pi-model-prompt/v/0.1.0), upstream commit [`074b766f03f12c4851829bee095bc6640954cbed`](https://github.com/lukemelnik/pi-model-prompt/tree/074b766f03f12c4851829bee095bc6640954cbed).

The port retains the per-provider/model Markdown workflow, commands, and agent tools. OMP-specific changes use native extension APIs and storage, preserve its `string[]` system-prompt blocks, and follow the live model at the next user prompt without relying on Pi's `model_select` event. Exact text edits are handled by the plugin rather than passed to OMP's incompatible anchored-patch edit tool.

Runtime imports use OMP's bundled `@mariozechner/pi-coding-agent` and `@mariozechner/pi-tui` compatibility aliases; native `@oh-my-pi` types describe the OMP API. These modules are supplied by the host—no extra runtime npm dependencies are installed.

**Original work: Copyright (c) 2026 Luke Melnik.** The original MIT license is preserved in [LICENSE](LICENSE). OMP adaptation and marketplace maintenance by [Sync / Syncriix](https://github.com/Syncriix).
