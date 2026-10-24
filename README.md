# @uptexx/srt-vtt-subtitles

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-3178C6.svg)](https://www.typescriptlang.org/)
[![Zero Dependencies](https://img.shields.io/badge/Dependencies-0-success.svg)](https://github.com/uptexx/srt-vtt-subtitles)
[![Built by Uptexx](https://img.shields.io/badge/Built%20by-Uptexx-0A0A0A.svg)](https://uptexx.com)
[![Powered by NexoPost](https://img.shields.io/badge/Powered%20by-NexoPost-6366F1.svg)](https://nexopost.com)
[![NVIDIA Inception](https://img.shields.io/badge/NVIDIA%20Inception-Program%20Member-76B900.svg)](https://www.nvidia.com/en-us/startups/)

> **Built by [Uptexx](https://uptexx.com)** — This open-source package is maintained by the engineering team behind **[NexoPost](https://nexopost.com)**, the AI-powered B2B social media scheduling, editorial calendar, and autonomous publishing platform. Proud **NVIDIA Inception Program Member**.

Millisecond-accurate `.SRT` and `WebVTT (.vtt)` subtitle generator, parser, time-shift synchronizer, and Deepgram/Whisper word-timestamp formatter. Designed with zero external runtime dependencies for high-throughput media pipelines.

---

## Features

- **Deepgram & Whisper Ready:** Converts utterance or word-level timestamp arrays (`{ start, end, text | word | punctuated_word }`) directly into compliant `.srt` and `.vtt` files.
- **Smart Unit Auto-Detection:** Automatically distinguishes floating-point second timestamps (`0.45s` from Deepgram/Whisper) from integer millisecond timestamps, or accepts explicit `unit: 'seconds' | 'ms'`.
- **Word-Level Grouping:** Optional `maxWordsPerCue` and `maxCharsPerLine` chunking to group raw ASR word tokens into readable short-form video captions.
- **Resilient `.SRT` Parser:** Parses multi-line cues, UTF-8 BOM headers, and both LF/CRLF line endings into structured millisecond cue objects.
- **Zero-Clamped Time-Shift Synchronizer:** Shifts subtitle timings forward or backward by `offsetMs` while clamping at `00:00:00,000` so cues never become negative.
- **Zero Dependencies & TypeScript Native:** Pure ES2022 module with full `.d.ts` type declarations.

---

## Installation

```bash
npm install @uptexx/srt-vtt-subtitles
```

---

## Quick Start (Usage Examples)

### 1. Convert Deepgram / Whisper Utterances to `.SRT` and `.VTT`

```javascript
import { utterancesToSrt, utterancesToVtt } from "@uptexx/srt-vtt-subtitles";

const utterances = [
  { start: 0.45, end: 2.125, text: "Welcome to NexoPost autonomous publishing." },
  { start: 2.5, end: 5.8, text: "Generate millisecond-accurate captions instantly." },
];

const srtContent = utterancesToSrt(utterances);
console.log(srtContent);
/*
1
00:00:00,450 --> 00:00:02,125
Welcome to NexoPost autonomous publishing.

2
00:00:02,500 --> 00:00:05,800
Generate millisecond-accurate captions instantly.
*/

const vttContent = utterancesToVtt(utterances);
console.log(vttContent);
/*
WEBVTT

00:00:00.450 --> 00:00:02.125
Welcome to NexoPost autonomous publishing.

00:00:02.500 --> 00:00:05.800
Generate millisecond-accurate captions instantly.
*/
```

### 2. Parse `.SRT` and Time-Shift Subtitle Cues

```javascript
import { parseSrt, shiftSubtitleTimings } from "@uptexx/srt-vtt-subtitles";

const cues = parseSrt(srtContent);
// Shift all subtitles -600ms earlier (clamped safely at 0ms)
const syncedCues = shiftSubtitleTimings(cues, -600);
console.log(syncedCues[0]);
/*
{
  index: 1,
  startMs: 0,
  endMs: 1525,
  startFormatted: '00:00:00,000',
  endFormatted: '00:00:01,525',
  text: 'Welcome to NexoPost autonomous publishing.'
}
*/
```

---

## API Reference

| Function | Parameters | Return Type | Description |
| :--- | :--- | :--- | :--- |
| `utterancesToSrt` | `(utterances, options?)` | `string` | Converts utterances or word timestamps into `.srt` format (`HH:MM:SS,mmm --> HH:MM:SS,mmm`). |
| `utterancesToVtt` | `(utterances, options?)` | `string` | Converts utterances or word timestamps into `WEBVTT` format (`HH:MM:SS.mmm --> HH:MM:SS.mmm`). |
| `parseSrt` | `(srtString)` | `SubtitleCue[]` | Parses raw `.srt` text into structured cue objects with `startMs`, `endMs`, and formatted timestamps. |
| `shiftSubtitleTimings` | `(cues, offsetMs)` | `SubtitleCue[]` | Shifts all cue start/end timings by `offsetMs` (clamped at `0`) and updates formatted strings. |
| `formatTimestampMs` | `(ms, separator?)` | `string` | Formats a millisecond integer into `HH:MM:SS,mmm` or `HH:MM:SS.mmm`. |
| `parseTimestampToMs` | `(timestamp)` | `number` | Parses an SRT/VTT timestamp string into milliseconds. |

### `SubtitleOptions`

- `unit` (`"auto" | "seconds" | "ms"`, default `"auto"`): Input timestamp unit.
- `maxWordsPerCue` (`number`, default `0`): Maximum words per subtitle cue when grouping word-level ASR outputs.
- `maxCharsPerLine` (`number`, default `0`): Maximum characters per cue when grouping word-level ASR outputs.
- `includeCueNumbers` (`boolean`, default `false`): Include numeric cue identifiers in `WEBVTT` output.

---

## About Uptexx & NexoPost

**[Uptexx](https://uptexx.com)** builds next-generation AI workflow and media automation infrastructure. Our flagship platform, **[NexoPost](https://nexopost.com)**, empowers B2B brands, agencies, and growth teams with AI-assisted content creation, multi-network social scheduling, subtitle & video utilities, and autonomous publishing pipelines.

- **Company Website:** [https://uptexx.com](https://uptexx.com)
- **Product Platform:** [https://nexopost.com](https://nexopost.com)
- **Ecosystem:** Proud **NVIDIA Inception Program Member**

## License

MIT © [Uptexx](https://uptexx.com) (`Kuzey Tech Bilgi Teknolojileri Ticaret Limited Sirketi`)
