const ORIGIN_KEY = "cmr_call_origin";

// Where to jump back to after checking a ficha mid-call, from the call-center bridge day view
// (owner's request, 2026-09-21). A "back to the call" pattern that didn't exist anywhere in the
// system yet — pure client-side (sessionStorage), no backend involved. Single-use: the ficha
// page clears it once read, so it does not linger and reappear on an unrelated later visit.
export function saveCallOrigin(url: string): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(ORIGIN_KEY, url);
}

export function readCallOrigin(): string | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(ORIGIN_KEY);
}

export function clearCallOrigin(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(ORIGIN_KEY);
}
