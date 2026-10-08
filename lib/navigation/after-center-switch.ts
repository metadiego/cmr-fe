// Where to land after switching the active center from the nav selector.
//
// Two things go wrong if the page simply reloads in place:
//  1. A record that belongs to ONE center (an invoice, a stock transfer) stays on screen under the new
//     center — the owner saw a Caguas invoice after switching to Bayamón.
//  2. A `?centro=` in the URL wins over the active center in useCentroGate and even writes it back to
//     the cookie, silently undoing the switch.
// So: `?centro=` is rewritten to the new center, and a center-bound detail goes one step back to its
// list (of the new center). Records shared across centers (patients, boards, the cash division, a
// scheduling day) just reload where they are.

const CENTER_BOUND_DETAILS: { match: RegExp; list: string }[] = [
  // /billing/invoices/:id, its return screen and return receipts — but not /billing/invoices/new.
  { match: /^\/billing\/invoices\/(?!new(?:\/|$))[^/]+(?:\/.*)?$/, list: "/billing/invoices" },
  // /inventory/transfers/:id — but not /inventory/transfers/new.
  { match: /^\/inventory\/transfers\/(?!new(?:\/|$))[^/]+(?:\/.*)?$/, list: "/inventory/transfers" },
];

export function urlAfterCenterSwitch(pathname: string, search: string, newCenterId: string): string {
  const params = new URLSearchParams(search);
  const pinned = params.has("centro");
  const bound = CENTER_BOUND_DETAILS.find((d) => d.match.test(pathname));
  if (bound) return pinned ? `${bound.list}?centro=${encodeURIComponent(newCenterId)}` : bound.list;
  if (pinned) params.set("centro", newCenterId);
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}
