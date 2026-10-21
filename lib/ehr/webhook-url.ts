// The single URL the EHR posts its events to (both centers: the center comes from the patient's key,
// BAY-… / CAG-…). Built from the API base the app already uses. Handoff ehr-webhook-en-la-configuracion.
export function ehrWebhookUrl(apiBase: string): string {
  return `${apiBase.replace(/\/+$/, "")}/api/v1/ehr-integration/events`
}
