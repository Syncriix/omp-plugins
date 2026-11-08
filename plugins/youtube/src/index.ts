/**
 * YouTube
 *
 * Registers `youtube_download`: fetches one video's transcript with yt-dlp, and
 * the video itself on request (mp4, at most 1080p). Subtitles are taken in the
 * language the video is spoken in (manual captions where they exist, the
 * original auto-generated track otherwise, then English) and converted into a
 * timestamped plain-text transcript the agent can read.
 *
 * yt-dlp runs twice: once for the metadata, which decides the subtitle track
 * and rejects playlist and channel URLs, then with that metadata loaded back
 * in to download. yt-dlp must be on PATH.
 */
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";
import { type CaptionInfo, pickSubtitleLanguage } from "./languages";
import { vttToTranscript } from "./transcript";

const DEFAULT_DIR = join(homedir(), "downloads", "youtube");
const STDERR_TAIL = 2000;

interface VideoInfo extends CaptionInfo {
	_type?: string;
	id?: string;
	title?: string;
}

export default function youtubeExtension(pi: ExtensionAPI) {
	const { Type } = pi.typebox;

	async function ytdlp(args: string[], signal: AbortSignal | undefined, cwd: string): Promise<string> {
		const result = await pi.exec("yt-dlp", args, { signal, cwd }).catch((error: unknown) => {
			if (/ENOENT|not found/i.test(String(error))) {
				throw new Error("yt-dlp is not installed or not on PATH. Install it (https://github.com/yt-dlp/yt-dlp) and retry.");
			}
			throw error;
		});
		if (result.killed) throw new Error("Download cancelled.");
		if (result.code !== 0) {
			throw new Error(`yt-dlp exited with code ${result.code}:\n${result.stderr.slice(-STDERR_TAIL).trim()}`);
		}
		return result.stdout;
	}

	pi.registerTool({
		name: "youtube_download",
		label: "YouTube Download",
		description: [
			"Fetch a single YouTube video's transcript, and optionally the video (mp4, at most 1080p).",
			"Accepts any video link form: watch, youtu.be, shorts, live, embed, m./music. hosts, youtube-nocookie, links with t= or list= parameters, or a bare 11-character video id. It cannot search: search strings, playlist and channel URLs are rejected.",
			"Subtitles default to the language the video is spoken in, falling back to English.",
			"Writes `<title> [<id>] [<session>].<lang>.txt`, a transcript in timestamped paragraphs, plus the `.mp4` and `.vtt` when video=true.",
		].join("\n"),
		parameters: Type.Object({
			url: Type.String({ description: "Video URL or id." }),
			video: Type.Optional(
				Type.Boolean({ description: "Also download the video file. Default false: transcript only." }),
			),
			languages: Type.Optional(
				Type.String({
					description:
						'Override subtitle languages, in yt-dlp --sub-langs syntax, e.g. "en" or "de,en". Default: the spoken language, then English.',
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
			if (info._type === "playlist" || !info.id) {
				throw new Error("That is a playlist or channel URL; youtube_download fetches single videos. Pass a video link.");
			}
			const { id } = info;
			const title = info.title ?? id;
			const languages = params.languages ?? pickSubtitleLanguage(info);
			if (!languages && !video) throw new Error(`"${title}" [${id}] has no subtitles.`);

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

			const transcripts: Array<{ path: string; paragraphs: number }> = [];
			for (const name of (await readdir(dir)).sort()) {
				if (!name.includes(`[${id}] [${session}].`) || !name.endsWith(".vtt")) continue;
				const vttPath = join(dir, name);
				const text = vttToTranscript(await readFile(vttPath, "utf8"));
				const path = `${vttPath.slice(0, -".vtt".length)}.txt`;
				await writeFile(path, text);
				if (!video) await rm(vttPath);
				transcripts.push({ path, paragraphs: text === "" ? 0 : text.split("\n\n").length });
			}
			if (!video && transcripts.length === 0) {
				throw new Error(`No subtitles in "${languages}" for "${title}" [${id}].`);
			}

			const lines = [`"${title}" [${id}]`];
			if (videoPath) lines.push(`Video: ${videoPath}`);
			for (const t of transcripts) {
				lines.push(`Transcript: ${t.path} (${t.paragraphs} paragraph${t.paragraphs === 1 ? "" : "s"})`);
			}
			if (transcripts.length === 0) lines.push("No subtitles.");
			return {
				content: [{ type: "text", text: lines.join("\n") }],
				details: { id, title, video: videoPath ?? null, transcripts },
			};
		},
	});
}
