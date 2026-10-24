/**
 * @uptexx/srt-vtt-subtitles
 * Millisecond-accurate .SRT and WebVTT (.vtt) subtitle generator, parser,
 * time-shift synchronizer, and Deepgram/Whisper word-timestamp formatter.
 *
 * Built by Uptexx (https://uptexx.com) — Powered by NexoPost (https://nexopost.com)
 */

/**
 * Formats milliseconds into HH:MM:SS,mmm (SRT) or HH:MM:SS.mmm (WebVTT).
 * @param {number} ms - Time in milliseconds (clamped to >= 0).
 * @param {string} [separator=","] - Decimal separator ("," for SRT, "." for VTT).
 * @returns {string} Formatted timestamp string.
 */
export function formatTimestampMs(ms, separator = ",") {
  const safeMs = Math.max(0, Math.round(Number(ms) || 0));
  const hours = Math.floor(safeMs / 3600000);
  const minutes = Math.floor((safeMs % 3600000) / 60000);
  const seconds = Math.floor((safeMs % 60000) / 1000);
  const millis = safeMs % 1000;

  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  const mmm = String(millis).padStart(3, "0");

  return `${hh}:${mm}:${ss}${separator}${mmm}`;
}

/**
 * Parses an SRT or VTT timestamp string (HH:MM:SS,mmm or HH:MM:SS.mmm or MM:SS.mmm) into milliseconds.
 * @param {string} timestamp - Formatted timestamp string.
 * @returns {number} Time in milliseconds.
 */
export function parseTimestampToMs(timestamp) {
  if (typeof timestamp !== "string") {
    throw new TypeError("Timestamp must be a string.");
  }
  const clean = timestamp.trim();
  const match = clean.match(/^(?:(\d{1,3}):)?(\d{1,2}):(\d{1,2})[,.](\d{1,3})$/);
  if (!match) {
    throw new Error(`Invalid subtitle timestamp format: "${timestamp}"`);
  }
  const hours = match[1] ? parseInt(match[1], 10) : 0;
  const minutes = parseInt(match[2], 10);
  const seconds = parseInt(match[3], 10);
  const millisStr = match[4].padEnd(3, "0");
  const millis = parseInt(millisStr, 10);

  return hours * 3600000 + minutes * 60000 + seconds * 1000 + millis;
}

/**
 * Resolves utterance start/end values to milliseconds based on unit option or auto-detection.
 * @param {Array<{start: number, end: number, text?: string, word?: string, punctuated_word?: string}>} utterances
 * @param {object} [options]
 * @param {"auto"|"seconds"|"ms"} [options.unit="auto"]
 * @param {number} [options.maxCharsPerLine=0]
 * @param {number} [options.maxWordsPerCue=0]
 * @returns {Array<{startMs: number, endMs: number, text: string}>}
 */
function normalizeUtterances(utterances, options = {}) {
  if (!Array.isArray(utterances)) {
    throw new TypeError("utterances must be an array.");
  }
  if (utterances.length === 0) {
    return [];
  }

  const unit = options.unit || "auto";
  let isSeconds = unit === "seconds";

  if (unit === "auto") {
    const hasDecimal = utterances.some(
      (u) => !Number.isInteger(u.start) || !Number.isInteger(u.end)
    );
    const maxEnd = Math.max(...utterances.map((u) => Number(u.end) || 0));
    // If any value is a float or maxEnd is <= 1000 (unless all durations are >= 100), treat as seconds
    const minDuration = Math.min(
      ...utterances.map((u) => Math.max(0, (Number(u.end) || 0) - (Number(u.start) || 0)))
    );
    if (hasDecimal || (maxEnd <= 3600 && minDuration < 50)) {
      isSeconds = true;
    } else {
      isSeconds = false;
    }
  }

  const rawItems = utterances
    .map((u) => {
      const rawText = (u.punctuated_word ?? u.text ?? u.word ?? "").toString().trim();
      const startVal = Number(u.start) || 0;
      const endVal = Number(u.end) || 0;
      const startMs = Math.max(0, Math.round(isSeconds ? startVal * 1000 : startVal));
      const endMs = Math.max(startMs, Math.round(isSeconds ? endVal * 1000 : endVal));
      return { startMs, endMs, text: rawText };
    })
    .filter((u) => u.text.length > 0);

  const maxWordsPerCue = Number(options.maxWordsPerCue) || 0;
  const maxCharsPerLine = Number(options.maxCharsPerLine) || 0;

  if (maxWordsPerCue <= 0 && maxCharsPerLine <= 0) {
    return rawItems;
  }

  // Group word-level timestamps into readable subtitle cues if requested
  const grouped = [];
  let current = null;
  let wordCount = 0;

  for (const item of rawItems) {
    const itemWords = item.text.split(/\s+/).length;
    if (!current) {
      current = { startMs: item.startMs, endMs: item.endMs, text: item.text };
      wordCount = itemWords;
      continue;
    }

    const candidateText = `${current.text} ${item.text}`;
    const exceedsWords = maxWordsPerCue > 0 && wordCount + itemWords > maxWordsPerCue;
    const exceedsChars = maxCharsPerLine > 0 && candidateText.length > maxCharsPerLine;

    if (exceedsWords || exceedsChars) {
      grouped.push(current);
      current = { startMs: item.startMs, endMs: item.endMs, text: item.text };
      wordCount = itemWords;
    } else {
      current.endMs = Math.max(current.endMs, item.endMs);
      current.text = candidateText;
      wordCount += itemWords;
    }
  }

  if (current) {
    grouped.push(current);
  }

  return grouped;
}

