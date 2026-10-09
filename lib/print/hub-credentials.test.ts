import { test } from "node:test";
import assert from "node:assert/strict";
import { saveMachineLogin } from "./hub-credentials.ts";

const URL_ = "https://192.130.80.2:8943/credentials?host=192.130.80.100";

function fake(status: number, body: string) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetcher = async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(body, { status });
  };
  return { calls, fetcher };
}

test("sends the login with the caller's session and center; returns the PC's printers", async () => {
  const f = fake(200, JSON.stringify({ host: "192.130.80.100", printers: ["EPSON TM-T20II Receipt5"] }));
  const r = await saveMachineLogin(URL_, { username: "cmrprint", password: "x" }, { token: "T", centerId: "cag" }, f.fetcher);
  assert.deepEqual(r, { ok: true, printers: ["EPSON TM-T20II Receipt5"] });
  const h = f.calls[0].init.headers as Record<string, string>;
  assert.equal(h.Authorization, "Bearer T");
  assert.equal(h["X-Tenant-ID"], "cag");
  assert.equal(f.calls[0].init.method, "POST");
});

test("the PC refused the login (wrong user or password)", async () => {
  const r = await saveMachineLogin(URL_, { username: "cmrprint", password: "bad" }, { token: "T" }, fake(401, '{"error":"LOGIN_REJECTED"}').fetcher);
  assert.equal(r.ok, false);
  assert.equal(!r.ok && r.reason, "rejected");
});

test("the hub refused the caller (no permission / no session)", async () => {
  const r = await saveMachineLogin(URL_, { username: "u", password: "p" }, { token: "T" }, fake(403, "missing permission print-hub.update").fetcher);
  assert.deepEqual(r, { ok: false, reason: "forbidden", detail: "missing permission print-hub.update" });
});

test("hub unreachable (certificate not accepted) is an error, not a crash", async () => {
  const r = await saveMachineLogin(URL_, { username: "u", password: "p" }, { token: "T" }, async () => {
    throw new TypeError("NetworkError when attempting to fetch resource.");
  });
  assert.equal(!r.ok && r.reason, "error");
});
