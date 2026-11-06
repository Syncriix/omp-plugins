import assert from "node:assert/strict";
import { test } from "node:test";
import { strip } from "../src/strip.ts";

// Shape of the end of OMP's rendered main-agent project prompt (OMP 18.12).
const OMP_TAIL = [
	"</project-context>",
	"",
	"<critical>",
	"- Each response MUST advance the task; completion only stopping condition.",
	"- MUST default to informed action; do not ask for confirmation when tools or repo context can answer.",
	"- Before yielding, MUST verify significant behavioral changes: run the specific test, command, or scenario covering the change.",
	"</critical>",
	"",
].join("\n");

test("removes all three lines and the emptied critical block", () => {
	const { text, removed } = strip(OMP_TAIL);
	assert.equal(removed, 3);
	assert.equal(text, "</project-context>\n\n");
});

test("keeps other lines in the block, and the block itself", () => {
	const block = OMP_TAIL.replace("</critical>", "- Keep this rule.\n</critical>");
	const { text, removed } = strip(block);
	assert.equal(removed, 3);
	assert.equal(text, "</project-context>\n\n<critical>\n- Keep this rule.\n</critical>\n");
});

test("leaves unrelated critical blocks alone", () => {
	const block = "<critical>\n- NEVER repeat successful setup.\n</critical>\n";
	assert.deepEqual(strip(block), { text: block, removed: 0 });
});

test("does not match the phrase mid-line", () => {
	const block = "- Note: each response MUST advance the task is an OMP rule.\n";
	assert.deepEqual(strip(block), { text: block, removed: 0 });
});

test("reworded lines are left in place and reported as zero removed", () => {
	const block = "<critical>\n- Every response MUST move the task forward.\n</critical>\n";
	assert.deepEqual(strip(block), { text: block, removed: 0 });
});

