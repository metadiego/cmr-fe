import { EscPosWriter } from "./escpos.ts";

// Backup ESC/POS print path — a fallback for the normal one (browser + window.print()), which stays
// the default. The receipt goes as raw ESC/POS bytes (lib/print/receipt-escpos.ts) to the print hub,
// which relays them to the printer: no printer driver, no browser dialog, so it works the same in
// every browser. The request URL (hub + destination printer) is resolved per center by
// buildHubRequestUrl (lib/print/hub-target.ts); this module never picks a destination itself.
// See docs/specs/recibo-termico-causa-raiz-y-arreglo.md.

// A short ticket to check a center's hub + printer settings from the configuration screen.
export function testTicketToEscPos(lines: string[]): Uint8Array<ArrayBuffer> {
  const w = new EscPosWriter().init().align("center").bold(true);
  for (const l of lines) w.wrapped(l);
  return w.bold(false).align("left").cut().toBytes();
}

// POSTs the bytes to an already-resolved hub request URL. Throws with the hub's own message when it
// refuses (bad destination, printer unreachable) so the caller can show it as is.
export async function sendToHub(requestUrl: string, bytes: Uint8Array): Promise<void> {
  const res = await fetch(requestUrl, { method: "POST", body: new Blob([bytes as Uint8Array<ArrayBuffer>]) });
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).trim();
    throw new Error(detail ? `hub ${res.status}: ${detail}` : `hub ${res.status}`);
  }
}
