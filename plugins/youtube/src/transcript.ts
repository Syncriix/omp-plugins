/**
 * WebVTT subtitles to a readable plain-text transcript in timestamped paragraphs.
 *
 * YouTube's auto-generated captions roll: each cue repeats the previous line
 * above the new one, inline <c> and <00:00:01.000> tags time individual words,
 * and 10 ms filler cues repeat the same text again. Keeping each distinct line
 * once, timed at the start of the cue where it first appears, recovers the
 * spoken text from both the rolling and the manual caption formats.
 *
 * Lines are then joined into paragraphs of roughly PARAGRAPH_SECONDS: a
 * paragraph ends at the first sentence end after that, or at
 * MAX_PARAGRAPH_SECONDS when the captions have no punctuation. Each paragraph
 * is stamped with the time its first line is said.
 */

const PARAGRAPH_SECONDS = 30;
const MAX_PARAGRAPH_SECONDS = 45;

const TIMING = /^(\d+:)?(\d{2}):(\d{2})[.,]\d{3}\s+-->/;
const SENTENCE_END = /[.!?…♪\])"']$/;

const ENTITIES: Record<string, string> = {
	"&amp;": "&",
	"&lt;": "<",
	"&gt;": ">",
	"&quot;": '"',
	"&#39;": "'",
	"&nbsp;": " ",
};

interface CaptionLine {
	start: number;
	text: string;
}

export function formatTime(totalSeconds: number): string {
	const h = Math.floor(totalSeconds / 3600);
	const m = Math.floor((totalSeconds % 3600) / 60);
	const s = String(totalSeconds % 60).padStart(2, "0");
	return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

function captionLines(vtt: string): CaptionLine[] {
	const lines: CaptionLine[] = [];
	let last = "";
	for (const block of vtt.replace(/\r\n?/g, "\n").split(/\n{2,}/)) {
		const rows = block.split("\n");
		const timingIndex = rows.findIndex(row => TIMING.test(row));
		if (timingIndex === -1) continue;
		const [, h, m, s] = TIMING.exec(rows[timingIndex])!;
		const start = (h ? Number.parseInt(h, 10) * 3600 : 0) + Number(m) * 60 + Number(s);
		for (const row of rows.slice(timingIndex + 1)) {
			const text = row
				.replace(/<[^>]*>/g, "")
				.replace(/&(amp|lt|gt|quot|#39|nbsp);/g, entity => ENTITIES[entity])
				.replace(/\s+/g, " ")
				.trim();
			if (text === "" || text === last) continue;
			lines.push({ start, text });
			last = text;
		}
	}
	return lines;
}

export function vttToTranscript(vtt: string): string {
	const paragraphs: Array<{ start: number; parts: string[] }> = [];
	for (const line of captionLines(vtt)) {
		const current = paragraphs.at(-1);
		const elapsed = current ? line.start - current.start : 0;
		const previous = current?.parts.at(-1) ?? "";
		if (
			!current ||
			elapsed >= MAX_PARAGRAPH_SECONDS ||
			(elapsed >= PARAGRAPH_SECONDS && SENTENCE_END.test(previous))
		) {
			paragraphs.push({ start: line.start, parts: [line.text] });
		} else {
			current.parts.push(line.text);
		}
	}
	return paragraphs.map(p => `[${formatTime(p.start)}] ${p.parts.join(" ")}\n`).join("\n");
}