/**
 * Converts an array of utterances or word-timestamps (e.g., from Deepgram or Whisper)
 * into a valid SubRip (.srt) string with `HH:MM:SS,mmm --> HH:MM:SS,mmm` timestamps.
 *
 * @param {Array<{start: number, end: number, text?: string, word?: string, punctuated_word?: string}>} utterances
 * @param {object} [options]
 * @param {"auto"|"seconds"|"ms"} [options.unit="auto"] - Timestamp unit of input utterances.
 * @param {number} [options.maxWordsPerCue=0] - Optional max words per cue for word-level grouping.
 * @param {number} [options.maxCharsPerLine=0] - Optional max characters per cue for word-level grouping.
 * @returns {string} Valid .srt formatted string.
 */
export function utterancesToSrt(utterances, options = {}) {
  const cues = normalizeUtterances(utterances, options);
  if (cues.length === 0) {
    return "";
  }

  return cues
    .map((cue, idx) => {
      const startFormatted = formatTimestampMs(cue.startMs, ",");
      const endFormatted = formatTimestampMs(cue.endMs, ",");
      return `${idx + 1}\n${startFormatted} --> ${endFormatted}\n${cue.text}`;
    })
    .join("\n\n") + "\n";
}

/**
 * Converts an array of utterances or word-timestamps into a valid WebVTT (.vtt) string
 * starting with `WEBVTT` and `HH:MM:SS.mmm --> HH:MM:SS.mmm` timestamps.
 *
 * @param {Array<{start: number, end: number, text?: string, word?: string, punctuated_word?: string}>} utterances
 * @param {object} [options]
 * @param {"auto"|"seconds"|"ms"} [options.unit="auto"] - Timestamp unit of input utterances.
 * @param {number} [options.maxWordsPerCue=0] - Optional max words per cue for word-level grouping.
 * @param {number} [options.maxCharsPerLine=0] - Optional max characters per cue for word-level grouping.
 * @param {boolean} [options.includeCueNumbers=false] - Whether to include numeric cue identifiers.
 * @returns {string} Valid WebVTT formatted string.
 */
export function utterancesToVtt(utterances, options = {}) {
  const cues = normalizeUtterances(utterances, options);
  if (cues.length === 0) {
    return "WEBVTT\n";
  }

  const blocks = cues.map((cue, idx) => {
    const startFormatted = formatTimestampMs(cue.startMs, ".");
    const endFormatted = formatTimestampMs(cue.endMs, ".");
    const prefix = options.includeCueNumbers ? `${idx + 1}\n` : "";
    return `${prefix}${startFormatted} --> ${endFormatted}\n${cue.text}`;
  });

  return `WEBVTT\n\n${blocks.join("\n\n")}\n`;
}

/**
 * Parses an .SRT string into a structured array of subtitle cues.
 *
 * @param {string} srtString - Raw .srt file content.
 * @returns {Array<{index: number, startMs: number, endMs: number, startFormatted: string, endFormatted: string, text: string}>}
 */
export function parseSrt(srtString) {
  if (typeof srtString !== "string") {
    throw new TypeError("srtString must be a string.");
  }

  const normalized = srtString.replace(/\r\n/g, "\n").replace(/^\uFEFF/, "").trim();
  if (!normalized) {
    return [];
  }

  const blocks = normalized.split(/\n{2,}/);
  const cues = [];

  for (const block of blocks) {
    const lines = block.split("\n").map((l) => l.trimEnd());
    if (lines.length < 2) continue;

    let timeLineIdx = 0;
    let parsedIndex = cues.length + 1;

    if (/^\d+$/.test(lines[0].trim())) {
      parsedIndex = parseInt(lines[0].trim(), 10);
      timeLineIdx = 1;
    }

    const timeLine = lines[timeLineIdx];
    if (!timeLine || !timeLine.includes("-->")) continue;

    const [rawStart, rawEndWithSettings] = timeLine.split("-->").map((s) => s.trim());
    const rawEnd = rawEndWithSettings.split(/\s+/)[0];

    const startMs = parseTimestampToMs(rawStart);
    const endMs = parseTimestampToMs(rawEnd);
    const text = lines.slice(timeLineIdx + 1).join("\n").trim();

    cues.push({
      index: parsedIndex,
      startMs,
      endMs,
      startFormatted: formatTimestampMs(startMs, ","),
      endFormatted: formatTimestampMs(endMs, ","),
      text,
    });
  }

  return cues;
}

/**
 * Shifts all cue start/end timings by `offsetMs` (positive or negative),
 * clamping at `0` so timings never become negative, and updates formatted timestamps.
 *
 * @param {Array<{index?: number, startMs: number, endMs: number, startFormatted?: string, endFormatted?: string, text: string}>} cues
 * @param {number} offsetMs - Milliseconds to shift (e.g. 500 or -1200).
 * @returns {Array<{index: number, startMs: number, endMs: number, startFormatted: string, endFormatted: string, text: string}>}
 */
export function shiftSubtitleTimings(cues, offsetMs) {
  if (!Array.isArray(cues)) {
    throw new TypeError("cues must be an array.");
  }
  const delta = Math.round(Number(offsetMs) || 0);

  return cues.map((cue, idx) => {
    const startMs = Math.max(0, Math.round(Number(cue.startMs) || 0) + delta);
    const endMs = Math.max(startMs, Math.max(0, Math.round(Number(cue.endMs) || 0) + delta));

    return {
      index: typeof cue.index === "number" ? cue.index : idx + 1,
      startMs,
      endMs,
      startFormatted: formatTimestampMs(startMs, ","),
      endFormatted: formatTimestampMs(endMs, ","),
      text: cue.text ?? "",
    };
  });
}
