/**
 * YouTube
 *
 * Registers `youtube_download`: fetches one video's transcript with yt-dlp, and
 * the video itself on request (mp4, at most 1080p). Subtitles are taken in the
 * language the video is spoken in (manual captions where they exist, the
 * original auto-generated track otherwise, then English) and converted into
 * timestamped paragraphs.
 *
 * The result is written for the calling model: metadata as `key: value` lines
 * with each transcript's path and size, never the transcript itself, so the
 * model chooses to read it whole, read a range, or grep it. Errors say what to
 * do next.
 *
 * yt-dlp runs twice: once for the metadata, which decides the subtitle track
 * and rejects playlist, channel and search inputs, then with that metadata
 * loaded back in to download. yt-dlp must be on PATH.
 */
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";
import { type CaptionInfo, pickSubtitleLanguage } from "./languages";
import { formatTime, vttToTranscript } from "./transcript";

const DEFAULT_DIR = join(homedir(), "downloads", "youtube");
const STDERR_TAIL = 2000;
const NOT_A_VIDEO =
	"Not a single video link or id. This tool cannot search YouTube: ask the user for the link, or find it with web search and confirm it with the user.";

interface VideoInfo extends CaptionInfo {
	_type?: string;
	id?: string;
	title?: string;
	channel?: string;
	uploader?: string;
	duration?: number;
}

export default function youtubeExtension(pi: ExtensionAPI) {
	const { Type } = pi.typebox;

	async function ytdlp(args: string[], signal: AbortSignal | undefined, cwd: string): Promise<string> {
		const result = await pi.exec("yt-dlp", args, { signal, cwd }).catch((error: unknown) => {
			if (/ENOENT|not found/i.test(String(error))) {
				throw new Error("yt-dlp is not installed or not on PATH; tell the user to install it.");
			}
			throw error;
		});
		if (result.killed) throw new Error("Download cancelled.");
		if (/is not a valid URL/.test(result.stderr)) throw new Error(NOT_A_VIDEO);
		if (result.code !== 0) {
			throw new Error(`yt-dlp exited with code ${result.code}:\n${result.stderr.slice(-STDERR_TAIL).trim()}`);
		}
		return result.stdout;
	}

	pi.registerTool({
		name: "youtube_download",
		label: "YouTube Download",
		description: [
			"Fetch one YouTube video's transcript by link or id; optionally download the video as mp4 (at most 1080p).",
			"Input: any single-video link (watch, youtu.be, shorts, live, embed, m./music. hosts, youtube-nocookie, with t= or list= parameters) or an 11-character id. Cannot search; playlists and channels are rejected.",
			"Subtitles: the spoken language (manual track, else the original auto-generated one), else English.",
			"Returns metadata as key: value lines, including transcript_file and transcript_size; the transcript is never inlined. Read the file whole, by line range, or grep it: one [m:ss] paragraph per line.",
		].join("\n"),
		parameters: Type.Object({
			url: Type.String({ description: "Single-video link or 11-character id." }),
			video: Type.Optional(
				Type.Boolean({ description: "Also download the video file. Default false: transcript only. Set true only when the user wants the file." }),
			),
			languages: Type.Optional(
				Type.String({
					description: 'Override subtitle languages in yt-dlp --sub-langs syntax, e.g. "en" or "de,en". Omit to get the spoken language.',
				}),
			),
			dir: Type.Optional(
				Type.String({
					description: "Output directory; ~ expands, relative paths resolve against the working directory. Default ~/downloads/youtube.",
				}),
			),
		}),
		async execute(_toolCallId, params, signal, _onUpdate, ctx) {
			const dir = params.dir ? resolve(ctx.cwd, params.dir.replace(/^~(?=$|\/)/, homedir())) : DEFAULT_DIR;
			const video = params.video ?? false;
			const session = ctx.sessionManager.getSessionId().replace(/[^\w-]/g, "_");

			const infoJson = await ytdlp(
				[params.url, "--no-playlist", "--flat-playlist", "--dump-single-json", "--no-warnings"],
				signal,
				ctx.cwd,
			);
			const info = JSON.parse(infoJson) as VideoInfo;
			if (info._type === "playlist" || !info.id) throw new Error(NOT_A_VIDEO);
			const { id } = info;
			const title = info.title ?? id;
			const languages = params.languages ?? pickSubtitleLanguage(info);
			const noSubtitles = `"${title}" [${id}] has no subtitles${params.languages ? ` in "${params.languages}"` : ""}, so there is no transcript. Do not infer its content from the title or memory.`;
			if (!languages && !video) throw new Error(noSubtitles);

			const tmp = await mkdtemp(join(tmpdir(), "omp-youtube-"));
			let stdout: string;
			try {
				const infoPath = join(tmp, "info.json");
				await writeFile(infoPath, infoJson);
				stdout = await ytdlp(
					[
						"--load-info-json",
						infoPath,
						"--no-simulate",
						"--no-progress",
						"-P",
						dir,
						"-o",
						`%(title).150B [%(id)s] [${session}].%(ext)s`,
						...(languages
							? ["--write-subs", "--write-auto-subs", "--sub-langs", languages, "--sub-format", "vtt"]
							: []),
						...(video
							? ["-S", "res:1080,vcodec:h264,ext:mp4:m4a", "--merge-output-format", "mp4", "--print", "after_move:%(filepath)s"]
							: ["--skip-download"]),
					],
					signal,
					ctx.cwd,
				);
			} finally {
				await rm(tmp, { recursive: true, force: true });
			}
			// Only video runs use --print, which keeps yt-dlp's stdout to the printed path.
			const videoPath = video ? stdout.split("\n").find(line => line.trim() !== "") : undefined;

			const marker = `[${id}] [${session}].`;
			const transcripts: Array<{ path: string; language: string; auto: boolean; chars: number; paragraphs: number }> = [];
			for (const name of (await readdir(dir)).sort()) {
				if (!name.includes(marker) || !name.endsWith(".vtt")) continue;
				const vttPath = join(dir, name);
				const language = name.slice(name.indexOf(marker) + marker.length, -".vtt".length);
				const text = vttToTranscript(await readFile(vttPath, "utf8"));
				const path = `${vttPath.slice(0, -".vtt".length)}.txt`;
				await writeFile(path, text);
				if (!video) await rm(vttPath);
				// yt-dlp takes the manual track whenever one exists for the requested key.
				transcripts.push({
					path,
					language,
					auto: !(info.subtitles && language in info.subtitles),
					chars: text.length,
					paragraphs: text === "" ? 0 : text.split("\n\n").length,
				});
			}
			if (!video && transcripts.length === 0) throw new Error(noSubtitles);

			const lines = [`title: ${title}`, `id: ${id}`];
			const channel = info.channel ?? info.uploader;
			if (channel) lines.push(`channel: ${channel}`);
			if (info.duration) lines.push(`duration: ${formatTime(Math.round(info.duration))}`);
			if (videoPath) lines.push(`video_file: ${videoPath}`);
			if (transcripts.length === 0) lines.push("subtitles: none");
			for (const t of transcripts) {
				lines.push(
					`subtitles: ${t.language} (${t.auto ? "auto-generated; names and terms may be misheard" : "manual"})`,
					`transcript_file: ${t.path}`,
					`transcript_size: chars=${t.chars} paragraphs=${t.paragraphs} (one paragraph per line, blank lines between)`,
				);
			}
			return {
				content: [{ type: "text", text: lines.join("\n") }],
				details: {
					id,
					title,
					video: videoPath ?? null,
					transcripts,
				},
			};
		},
	});
}
