---
name: yt
description: Use when the user shares a YouTube link or id (youtube.com watch/shorts/live/embed, youtu.be, m./music. hosts, youtube-nocookie) or asks to download, summarize, quote, or answer questions about a video.
---

- Tool: `youtube_download`. If it is not in your tool list, it is a device: call the `read` tool with path `xd://youtube_download` for the schema, then the `write` tool with path `xd://youtube_download` and the JSON args as `content`. Never call `yt-dlp` directly.
- Input: one video link or id. No search. No link: ask the user, or find candidates with web search and confirm one with the user before fetching.
- `video: true` only when the user wants the file; otherwise leave it out.
- Result: `key: value` metadata with `transcript_file` and `transcript_size`; the text is never inline. Summary: read it whole (by line ranges if large). One quote or fact: grep it.
- Transcript lines are `[m:ss]` paragraphs; cite stamps when quoting. With `subtitles: … auto-generated`, flag uncertain names and terms.
- Error or no subtitles: report it. Never fill in a video's content from its title or memory.
