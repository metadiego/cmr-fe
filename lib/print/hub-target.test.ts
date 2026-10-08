import { test } from "node:test";
import assert from "node:assert/strict";
import { buildHubDiscoverUrl, buildHubRequestUrl, buildHubRequestUrls, hubOrigin, hubStatusUrl } from "./hub-target.ts";

const CENTRAL = "https://192.130.80.172:8943/print-raw";
const LOCAL = "http://localhost:8943/print-raw";
const dest = { protocol: "ipp", printerHost: "192.130.80.181", printerPort: 631, printerQueue: "TM-T20II-RAW" };
const config = { enabled: true, hubUrls: [CENTRAL, LOCAL], ...dest };

test("one hub: the hub url carries the printer as query params", () => {
  const u = new URL(buildHubRequestUrl(CENTRAL, dest)!);
  assert.equal(u.origin + u.pathname, "https://192.130.80.172:8943/print-raw");
  assert.equal(u.searchParams.get("protocol"), "ipp");
  assert.equal(u.searchParams.get("host"), "192.130.80.181");
  assert.equal(u.searchParams.get("port"), "631");
  assert.equal(u.searchParams.get("queue"), "TM-T20II-RAW");
});

test("several hubs: same printer, tried in the stored order (central, then local)", () => {
  const urls = buildHubRequestUrls(config);
  assert.equal(urls.length, 2);
  assert.ok(urls[0].startsWith("https://192.130.80.172:8943/print-raw?"));
  assert.ok(urls[1].startsWith("http://localhost:8943/print-raw?"));
  assert.equal(new URL(urls[0]).search, new URL(urls[1]).search);
});

test("disabled, no hubs or incomplete printer → nothing to try (button hidden)", () => {
  assert.deepEqual(buildHubRequestUrls({ ...config, enabled: false }), []);
  assert.deepEqual(buildHubRequestUrls({ ...config, hubUrls: [] }), []);
  assert.deepEqual(buildHubRequestUrls({ ...config, printerHost: null }), []);
  assert.deepEqual(buildHubRequestUrls({ ...config, printerQueue: "  " }), []);
  assert.deepEqual(buildHubRequestUrls(null), []);
});

test("an invalid hub url is skipped, the valid ones stay in order", () => {
  assert.deepEqual(buildHubRequestUrls({ ...config, hubUrls: ["nope", LOCAL] }).length, 1);
});

test("missing any piece of a single hub returns null (never guess a printer)", () => {
  assert.equal(buildHubRequestUrl("", dest), null);
  assert.equal(buildHubRequestUrl(CENTRAL, { ...dest, printerPort: "" }), null);
  assert.equal(buildHubRequestUrl(CENTRAL, { ...dest, printerPort: "63a" }), null);
  assert.equal(buildHubRequestUrl("ftp://x/print-raw", dest), null);
  assert.equal(buildHubRequestUrl(CENTRAL, { ...dest, protocol: "ftp" }), null);
});

test("windows target travels as protocol smb with its share name", () => {
  const u = new URL(buildHubRequestUrl(CENTRAL, { ...dest, protocol: "smb", printerPort: 445, printerQueue: "EPSON-CONSULTA" })!);
  assert.equal(u.searchParams.get("protocol"), "smb");
  assert.equal(u.searchParams.get("port"), "445");
  assert.equal(u.searchParams.get("queue"), "EPSON-CONSULTA");
});

test("values are trimmed and encoded; empty protocol means ipp", () => {
  const u = new URL(buildHubRequestUrl(CENTRAL, { ...dest, protocol: "", printerHost: " 192.130.80.181 ", printerQueue: "A B" })!);
  assert.equal(u.searchParams.get("protocol"), "ipp");
  assert.equal(u.searchParams.get("host"), "192.130.80.181");
  assert.equal(u.searchParams.get("queue"), "A B");
});

test("hubOrigin: scheme+host+port only, null when invalid", () => {
  assert.equal(hubOrigin(CENTRAL), "https://192.130.80.172:8943");
  assert.equal(hubOrigin(""), null);
  assert.equal(hubOrigin("nope"), null);
});

test("discover url: hub origin + /discover?host=", () => {
  const u = new URL(buildHubDiscoverUrl(CENTRAL, " 192.130.80.181 ")!);
  assert.equal(u.origin + u.pathname, "https://192.130.80.172:8943/discover");
  assert.equal(u.searchParams.get("host"), "192.130.80.181");
  assert.equal(buildHubDiscoverUrl(CENTRAL, ""), null);
  assert.equal(buildHubDiscoverUrl("", "192.130.80.181"), null);
});

test("port may come as a string (form input) and is accepted", () => {
  assert.equal(new URL(buildHubRequestUrl(CENTRAL, { ...dest, printerPort: "631" })!).searchParams.get("port"), "631");
});


test("status url: same hub and destination, path /status", () => {
  const req = buildHubRequestUrl(CENTRAL, dest)!;
  const u = new URL(hubStatusUrl(req));
  assert.equal(u.origin + u.pathname, "https://192.130.80.172:8943/status");
  assert.equal(u.search, new URL(req).search);
});
