import test from "node:test";
import assert from "node:assert/strict";
import {
  utterancesToSrt,
  utterancesToVtt,
  parseSrt,
  shiftSubtitleTimings,
  formatTimestampMs,
  parseTimestampToMs,
} from "../src/index.mjs";

test("utterancesToSrt converts Deepgram/Whisper float seconds to valid .SRT", () => {
  const utterances = [
    { start: 0.45, end: 2.125, text: "Welcome to NexoPost autonomous publishing." },
    { start: 2.5, end: 5.8, text: "Generate millisecond-accurate captions instantly." },
  ];

  const srt = utterancesToSrt(utterances);
  assert.ok(srt.includes("1\n00:00:00,450 --> 00:00:02,125\nWelcome to NexoPost autonomous publishing."));
  assert.ok(srt.includes("2\n00:00:02,500 --> 00:00:05,800\nGenerate millisecond-accurate captions instantly."));
});

test("utterancesToSrt supports explicit ms unit and multi-hour timestamps", () => {
  const utterances = [
    { start: 3661005, end: 3665999, text: "One hour, one minute, one second." },
  ];

  const srt = utterancesToSrt(utterances, { unit: "ms" });
  assert.equal(
    srt,
    "1\n01:01:01,005 --> 01:01:05,999\nOne hour, one minute, one second.\n"
  );
});

test("utterancesToSrt groups word-level timestamps by maxWordsPerCue", () => {
  const words = [
    { start: 0.0, end: 0.3, punctuated_word: "Automate" },
    { start: 0.3, end: 0.6, punctuated_word: "your" },
    { start: 0.6, end: 1.0, punctuated_word: "social" },
    { start: 1.0, end: 1.4, punctuated_word: "media" },
    { start: 1.4, end: 1.9, punctuated_word: "workflow." },
  ];

  const srt = utterancesToSrt(words, { maxWordsPerCue: 3 });
  const parsed = parseSrt(srt);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].text, "Automate your social");
  assert.equal(parsed[0].startMs, 0);
  assert.equal(parsed[0].endMs, 1000);
  assert.equal(parsed[1].text, "media workflow.");
  assert.equal(parsed[1].startMs, 1000);
  assert.equal(parsed[1].endMs, 1900);
});

test("utterancesToVtt generates valid WEBVTT format with period decimal separator", () => {
  const utterances = [
    { start: 1.2, end: 3.456, text: "First WebVTT caption block." },
  ];

  const vtt = utterancesToVtt(utterances);
  assert.ok(vtt.startsWith("WEBVTT\n\n"));
  assert.ok(vtt.includes("00:00:01.200 --> 00:00:03.456\nFirst WebVTT caption block."));
});

test("parseSrt parses multi-line cues and CRLF line endings accurately", () => {
  const rawSrt =
    "1\r\n00:00:01,000 --> 00:00:04,250\r\nLine one of subtitle\r\nLine two of subtitle\r\n\r\n2\r\n00:00:05,000 --> 00:00:07,500\r\nSecond cue here\r\n";

  const cues = parseSrt(rawSrt);
  assert.equal(cues.length, 2);
  assert.deepEqual(cues[0], {
    index: 1,
    startMs: 1000,
    endMs: 4250,
    startFormatted: "00:00:01,000",
    endFormatted: "00:00:04,250",
    text: "Line one of subtitle\nLine two of subtitle",
  });
  assert.equal(cues[1].index, 2);
  assert.equal(cues[1].startMs, 5000);
  assert.equal(cues[1].endMs, 7500);
});

test("shiftSubtitleTimings shifts forward and clamps negative offsets at zero", () => {
  const cues = parseSrt(
    "1\n00:00:00,500 --> 00:00:02,000\nIntro text\n\n2\n00:00:03,000 --> 00:00:05,000\nMain point\n"
  );

  const shiftedForward = shiftSubtitleTimings(cues, 1500);
  assert.equal(shiftedForward[0].startMs, 2000);
  assert.equal(shiftedForward[0].endMs, 3500);
  assert.equal(shiftedForward[0].startFormatted, "00:00:02,000");

  const shiftedNegative = shiftSubtitleTimings(cues, -1000);
  assert.equal(shiftedNegative[0].startMs, 0);
  assert.equal(shiftedNegative[0].endMs, 1000);
  assert.equal(shiftedNegative[0].startFormatted, "00:00:00,000");
  assert.equal(shiftedNegative[0].endFormatted, "00:00:01,000");
  assert.equal(shiftedNegative[1].startMs, 2000);
  assert.equal(shiftedNegative[1].endMs, 4000);
});

test("formatTimestampMs and parseTimestampToMs roundtrip accurately", () => {
  const ms = 7543210;
  const srtFormatted = formatTimestampMs(ms, ",");
  const vttFormatted = formatTimestampMs(ms, ".");
  assert.equal(parseTimestampToMs(srtFormatted), ms);
  assert.equal(parseTimestampToMs(vttFormatted), ms);
});

test("handles empty input arrays and empty SRT strings gracefully", () => {
  assert.equal(utterancesToSrt([]), "");
  assert.equal(utterancesToVtt([]), "WEBVTT\n");
  assert.deepEqual(parseSrt("   "), []);
});
