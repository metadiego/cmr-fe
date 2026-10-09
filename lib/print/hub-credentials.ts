// Hands a hub the login of a cashier PC (the local "cmrprint" user of a Windows machine). The password
// goes browser → hub over HTTPS and is stored ONLY on the hub, never in the app or its API. The hub
// checks the caller's own session (token + center) against the app before accepting it, and tries the
// login before storing it.

export interface MachineLogin {
  username: string;
  password: string;
  domain?: string;
}

export type SaveLoginResult =
  | { ok: true; printers: string[] }
  | { ok: false; reason: "rejected" | "forbidden" | "error"; detail: string };

type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

export async function saveMachineLogin(
  credentialsUrl: string,
  login: MachineLogin,
  session: { token: string; centerId?: string },
  fetcher: Fetcher = fetch,
): Promise<SaveLoginResult> {
  const headers: Record<string, string> = { "Content-Type": "application/json", Authorization: `Bearer ${session.token}` };
  if (session.centerId) headers["X-Tenant-ID"] = session.centerId;
  let res: Response;
  try {
    res = await fetcher(credentialsUrl, { method: "POST", headers, body: JSON.stringify(login) });
  } catch (e) {
    return { ok: false, reason: "error", detail: e instanceof Error ? e.message : String(e) };
  }
  if (res.ok) {
    const body = (await res.json().catch(() => ({}))) as { printers?: string[] };
    return { ok: true, printers: body.printers ?? [] };
  }
  const detail = (await res.text().catch(() => "")).trim();
  if (res.status === 401) return { ok: false, reason: "rejected", detail };
  if (res.status === 403) return { ok: false, reason: "forbidden", detail };
  return { ok: false, reason: "error", detail: detail || `hub ${res.status}` };
}
