---
name: yt
description: Use when the user shares a YouTube link (youtube.com watch/shorts/live/embed, youtu.be, m./music. hosts, youtube-nocookie, or a bare video id) or asks to download, watch, summarize, quote, or search inside a video.
---

# YouTube

Use the `youtube_download` tool for any video link form; don't hand-roll `yt-dlp`.

- It needs a link or 11-character id; it can't search YouTube. No link? Ask for one, or find candidates with web search and let the user confirm before fetching.
- It fetches the transcript only by default. Pass `video: true` only when the user wants the file.
- Then `read` the returned `.txt`: paragraphs stamped `[m:ss]` about every 30 s. Cite stamps when quoting.
- Subtitles come in the language spoken in the video, else English. Pass `languages` only when the user asks for another.
- Playlist or channel link? Ask which video. No subtitles? Say so; don't guess the content.
- Files go to `~/downloads/youtube` unless the user names a `dir`.
