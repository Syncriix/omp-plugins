<div align="center">

# youtube

**Readable video transcripts, straight into your session.**

Fetches YouTube transcripts, and videos on request, with [yt-dlp](https://github.com/yt-dlp/yt-dlp) in [Oh My Pi](https://github.com/can1357/oh-my-pi), and turns the subtitles into timestamped paragraphs the agent can read.

[Install](#install) · [Usage](#usage) · [Transcripts](#transcripts) · [Limits](#limits)

</div>

## Install

You need `yt-dlp` on your `PATH`, plus `ffmpeg` to merge video and audio into mp4. The nixpkgs `yt-dlp` package already bundles ffmpeg.

```sh
omp plugin marketplace add Syncriix/omp-plugins
omp plugin install youtube@syncriix
```

**Restart OMP** to load the extension module.

## Usage

Share a link and ask for what you want: "summarize this talk", "what does she say about caching?", "download this one". The bundled `yt` skill (`/skill:yt`) steers the agent to the `youtube_download` tool.

Any single-video link works: `watch?v=`, `youtu.be/`, `shorts/`, `live/`, `embed/`, `m.` and `music.` hosts, `youtube-nocookie.com`, links carrying `t=` or `list=`, or a bare 11-character video id. The tool can't search YouTube; without a link, the skill has the agent ask for one or find candidates with web search for you to confirm.

`youtube_download` parameters:

| Parameter | Default | Meaning |
| --- | --- | --- |
| `url` | required | Video link or id. Playlist and channel URLs are rejected. |
| `video` | `false` | `true` also downloads the video: mp4, H.264 where available, at most 1080p. |
| `languages` | spoken language | Override subtitle languages in yt-dlp's `--sub-langs` syntax, such as `"de,en"`. |
| `dir` | `~/downloads/youtube` | Output directory. `~` expands; relative paths resolve against the working directory. |

Files are named `<title> [<video id>] [<omp session id>].<ext>`, so each download traces back to the session that fetched it. The transcript is `….<lang>.txt`; with `video: true`, the `.mp4` and the raw `.vtt` subtitles sit beside it.

## Transcripts

The tool first reads the video's metadata and picks the track in the language the video is spoken in: a manual caption track if one exists, otherwise YouTube's original auto-generated track (`-orig`, never a machine translation). If neither exists, it falls back to English.

Auto-captions roll: each cue repeats the previous line, words carry timing tags, and short filler cues repeat the text once more. The plugin keeps each line once, then joins lines into paragraphs that end at the first sentence end after about 30 seconds (or at 45 seconds without punctuation). Each paragraph is stamped with when it starts:

```text
[0:00] Stress ist eine uralte Superkraft, die dich langsam umbringt. Er entstand als eines der mächtigsten Werkzeuge zum Überleben, …

[0:32] [musik] Um ihn aufrecht zu erhalten, nehmen sie Anpassungen vor, …
```

## Limits

- **One video per call, no search.** Playlists, channels and search strings are rejected.
- **No subtitles, no transcript.** A transcript-only request for a video without subtitles is reported as an error.
- **Blocking download.** The tool returns after yt-dlp finishes, with no progress updates; cancelling the tool call stops yt-dlp.
- **Format is fixed.** The mp4/1080p choice is passed explicitly, so it overrides the format settings in your yt-dlp config file.
- **Verified with** OMP 18.15.0 and yt-dlp 2026.08.19 on NixOS (WSL). Other versions and operating systems were not runtime-tested.

## Development

```sh
node --test plugins/youtube/test/*.test.ts
```

Track selection ([`src/languages.ts`](src/languages.ts)) and VTT conversion ([`src/transcript.ts`](src/transcript.ts)) live apart from the OMP entry point, so they can be tested without OMP or yt-dlp.

## License

[BEERWARE-MIT](LICENSE): Beerware with the MIT warranty disclaimer.
