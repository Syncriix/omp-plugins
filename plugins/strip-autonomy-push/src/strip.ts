/**
 * Pure text logic for strip-autonomy-push, kept apart from the extension entry
 * point so it can be tested without OMP.
 *
 * Each pattern matches one whole line of OMP's project prompt. They are tied to
 * OMP's exact wording: if OMP rewords a line, its pattern stops matching and the
 * line stays in the prompt.
 */

export const UNWANTED_LINES: RegExp[] = [
	/^- Each response MUST advance the task\b.*$/m,
	/^- MUST default to informed action\b.*$/m,
	/^- Before yielding, MUST verify significant behavioral changes\b.*$/m,
];

const EMPTY_CRITICAL = /<critical>\s*<\/critical>\n?/g;

/**
 * Removes each unwanted line (and its newline) from one system-prompt block.
 * Other lines are untouched. A <critical> pair left empty by the removal is
 * dropped too. `removed` counts how many of the patterns matched.
 */
export function strip(block: string): { text: string; removed: number } {
	let text = block;
	let removed = 0;
	for (const pattern of UNWANTED_LINES) {
		const next = text.replace(new RegExp(`${pattern.source}\\n?`, "m"), "");
		if (next !== text) {
			removed++;
			text = next;
		}
	}
	if (removed > 0) text = text.replace(EMPTY_CRITICAL, "");
	return { text, removed };
}
