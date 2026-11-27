// Pure helpers for the Call Center dashboard (app/(app)/communications/callcenter/page.tsx).

export type CallcenterTab = "answered" | "missed" | "all" | "facebook" | "tv";

/** Maps a UI tab to the `calls` endpoint's own `tab`/`channel` query params. FB/TV are channel
 *  filters over "all", not their own `tab` value (handoff §2). */
export function callcenterTabParams(tab: CallcenterTab): { tab: "answered" | "missed" | "all"; channel?: string } {
  switch (tab) {
    case "answered":
      return { tab: "answered" };
    case "missed":
      return { tab: "missed" };
    case "facebook":
      return { tab: "all", channel: "facebook" };
    case "tv":
      return { tab: "all", channel: "tv" };
    default:
      return { tab: "all" };
  }
}

function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "Today" and "this week" (Monday through today) as `{from, to}`, both inclusive ISO days. */
export function quickRange(kind: "today" | "week", now: Date): { from: string; to: string } {
  const to = isoDay(now);
  if (kind === "today") return { from: to, to };
  const day = now.getDay(); // 0=Sun..6=Sat
  const sinceMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - sinceMonday);
  return { from: isoDay(monday), to };
}

/** Seconds as "m:ss" for an average-duration stat (never negative, never NaN). */
export function formatMinSec(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds || 0));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${String(rem).padStart(2, "0")}`;
}

/** Whether a live-call-board row's last heartbeat is too old to trust (handoff §4: "nunca lo de hace
 *  una hora como si fuera de ahora"). Default threshold 5 minutes — a dead agent process, not a slow tick. */
export function isLiveRowStale(agentReportedAt: string, now: Date, staleAfterMinutes = 5): boolean {
  const ts = new Date(agentReportedAt).getTime();
  if (!Number.isFinite(ts)) return true;
  return now.getTime() - ts > staleAfterMinutes * 60_000;
}

// Phase 3 (handoff-callcenter-devolver-y-grabaciones): the switchboard split is the main difference
// from the legacy screen — its KPIs count only the UCM (132, matching exactly); ours used to add the
// 3CX in by default (198). "all" keeps today's combined behaviour; "ucm-bayamon" is the new default.
export type CallcenterPbx = "ucm-bayamon" | "3cx" | "all";

/** The `pbx` query param for a selector choice — "all" means "omit it" (today's combined read). */
export function pbxParam(selection: CallcenterPbx): string | undefined {
  return selection === "all" ? undefined : selection;
}

type CallbackCall = { from: string | null; toNumber: string | null; address: string | null; status: string };

/** The patient's own number for "Devolver" — the BE's own split (confirmed by the BE peer, 27-nov):
 *  on a "saliente" call `from` is OUR extension (we placed it), so the outside party is `toNumber`;
 *  every other direction has it in `from`. Null when the call has no outside number at all (e.g. "interna"). */
export function callbackNumberOf(call: CallbackCall): string | null {
  if (call.address === "interna") return null;
  const n = call.address === "saliente" ? call.toNumber : call.from;
  return n?.trim() ? n : null;
}

/** Whether "Devolver" makes sense for a call: it needs an outside number (never an "interna" call),
 *  and a completed outbound call ("saliente" + contestada) needs no callback — we already talked to
 *  them. A MISSED outbound call ("saliente" + not contestada) is exactly "they didn't pick up," so it
 *  gets the button too (BE peer, 27-nov): the BE dials `toNumber`, the number that was called. */
export function canCallBack(call: CallbackCall): boolean {
  if (!callbackNumberOf(call)) return false;
  if (call.address === "saliente") return call.status !== "contestada";
  return call.address === "entrante" || call.address === "facebook" || call.address === "marypili";
}
