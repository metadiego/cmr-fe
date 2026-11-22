import { test } from "node:test";
import assert from "node:assert/strict";

import { summarizeUserAgent } from "./user-agent.ts";

const CHROME_WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const SAFARI_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
const EDGE_WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0";
const SAFARI_IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

test("summarizes common desktop user agents", () => {
  assert.equal(summarizeUserAgent(CHROME_WINDOWS), "Chrome · Windows");
  assert.equal(summarizeUserAgent(SAFARI_MAC), "Safari · macOS");
});

test("picks Edge over the Chrome token it also carries", () => {
  assert.equal(summarizeUserAgent(EDGE_WINDOWS), "Edge · Windows");
});

test("detects a mobile OS", () => {
  assert.equal(summarizeUserAgent(SAFARI_IPHONE), "Safari · iOS");
});

test("falls back to a dash for missing or unrecognized values", () => {
  assert.equal(summarizeUserAgent(null), "—");
  assert.equal(summarizeUserAgent(""), "—");
  assert.equal(summarizeUserAgent("some-weird-bot/1.0"), "—");
});
