// Where a center's backup print jobs go (BE: /print-hubs, one row per center). `hubUrls` is an ORDERED
// list — the central hub first, then e.g. a small hub on the machine the printer is plugged into — and
// the FE tries them in turn, so that machine keeps printing if the central hub is down. Every hub
// relays to the same printer: `protocol` + host + port + queue.
//   protocol "ipp" → printer shared from Linux/macOS (CUPS, usually port 631)
//   protocol "smb" → printer shared from Windows (usually port 445); queue = share name
export type PrintHubProtocol = "ipp" | "smb";

export interface PrintHubConfig {
  enabled: boolean;
  hubUrls: string[];
  protocol: PrintHubProtocol | string;
  printerHost: string | null;
  printerPort: number | string | null;
  printerQueue: string | null;
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
  // The PC (Windows) refused the hub: it needs a login of that PC, handed over with POST /credentials.
  needsLogin?: boolean;
}

function parseHubUrl(url: string | undefined | null): URL | null {
  const raw = url?.trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return u.protocol === "https:" || u.protocol === "http:" ? u : null;
  } catch {
    return null;
  }
}

// Origin of a hub (scheme://host:port) — what the browser has to trust once (self-signed cert).
export function hubOrigin(url: string | undefined | null): string | null {
  return parseHubUrl(url)?.origin ?? null;
}

// Request URL for ONE hub, or null when the hub URL or the destination printer is incomplete — the
// caller must then refuse rather than guess a printer (a guess is how one office prints at another).
export function buildHubRequestUrl(
  hubUrl: string | undefined | null,
  dest: Pick<PrintHubConfig, "protocol" | "printerHost" | "printerPort" | "printerQueue">,
): string | null {
  const base = parseHubUrl(hubUrl);
  const protocol = dest.protocol || "ipp";
  const host = dest.printerHost?.trim();
  const port = String(dest.printerPort ?? "").trim();
  const queue = dest.printerQueue?.trim();
  if (!base || !host || !port || !queue) return null;
  if (!Object.hasOwn(DEFAULT_PORTS, protocol) || !/^\d+$/.test(port)) return null;
  base.searchParams.set("protocol", protocol);
  base.searchParams.set("host", host);
  base.searchParams.set("port", port);
  base.searchParams.set("queue", queue);
  return base.toString();
}

// Request URLs to try, IN ORDER. Empty when the center has no usable backup: disabled, no valid hub,
// or the printer incomplete — the backup button is not shown then.
export function buildHubRequestUrls(config: PrintHubConfig | null | undefined): string[] {
  if (!config?.enabled) return [];
  return (config.hubUrls ?? []).map((u) => buildHubRequestUrl(u, config)).filter((u): u is string => !!u);
}

// URL to ask a hub which system a machine runs and which printers it shares.
export function buildHubDiscoverUrl(url: string | undefined | null, host: string | undefined | null): string | null {
  const origin = hubOrigin(url);
  const h = host?.trim();
  if (!origin || !h) return null;
  const u = new URL("/discover", origin);
  u.searchParams.set("host", h);
  return u.toString();
}

// Where to hand the hub the login of a printer machine (POST/DELETE /credentials?host=).
export function buildHubCredentialsUrl(url: string | undefined | null, host: string | undefined | null): string | null {
  const origin = hubOrigin(url);
  const h = host?.trim();
  if (!origin || !h) return null;
  const u = new URL("/credentials", origin);
  u.searchParams.set("host", h);
  return u.toString();
}

// The hub's health check for the same destination: GET /status with the request's own query
// (protocol, host, port, queue). Answers whether the hub is up and whether THAT printer is ready.
export function hubStatusUrl(requestUrl: string): string {
  const u = new URL(requestUrl);
  u.pathname = "/status";
  return u.toString();
}
