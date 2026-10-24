/**
 * @uptexx/srt-vtt-subtitles
 * Millisecond-accurate .SRT and WebVTT (.vtt) subtitle generator, parser,
 * time-shift synchronizer, and Deepgram/Whisper word-timestamp formatter.
 *
 * Built by Uptexx (https://uptexx.com) — Powered by NexoPost (https://nexopost.com)
 */

export interface UtteranceInput {
  start: number;
  end: number;
  text?: string;
  word?: string;
  punctuated_word?: string;
}

export interface SubtitleOptions {
  unit?: "auto" | "seconds" | "ms";
  maxWordsPerCue?: number;
  maxCharsPerLine?: number;
  includeCueNumbers?: boolean;
}

export interface SubtitleCue {
  index: number;
  startMs: number;
  endMs: number;
  startFormatted: string;
  endFormatted: string;
  text: string;
}

export function formatTimestampMs(ms: number, separator: "," | "." = ","): string {
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

export function parseTimestampToMs(timestamp: string): number {
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

function normalizeUtterances(
  utterances: UtteranceInput[],
  options: SubtitleOptions = {}
): Array<{ startMs: number; endMs: number; text: string }> {
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

  const grouped: Array<{ startMs: number; endMs: number; text: string }> = [];
  let current: { startMs: number; endMs: number; text: string } | null = null;
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

export function utterancesToSrt(
  utterances: UtteranceInput[],
  options: SubtitleOptions = {}
): string {
  const cues = normalizeUtterances(utterances, options);
  if (cues.length === 0) {
    return "";
  }

  return (
    cues
      .map((cue, idx) => {
        const startFormatted = formatTimestampMs(cue.startMs, ",");
        const endFormatted = formatTimestampMs(cue.endMs, ",");
        return `${idx + 1}\n${startFormatted} --> ${endFormatted}\n${cue.text}`;
      })
      .join("\n\n") + "\n"
  );
}

export function utterancesToVtt(
  utterances: UtteranceInput[],
  options: SubtitleOptions = {}
): string {
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

export function parseSrt(srtString: string): SubtitleCue[] {
  if (typeof srtString !== "string") {
    throw new TypeError("srtString must be a string.");
  }

  const normalized = srtString.replace(/\r\n/g, "\n").replace(/^\uFEFF/, "").trim();
  if (!normalized) {
    return [];
  }

  const blocks = normalized.split(/\n{2,}/);
  const cues: SubtitleCue[] = [];

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

export function shiftSubtitleTimings(
  cues: Array<Partial<SubtitleCue> & { startMs: number; endMs: number; text: string }>,
  offsetMs: number
): SubtitleCue[] {
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
