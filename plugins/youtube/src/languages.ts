/**
 * Picks the subtitle track in the language the video is spoken in.
 *
 * yt-dlp's metadata gives the spoken language as `language` (often regional,
 * such as "en-US", while tracks are keyed "en") and lists manual `subtitles`
 * and `automatic_captions`. YouTube marks the untranslated speech-recognition
 * track with an "-orig" suffix; every other automatic track is a machine
 * translation. Preference: a manual track in the spoken language, then the
 * original automatic track, then English, then nothing.
 */

export interface CaptionInfo {
	language?: string | null;
	subtitles?: Record<string, unknown> | null;
	automatic_captions?: Record<string, unknown> | null;
}

const ORIG = "-orig";

function base(tag: string): string {
	return tag.split("-")[0].toLowerCase();
}

function find(keys: string[], language: string): string | undefined {
	return keys.find(key => key.toLowerCase() === language) ?? keys.find(key => base(key) === language);
}

export function pickSubtitleLanguage(info: CaptionInfo): string | null {
	const manual = Object.keys(info.subtitles ?? {}).filter(key => key !== "live_chat");
	const auto = Object.keys(info.automatic_captions ?? {});
	const original = auto.find(key => key.endsWith(ORIG));
	const spoken = info.language ? base(info.language) : original ? base(original) : null;

	if (spoken) {
		const track =
			find(manual, spoken) ?? auto.find(key => key === `${spoken}${ORIG}`) ?? find(auto, spoken);
		if (track) return track;
	}
	return find(manual, "en") ?? find(auto, "en") ?? null;
}
