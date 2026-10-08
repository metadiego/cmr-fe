// Where a center's backup print jobs go: ONE shared hub (url) relays each job to the printer named
// here. Stored per center in its preferences layer (`printHub`), so two offices can share the same
// hub and still print each on its own paper.
//   protocol "ipp" → the printer is shared from Linux/macOS (CUPS, usually port 631)
//   protocol "smb" → the printer is shared from Windows (usually port 445); queue = share name
export type PrintHubProtocol = "ipp" | "smb";

export interface PrintHubTarget {
  url?: string;
  protocol?: PrintHubProtocol;
  printerHost?: string;
  printerPort?: number | string;
  printerQueue?: string;
}

export const DEFAULT_PORTS: Record<PrintHubProtocol, number> = { ipp: 631, smb: 445 };

// What the hub answers on GET /discover?host=.
export interface HubDiscovery {
  host: string;
  system: "windows" | "linux-mac" | null;
  protocol: PrintHubProtocol | null;
  port: number | null;
  printers: string[];
  error: string | null;
}

function parseHubUrl(url: string | undefined): URL | null {
  const raw = url?.trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return u.protocol === "https:" || u.protocol === "http:" ? u : null;
  } catch {
    return null;
  }
}

// Origin of the hub (scheme://host:port) — what the browser has to trust once (self-signed cert).
export function hubOrigin(url: string | undefined): string | null {
  return parseHubUrl(url)?.origin ?? null;
}

// Returns the full request URL for the hub, or null when anything is missing — the caller must then
// refuse to print rather than guess a destination (a guess is how one office prints at another).
// A missing protocol means "ipp", the hub's own default (configs saved before protocol existed).
export function buildHubRequestUrl(target: PrintHubTarget | null | undefined): string | null {
  const base = parseHubUrl(target?.url);
  const protocol = target?.protocol ?? "ipp";
  const host = target?.printerHost?.trim();
  const port = String(target?.printerPort ?? "").trim();
  const queue = target?.printerQueue?.trim();
  if (!base || !host || !port || !queue) return null;
  if (!Object.hasOwn(DEFAULT_PORTS, protocol) || !/^\d+$/.test(port)) return null;
  base.searchParams.set("protocol", protocol);
  base.searchParams.set("host", host);
  base.searchParams.set("port", port);
  base.searchParams.set("queue", queue);
  return base.toString();
}

// URL to ask the hub which system a machine runs and which printers it shares.
export function buildHubDiscoverUrl(url: string | undefined, host: string | undefined): string | null {
  const origin = hubOrigin(url);
  const h = host?.trim();
  if (!origin || !h) return null;
  const u = new URL("/discover", origin);
  u.searchParams.set("host", h);
  return u.toString();
}
