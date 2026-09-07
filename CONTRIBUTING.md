# Contributing

Bug reports, focused fixes, documentation improvements, and useful OMP plugins are welcome.
For a new plugin or a change to existing behavior, open an issue first so we can agree on scope.

## Report a problem

Use the [bug report form](https://github.com/Syncriix/omp-plugins/issues/new?template=bug_report.yml).
Include the plugin version, `omp --version`, operating system, reproduction steps, and expected versus actual behavior.
A small reproduction is more useful than an entire session export.

**Never publish credentials, private prompts, or unredacted session dumps.** OMP dumps may
contain the full system prompt, conversation, and secrets. Replace sensitive values with
obvious examples before sharing logs.

For an idea, use the [feature request form](https://github.com/Syncriix/omp-plugins/issues/new?template=feature_request.yml)
and describe the problem before proposing an implementation.

## Work locally

You need Git and OMP. **Node.js 24 or newer** is needed only for the focused development tests;
installed plugins run inside OMP and do not require a separate Node.js or Bun installation.

```sh
git clone https://github.com/Syncriix/omp-plugins.git
cd omp-plugins
node --test plugins/model-prompt/test/*.test.ts
```

To load your working copy for a manual check, use the absolute path to its entrypoint:

```sh
omp --extension /absolute/path/to/omp-plugins/plugins/model-prompt/src/index.ts
```

Use a separate test profile, such as `omp --profile plugin-dev --extension <absolute-path>`,
so prompt edits do not affect your normal configuration. Do not load the working copy and
an installed copy of the same plugin together; duplicate command/tool registrations can
obscure the result. Restart the test session after changing extension code.

### Verify the affected behavior

For Model Prompt changes, check the relevant parts of this workflow:

1. Select a model and use `/model-prompt edit` to save a harmless instruction.
2. Use `/model-prompt show` to verify the saved text and storage path.
3. Select a different model and confirm its instructions are independent.
4. Verify instructions apply on the next user prompt without replacing OMP's base prompt.
5. Confirm `/model-prompt clear` removes only the selected pair's prompt after confirmation.
6. For editing-tool changes, verify successful replacements and that a rejected batch leaves the file unchanged.
7. Open `/model-prompt`, search and preview saved prompts, then edit another model's prompt and confirm OMP's active model is unchanged.

An authenticated model is required if you test actual provider requests; those requests may
use your subscription quota or incur API charges. Do not commit test profiles or prompt files.
The automated suite covers exact text edits, not the entire interactive OMP integration.

## Keep changes reviewable

- Keep a pull request focused on one behavior or problem.
- Explain what changed, why, and how you verified it. State what you did not test.
- Add regression tests for meaningful failure cases, not assertions about source-code layout.
- Use OMP's supported host APIs. Avoid new runtime dependencies unless the behavior needs them.
- Keep personal configuration, credentials, sessions, and generated caches out of the repository.
- Update the affected plugin guide and add user-visible changes to `CHANGELOG.md`.

## Plugins, versions, and licenses

Each installable plugin belongs in `plugins/<name>/`, with its own `package.json`, extension
entrypoint, README, and license. Register it in `.omp-plugin/marketplace.json` using a relative source path.

For a release, keep the plugin's package version, catalog version, and documentation consistent.
Plugins are versioned independently. A new catalog entry alone does not update installed code.

When porting existing work, preserve the original license and copyright notices, link the
upstream repository, record the source version or commit, and explain our changes. Add the
upstream author to `AUTHORS.md`. Do not assume the marketplace's MIT license overrides a plugin's license.
Contributions must be compatible with the license of the files they modify.
