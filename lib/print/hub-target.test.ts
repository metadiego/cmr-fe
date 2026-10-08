import { test } from "node:test";
import assert from "node:assert/strict";
import { buildHubRequestUrl } from "./hub-target.ts";

const full = {
  url: "https://192.130.80.172:8943/print-raw",
  printerHost: "192.130.80.181",
  printerPort: 631,
  printerQueue: "TM-T20II-RAW",
};

test("full target: hub url carries the printer as query params", () => {
  const u = new URL(buildHubRequestUrl(full)!);
  assert.equal(u.origin + u.pathname, "https://192.130.80.172:8943/print-raw");
  assert.equal(u.searchParams.get("host"), "192.130.80.181");
  assert.equal(u.searchParams.get("port"), "631");
  assert.equal(u.searchParams.get("queue"), "TM-T20II-RAW");
});

test("same hub, different printer per center: each URL points at its own printer", () => {
  const caguas = buildHubRequestUrl(full)!;
  const bayamon = buildHubRequestUrl({ ...full, printerHost: "192.130.81.20", printerQueue: "BAY-CONSULTA" })!;
  assert.notEqual(caguas, bayamon);
  assert.equal(new URL(bayamon).searchParams.get("host"), "192.130.81.20");
});

test("missing any piece returns null (never guess a printer)", () => {
  assert.equal(buildHubRequestUrl(undefined), null);
  assert.equal(buildHubRequestUrl(null), null);
  assert.equal(buildHubRequestUrl({ ...full, url: "" }), null);
  assert.equal(buildHubRequestUrl({ ...full, printerHost: "  " }), null);
  assert.equal(buildHubRequestUrl({ ...full, printerPort: "" }), null);
  assert.equal(buildHubRequestUrl({ ...full, printerQueue: undefined }), null);
});

test("port as string is accepted; non-numeric port is rejected", () => {
  assert.ok(buildHubRequestUrl({ ...full, printerPort: "631" }));
  assert.equal(buildHubRequestUrl({ ...full, printerPort: "63a" }), null);
});

test("invalid or non-http hub url is rejected", () => {
  assert.equal(buildHubRequestUrl({ ...full, url: "not a url" }), null);
  assert.equal(buildHubRequestUrl({ ...full, url: "ftp://x/print-raw" }), null);
});

test("values are trimmed and encoded", () => {
  const u = new URL(buildHubRequestUrl({ ...full, printerHost: " 192.130.80.181 ", printerQueue: "A B" })!);
  assert.equal(u.searchParams.get("host"), "192.130.80.181");
  assert.equal(u.searchParams.get("queue"), "A B");
});
