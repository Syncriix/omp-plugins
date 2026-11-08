import assert from "node:assert/strict";
import { test } from "node:test";
import { pickSubtitleLanguage } from "../src/languages.ts";

const tracks = (...keys: string[]) => Object.fromEntries(keys.map(key => [key, []]));

test("prefers a manual track in the spoken language, matching regional tags by base language", () => {
	// aircAruvnKk: language "en-US", manual tracks keyed "en", plus "en-orig" auto.
	const info = {
		language: "en-US",
		subtitles: tracks("de", "en", "en-GB"),
		automatic_captions: tracks("de", "en", "en-orig"),
	};
	assert.equal(pickSubtitleLanguage(info), "en");
});

test("uses a regional manual track when no exact one exists", () => {
	assert.equal(pickSubtitleLanguage({ language: "pt", subtitles: tracks("pt-BR", "en") }), "pt-BR");
});

test("falls back to the original auto-generated track rather than a machine translation", () => {
	// W5Bscl7ALrE: German, no manual tracks, auto list includes translations.
	const info = { language: "de", subtitles: {}, automatic_captions: tracks("de", "de-orig", "en", "fr") };
	assert.equal(pickSubtitleLanguage(info), "de-orig");
});

test("infers the spoken language from the -orig track when metadata has none", () => {
	const info = { language: null, subtitles: tracks("en"), automatic_captions: tracks("en", "fr", "fr-orig") };
	assert.equal(pickSubtitleLanguage(info), "fr-orig");
});

test("falls back to English when the spoken language has no track", () => {
	// jNQXAC9IVRw: no language metadata, manual de/en, no -orig track.
	assert.equal(pickSubtitleLanguage({ language: null, subtitles: tracks("de", "en"), automatic_captions: tracks("en") }), "en");
	assert.equal(pickSubtitleLanguage({ language: "ja", subtitles: {}, automatic_captions: tracks("en") }), "en");
});

test("ignores live chat replays and reports no subtitles as null", () => {
	assert.equal(pickSubtitleLanguage({ language: "en", subtitles: tracks("live_chat") }), null);
	assert.equal(pickSubtitleLanguage({}), null);
});
