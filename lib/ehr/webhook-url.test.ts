import { test } from "node:test"
import assert from "node:assert/strict"
import { ehrWebhookUrl } from "./webhook-url.ts"

test("copying the URL gives exactly the one the EHR must call", () => {
  assert.equal(
    ehrWebhookUrl("https://api.centrodemedicinaregenerativa.com"),
    "https://api.centrodemedicinaregenerativa.com/api/v1/ehr-integration/events"
  )
  assert.equal(
    ehrWebhookUrl("https://api.centrodemedicinaregenerativa.com/"),
    "https://api.centrodemedicinaregenerativa.com/api/v1/ehr-integration/events"
  )
})
