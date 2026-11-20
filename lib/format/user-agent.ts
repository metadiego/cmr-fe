// A short "Chrome · Windows" summary of a raw User-Agent string, for the Sessions audit tab
// (cmr-be #648): the row stores the full header, but a receptionist does not need to read it.
// Order matters — Edge and Opera UAs also contain "Chrome", and every desktop UA contains "Safari".

function detectBrowser(ua: string): string | null {
  if (/Edg\//.test(ua)) return "Edge";
  if (/OPR\/|Opera/.test(ua)) return "Opera";
  if (/Chrome\//.test(ua)) return "Chrome";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/Safari\//.test(ua)) return "Safari";
  return null;
}

function detectOS(ua: string): string | null {
  // iOS UAs carry "like Mac OS X" as a compatibility string, so iOS must be checked first.
  if (/iPhone|iPad|iPod/.test(ua)) return "iOS";
  if (/Windows/.test(ua)) return "Windows";
  if (/Mac OS X/.test(ua)) return "macOS";
  if (/Android/.test(ua)) return "Android";
  if (/Linux/.test(ua)) return "Linux";
  return null;
}

export function summarizeUserAgent(userAgent: string | null | undefined): string {
  if (!userAgent) return "—";
  const parts = [detectBrowser(userAgent), detectOS(userAgent)].filter((p): p is string => p != null);
  return parts.length ? parts.join(" · ") : "—";
}
