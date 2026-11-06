/**
 * Strip Autonomy Push
 *
 * OMP's project prompt ends with a <critical> block telling every agent to keep
 * going without stopping:
 *   - Each response MUST advance the task; completion only stopping condition.
 *   - MUST default to informed action; do not ask for confirmation ...
 *   - Before yielding, MUST verify significant behavioral changes ...
 *
 * That suits an agent left to finish a job alone. It works against an agent you
 * are thinking alongside: it pushes the agent to keep acting, skip check-ins,
 * and run verification nobody asked for. This extension removes those three
 * lines from the main session's system prompt at the start of each turn.
 *
 * Subagents keep the lines. They run one job handed to them by the main agent
 * and report back, so "finish without stopping" fits them.
 *
 * If none of the lines are found, OMP has probably reworded them; the extension
 * warns once per session instead of failing silently.
 */
import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";
import { strip } from "./strip";

export default function stripAutonomyPush(pi: ExtensionAPI) {
	pi.setLabel("Strip autonomy push");
	let warned = false;

	pi.on("before_agent_start", async (event, ctx) => {
		if (ctx.agent?.kind === "sub") return;
		let removed = 0;
		const systemPrompt = event.systemPrompt.map(block => {
			const result = strip(block);
			removed += result.removed;
			return result.text;
		});

		if (removed === 0) {
			if (!warned) {
				warned = true;
				ctx.ui?.notify(
					"strip-autonomy-push: the 'MUST advance the task' lines weren't found. OMP may have reworded them; check the system prompt.",
					"warning",
				);
			}
			return;
		}
		return { systemPrompt };
	});
}
