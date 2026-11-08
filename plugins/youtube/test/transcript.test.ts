import assert from "node:assert/strict";
import { test } from "node:test";
import { vttToTranscript } from "../src/transcript.ts";

const cue = (start: string, ...lines: string[]) => `${start}.000 --> ${start}.900\n${lines.join("\n")}`;
const vtt = (...cues: string[]) => `WEBVTT\n\n${cues.join("\n\n")}\n`;

// Shape of YouTube auto-generated captions: rolling two-line cues, word timing
// tags, whitespace-only lines inside cues, and 10 ms repeat cues.
const AUTO = `WEBVTT
Kind: captions
Language: en

00:00:04.280 --> 00:00:06.830 align:start position:0%
 
This<00:00:04.760><c> is</c><00:00:04.960><c> a</c><00:00:05.000><c> three.</c>

00:00:06.830 --> 00:00:06.840 align:start position:0%
This is a three.
 

00:00:06.840 --> 00:00:08.350 align:start position:0%
This is a three.
and<00:00:07.040><c> rendered</c><00:00:07.360><c> low</c>

00:00:08.350 --> 00:00:08.360 align:start position:0%
and rendered low
 
`;

test("collapses rolling auto-captions so each line is said once", () => {
	assert.equal(vttToTranscript(AUTO), "[0:04] This is a three. and rendered low\n");
});

test("joins manual multi-line cues and handles CRLF, cue ids, NOTE blocks, and entities", () => {
	const manual = [
		"WEBVTT",
		"",
		"1",
		"00:00:01.200 --> 00:00:03.360",
		"Tom &amp; Jerry, in front of the",
		"elephants",
		"",
		"NOTE this block is a comment",
		"",
		"2",
		"00:00:05.318 --> 00:00:07.974",
		"&gt;&gt; really long trunks",
		"",
	].join("\r\n");
	assert.equal(vttToTranscript(manual), "[0:01] Tom & Jerry, in front of the elephants >> really long trunks\n");
});

test("starts a new paragraph at the first sentence end after 30 seconds", () => {
	const text = vttToTranscript(
		vtt(
			cue("00:00:00", "First thought."),
			cue("00:00:20", "still the first and"),
			cue("00:00:31", "past thirty but mid"),
			cue("00:00:35", "sentence ends here."),
			cue("00:00:38", "New paragraph."),
		),
	);
	assert.equal(text, "[0:00] First thought. still the first and past thirty but mid sentence ends here.\n\n[0:38] New paragraph.\n");
});

test("forces a paragraph break at 45 seconds when captions have no punctuation", () => {
	const text = vttToTranscript(vtt(cue("00:00:00", "no"), cue("00:00:40", "punctuation"), cue("00:00:45", "anywhere")));
	assert.equal(text, "[0:00] no punctuation\n\n[0:45] anywhere\n");
});

test("stamps hour-long and hourless cue timings", () => {
	const text = vttToTranscript(
		"WEBVTT\n\n00:07.500 --> 00:08.000\nshort form.\n\n01:02:03.000 --> 01:02:04.000\nlate\n",
	);
	assert.equal(text, "[0:07] short form.\n\n[1:02:03] late\n");
});

test("keeps a line that recurs after something else was said", () => {
	const text = vttToTranscript(vtt(cue("00:00:01", "yes"), cue("00:00:02", "no"), cue("00:00:03", "yes")));
	assert.equal(text, "[0:01] yes no yes\n");
});

test("returns an empty transcript for subtitles without cues", () => {
	assert.equal(vttToTranscript("WEBVTT\nKind: captions\n\n"), "");
});
