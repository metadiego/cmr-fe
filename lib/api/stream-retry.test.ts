// The SSE reconnect loops used to stop only on 401/403 and retry everything else
// with backoff. A center-scoped stream now answers 409 (no active center chosen)
// or 400 TENANT_REQUIRED, so "everything else" became an infinite loop — the same
// shape as the 36k UNAUTHORIZED entries that put the 401/403 stop there.
// See docs/specs/be-sse-acotado-al-centro-handoff.md. Run: `npm test`.
import test from "node:test";
import assert from "node:assert/strict";
import { classifyStreamFailure, streamError } from "./stream-retry.ts";

test("no active center: stop retrying and say a center is needed", () => {
  assert.deepEqual(classifyStreamFailure(409), { retryable: false, needsCenter: true });
  assert.deepEqual(classifyStreamFailure(400, "TENANT_REQUIRED"), {
    retryable: false,
    needsCenter: true,
  });
});

test("no session or no permission: stop, but it is not about the center", () => {
  assert.deepEqual(classifyStreamFailure(401), { retryable: false, needsCenter: false });
  assert.deepEqual(classifyStreamFailure(403), { retryable: false, needsCenter: false });
});

test("any other client error stops too: reconnecting cannot fix a 4xx", () => {
  assert.equal(classifyStreamFailure(400).retryable, false);
  assert.equal(classifyStreamFailure(404).retryable, false);
  assert.equal(classifyStreamFailure(422).retryable, false);
});

test("server errors and rate limits DO reconnect", () => {
  assert.equal(classifyStreamFailure(500).retryable, true);
  assert.equal(classifyStreamFailure(502).retryable, true);
  assert.equal(classifyStreamFailure(503).retryable, true);
  assert.equal(classifyStreamFailure(429).retryable, true);
  assert.equal(classifyStreamFailure(408).retryable, true);
});

test("a dropped connection has no status and must reconnect", () => {
  assert.equal(classifyStreamFailure(undefined).retryable, true);
});

test("the code wins over the status: a 403 carrying TENANT_REQUIRED asks for a center", () => {
  assert.equal(classifyStreamFailure(403, "TENANT_REQUIRED").needsCenter, true);
});


// --- streamError: the loops can only classify what the client hands them ------

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

test("streamError carries the backend's status AND its error code", async () => {
  const err = await streamError(
    jsonResponse(400, {
      error: { code: "TENANT_REQUIRED", message: "Selecciona un centro" },
    }),
  );
  assert.equal(err.status, 400);
  assert.equal(err.code, "TENANT_REQUIRED");
  assert.equal(classifyStreamFailure(err.status, err.code).needsCenter, true);
});

test("a body that is not the error envelope still yields a usable status", async () => {
  const err = await streamError(new Response("<html>gateway</html>", { status: 502 }));
  assert.equal(err.status, 502);
  assert.equal(err.code, undefined);
  assert.equal(classifyStreamFailure(err.status, err.code).retryable, true);
});

test("an empty body does not throw while building the error", async () => {
  const err = await streamError(new Response(null, { status: 401 }));
  assert.equal(err.status, 401);
  assert.ok(err instanceof Error);
});
