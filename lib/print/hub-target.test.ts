import { test } from "node:test";
import assert from "node:assert/strict";
import { buildHubDiscoverUrl, buildHubRequestUrl, hubOrigin } from "./hub-target.ts";

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
  assert.equal(u.searchParams.get("protocol"), "ipp");
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

test("windows target travels as protocol smb with its share name", () => {
  const u = new URL(buildHubRequestUrl({ ...full, protocol: "smb", printerPort: 445, printerQueue: "EPSON-CONSULTA" })!);
  assert.equal(u.searchParams.get("protocol"), "smb");
  assert.equal(u.searchParams.get("port"), "445");
  assert.equal(u.searchParams.get("queue"), "EPSON-CONSULTA");
});

test("unknown protocol is rejected", () => {
  assert.equal(buildHubRequestUrl({ ...full, protocol: "ftp" as never }), null);
});

test("hubOrigin: scheme+host+port only, null when invalid", () => {
  assert.equal(hubOrigin("https://192.130.80.172:8943/print-raw"), "https://192.130.80.172:8943");
  assert.equal(hubOrigin(""), null);
  assert.equal(hubOrigin("nope"), null);
});

test("discover url: hub origin + /discover?host=", () => {
  const u = new URL(buildHubDiscoverUrl("https://192.130.80.172:8943/print-raw", " 192.130.80.181 ")!);
  assert.equal(u.origin + u.pathname, "https://192.130.80.172:8943/discover");
  assert.equal(u.searchParams.get("host"), "192.130.80.181");
  assert.equal(buildHubDiscoverUrl("https://192.130.80.172:8943/print-raw", ""), null);
  assert.equal(buildHubDiscoverUrl("", "192.130.80.181"), null);
});
