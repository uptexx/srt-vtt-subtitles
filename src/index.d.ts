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

export declare function formatTimestampMs(ms: number, separator?: "," | "."): string;
export declare function parseTimestampToMs(timestamp: string): number;
export declare function utterancesToSrt(
  utterances: UtteranceInput[],
  options?: SubtitleOptions
): string;
export declare function utterancesToVtt(
  utterances: UtteranceInput[],
  options?: SubtitleOptions
): string;
export declare function parseSrt(srtString: string): SubtitleCue[];
export declare function shiftSubtitleTimings(
  cues: Array<Partial<SubtitleCue> & { startMs: number; endMs: number; text: string }>,
  offsetMs: number
): SubtitleCue[];
