export interface ModelPromptEditInput {
	edits: Array<{ oldText: string; newText: string }>;
}

/** Validate the entire sequential edit batch before the caller writes any bytes. */
export function applyExactEdits(content: string, edits: ModelPromptEditInput["edits"]): string {
	if (edits.length === 0) {
		throw new Error("Provide at least one exact text replacement.");
	}

	let updated = content;
	for (const [index, edit] of edits.entries()) {
		if (edit.oldText.length === 0) {
			throw new Error("Empty oldText is only allowed when initializing a missing or empty model prompt addendum.");
		}

		const start = updated.indexOf(edit.oldText);
		if (start === -1) {
			throw new Error(`Edit ${index + 1}: oldText was not found. Read model_prompt_show and use the exact current text.`);
		}
		if (updated.indexOf(edit.oldText, start + 1) !== -1) {
			throw new Error(`Edit ${index + 1}: oldText matches more than once. Include more surrounding text to make it unique.`);
		}

		updated = updated.slice(0, start) + edit.newText + updated.slice(start + edit.oldText.length);
	}
	return updated;
}
