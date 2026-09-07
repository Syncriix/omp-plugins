import assert from "node:assert/strict";
import { test } from "node:test";
import { applyExactEdits } from "../src/edits.ts";

test("replacements are sequential and replacement dollars are literal", () => {
	assert.equal(
		applyExactEdits("Respond briefly.\nKeep examples.", [
			{ oldText: "briefly", newText: "with $& detail" },
			{ oldText: "with $& detail", newText: "with $$ examples" },
		]),
		"Respond with $$ examples.\nKeep examples.",
	);
});

test("a later missing match rejects the entire result", () => {
	const original = "Keep this original text.";
	assert.throws(() => applyExactEdits(original, [
		{ oldText: "original", newText: "changed" },
		{ oldText: "missing", newText: "replacement" },
	]), /Edit 2: oldText was not found/);
});

test("ambiguous matches include overlapping occurrences", () => {
	assert.throws(() => applyExactEdits("banana", [
		{ oldText: "ana", newText: "apple" },
	]), /matches more than once/);
});

test("ambiguity introduced by an earlier replacement rejects the batch", () => {
	assert.throws(() => applyExactEdits("one two", [
		{ oldText: "one", newText: "two" },
		{ oldText: "two", newText: "three" },
	]), /Edit 2: oldText matches more than once/);
});

test("empty searches cannot replace existing content", () => {
	assert.throws(() => applyExactEdits("Keep this", [
		{ oldText: "", newText: "Overwrite" },
	]), /Empty oldText/);
});

test("the entire prompt can be cleared by an exact replacement", () => {
	assert.equal(applyExactEdits("Only instruction", [
		{ oldText: "Only instruction", newText: "" },
	]), "");
});
