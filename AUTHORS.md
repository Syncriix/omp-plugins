# Authors and attribution

## Marketplace and OMP adaptation

**[Sync / Syncriix](https://github.com/Syncriix)** maintains this marketplace and the OMP adaptation of Model Prompt.

Marketplace documentation and original repository work are covered by the [root MIT license](LICENSE).

## Model Prompt upstream

**[Luke Melnik](https://github.com/lukemelnik)** created
[pi-model-prompt](https://github.com/lukemelnik/pi-model-prompt), the original implementation
of the per-model Markdown workflow, editor, viewer, commands, and agent tools.

Our port starts from:

- Package: `@lukemelnik/pi-model-prompt` version `0.1.0`.
- Upstream commit: [`074b766f03f12c4851829bee095bc6640954cbed`](https://github.com/lukemelnik/pi-model-prompt/tree/074b766f03f12c4851829bee095bc6640954cbed).
- License: **MIT**, with the original copyright notice preserved in [`plugins/model-prompt/LICENSE`](plugins/model-prompt/LICENSE).

The [plugin guide](plugins/model-prompt/README.md#upstream-and-port-scope) describes the OMP-specific changes.
Attribution does not imply upstream endorsement or maintenance of this port.

## Host project

[Oh My Pi](https://github.com/can1357/oh-my-pi) provides the host runtime and extension APIs.
This repository is an independent community marketplace, not an official OMP distribution.

## Future contributions

Git history records contributions to this repository. When adding or adapting a plugin,
credit its original authors, preserve its license notices, and record its upstream source
and revision. Licenses are kept with each plugin; the root license does not replace them.
