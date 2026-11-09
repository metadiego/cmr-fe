import { test } from "node:test";
import assert from "node:assert/strict";

import { escposToStarLine } from "./star-line.ts";

const ESC = 0x1b;
const GS = 0x1d;

test("init (ESC @) passes through unchanged", () => {
  assert.deepEqual([...escposToStarLine(Uint8Array.from([ESC, 0x40]))], [ESC, 0x40]);
});

test("code page PC850 (ESC t 2) becomes Star's PC858 behind GS", () => {
  assert.deepEqual([...escposToStarLine(Uint8Array.from([ESC, 0x74, 2]))], [ESC, GS, 0x74, 4]);
});

test("code page other than PC850 is passed on as is, only wrapped with GS", () => {
  assert.deepEqual([...escposToStarLine(Uint8Array.from([ESC, 0x74, 5]))], [ESC, GS, 0x74, 5]);
});

test("align (ESC a n) becomes Star's ESC GS a n", () => {
  assert.deepEqual([...escposToStarLine(Uint8Array.from([ESC, 0x61, 1]))], [ESC, GS, 0x61, 1]);
});

test("bold on (ESC E 1) and off (ESC E 0) use Star's own on/off bytes", () => {
  assert.deepEqual([...escposToStarLine(Uint8Array.from([ESC, 0x45, 1]))], [ESC, 0x45]);
  assert.deepEqual([...escposToStarLine(Uint8Array.from([ESC, 0x45, 0]))], [ESC, 0x46]);
});

test("font size (GS ! n) swaps ESC/POS's packed nibble for Star's ESC i height width", () => {
  // high nibble = width - 1, low nibble = height - 1: 0x11 means width 2, height 2.
  assert.deepEqual([...escposToStarLine(Uint8Array.from([GS, 0x21, 0x11]))], [ESC, 0x69, 0x01, 0x01]);
});

test("feed (ESC J n) converts 1/8mm dots to Star's quarter-millimetres, never below 1", () => {
  assert.deepEqual([...escposToStarLine(Uint8Array.from([ESC, 0x4a, 4]))], [ESC, 0x4a, 2]);
  assert.deepEqual([...escposToStarLine(Uint8Array.from([ESC, 0x4a, 0]))], [ESC, 0x4a, 1], "rounds to 1, never 0");
});

test("full cut (GS V 65 n) becomes Star's ESC d 3", () => {
  assert.deepEqual([...escposToStarLine(Uint8Array.from([GS, 0x56, 0x41, 0x00]))], [ESC, 0x64, 3]);
});

test("the raster logo (GS v 0 ...) has no Star equivalent and is dropped, data included", () => {
  // m=0, xL=1, xH=0 (1 byte per row), yL=1, yH=0 (1 row), then 1 byte of pixel data.
  const header = [GS, 0x76, 0x30, 0, 1, 0, 1, 0];
  const out = escposToStarLine(Uint8Array.from([...header, 0xff, ESC, 0x40]));
  assert.deepEqual([...out], [ESC, 0x40], "the image bytes vanish; what follows still comes through");
});

test("a byte sequence with no translation (plain text) passes through untouched", () => {
  const text = Uint8Array.from(Buffer.from("Café 123"));
  assert.deepEqual([...escposToStarLine(text)], [...text]);
});

test("a whole short ticket: init, bold, text, cut — each piece translated in place", () => {
  const ticket = Uint8Array.from([ESC, 0x40, ESC, 0x45, 1, ...Buffer.from("Hola"), ESC, 0x45, 0, GS, 0x56, 0x41, 0]);
  const out = escposToStarLine(ticket);
  assert.deepEqual([...out], [ESC, 0x40, ESC, 0x45, ...Buffer.from("Hola"), ESC, 0x46, ESC, 0x64, 3]);
});
