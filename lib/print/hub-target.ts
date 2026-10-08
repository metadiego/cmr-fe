// Where a center's backup print jobs go: ONE shared hub (url) relays each job to the printer named
// here (host, port, CUPS queue). Stored per center in its preferences layer (`printHub`), so two
// offices can share the same hub and still print each on its own paper.
export interface PrintHubTarget {
  url?: string;
  printerHost?: string;
  printerPort?: number | string;
  printerQueue?: string;
}

// Returns the full request URL for the hub, or null when anything is missing — the caller must then
// refuse to print rather than guess a destination (a guess is how one office prints at another).
export function buildHubRequestUrl(target: PrintHubTarget | null | undefined): string | null {
  const url = target?.url?.trim();
  const host = target?.printerHost?.trim();
  const port = String(target?.printerPort ?? "").trim();
  const queue = target?.printerQueue?.trim();
  if (!url || !host || !port || !queue) return null;
  if (!/^\d+$/.test(port)) return null;
  let base: URL;
  try {
    base = new URL(url);
  } catch {
    return null;
  }
  if (base.protocol !== "https:" && base.protocol !== "http:") return null;
  base.searchParams.set("host", host);
  base.searchParams.set("port", port);
  base.searchParams.set("queue", queue);
  return base.toString();
}
