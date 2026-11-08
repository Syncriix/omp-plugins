# Changelog

Notable user-visible changes to this marketplace and its plugins are recorded here.
Plugins are versioned independently; refreshing the catalog does not upgrade installed code.

## Licensing — 2026-11-08

- The marketplace root and Strip Autonomy Push move from MIT to BEERWARE-MIT (Beerware with the MIT warranty disclaimer). Copies obtained earlier stay available under MIT.
- Model Prompt keeps its upstream MIT license.

## YouTube 0.1.0 — 2026-11-08

Initial release of `youtube@syncriix`, licensed BEERWARE-MIT.

### Added

- `youtube_download` tool: fetches one video's transcript with yt-dlp; `video: true` also downloads the video as mp4 (H.264 where available, at most 1080p).
- Accepts every single-video link form and bare video ids; playlist, channel and search inputs are rejected.
- Picks subtitles in the spoken language: a manual track, then YouTube's original auto-generated track (never a machine translation), then English.
- Transcripts in paragraphs of about 30 seconds, each stamped with its start time; rolling auto-caption repeats and word-timing tags are removed.
- Saves to `~/downloads/youtube` by default, named `<title> [<video id>] [<omp session id>]`; raw `.vtt` files are kept only next to a downloaded video.
- Results written for the calling model: `key: value` metadata (title, channel, duration, subtitle track and whether it is auto-generated) with each transcript's path and size; the transcript is never inlined, so the model reads or greps only what it needs. Errors name the next step.
- Bundled `yt` skill with the invocation path (top-level or `xd://` device), the no-search rule, and how to read and cite the result.
- Track selection and transcript regression tests, run by the existing test workflow.

### Compatibility

- Requires `yt-dlp` on `PATH`, and ffmpeg to merge video and audio into mp4.
- Verified with OMP 18.15.0 and yt-dlp 2026.08.19 on NixOS (WSL). Other OMP versions and operating systems were not runtime-tested.

## Strip Autonomy Push 0.1.0 — 2026-11-06

Initial release of `strip-autonomy-push@syncriix`.

### Added

- Removes OMP's three "keep going, don't ask" lines from the main session's system prompt at the start of each turn; subagents keep them.
- Drops the `<critical>` block when it is left empty; other lines and blocks are untouched.
- Warns once per session when none of the lines are found, which usually means OMP reworded them.
- Matching regression tests, run by the existing test workflow.

### Compatibility

- Verified with OMP 18.16.0 on Windows. Other OMP versions and operating systems were not runtime-tested.

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
omp plugin upgrade strip-autonomy-push@syncriix
omp plugin upgrade youtube@syncriix
```

Restart OMP after upgrading extension code. Editing prompt text requires only a new user prompt.
