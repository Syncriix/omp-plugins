<div align="center">

# strip-autonomy-push

**Let the agent stop and check in.**

Removes OMP's built-in "keep going, don't ask" lines from the main session's system prompt in [Oh My Pi](https://github.com/can1357/oh-my-pi).

[Install](#install) · [What it removes](#what-it-removes) · [Limits](#limits)

</div>

OMP's project prompt ends with a `<critical>` block that tells every agent to treat finishing the task as the only reason to stop, to act rather than ask, and to verify its changes before yielding. That fits an agent left alone with a job. It works against an agent you are thinking alongside: it pushes the agent to keep acting past the point where it should check in, and to run tests or commands nobody asked for.

This plugin removes those lines from the **main session** only. Subagents keep them: they run one job handed to them by the main agent and report back, so "finish without stopping" fits them.

## Install

```sh
omp plugin marketplace add Syncriix/omp-plugins
omp plugin install strip-autonomy-push@syncriix
```

**Restart OMP** to load the extension module. There are no commands or settings; it takes effect on your next prompt.

## What it removes

Exactly these three lines, matched at the start of a line:

```text
- Each response MUST advance the task; completion only stopping condition.
- MUST default to informed action; do not ask for confirmation when tools or repo context can answer.
- Before yielding, MUST verify significant behavioral changes: run the specific test, command, or scenario covering the change.
```

Every other line in the block stays. If the block is empty afterwards, the empty `<critical></critical>` pair is removed too. Other `<critical>` blocks, including those in tool descriptions, are left alone.

The text is changed in memory at the start of each turn. Nothing on disk is modified, and uninstalling restores OMP's prompt unchanged.

## Limits

- **Tied to OMP's wording.** The lines are matched by their opening words. If OMP rewords them, they stop matching and stay in the prompt. When none are found, the plugin shows a warning once per session so the change doesn't go unnoticed. Please [open an issue](https://github.com/Syncriix/omp-plugins/issues) if you see it.
- **Main session only.** Subagents are detected through the extension context and skipped on purpose.
- **Verified with** OMP 18.16.0 on Windows. Other versions and operating systems were not runtime-tested.

## Development

```sh
node --test plugins/strip-autonomy-push/test/*.test.ts
```

The matching logic lives in [`src/strip.ts`](src/strip.ts), apart from the OMP entry point, so it can be tested without OMP.

## License

[BEERWARE-MIT](LICENSE): Beerware with the MIT warranty disclaimer.
