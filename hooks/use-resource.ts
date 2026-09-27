"use client";

import * as React from "react";

import { apiErrorMessage } from "@/lib/api/errors";

// Generalizes the load-once-with-cleanup pattern repeated across list/detail
// pages (see the original components/admin/users-list.tsx): a discriminated
// { loading | ok | fail } state plus a reload(). The fetcher is awaited on mount,
// whenever `deps` change, and on every reload(); a stale-response guard prevents
// setting state after the effect is torn down or superseded.
//
//   const { state, reload } = useResource(() => getPacientes());
//   ... state.kind === "ok" && state.data.map(...)
//
//   // refetch when a dependency changes (e.g. pagination/filters):
//   const { state } = useResource(() => apiFetchPaged(`/x?page=${page}`), [page]);
export type ResourceState<T> =
  | { kind: "loading" }
  | { kind: "ok"; data: T }
  | { kind: "fail"; message: string };

export function useResource<T>(
  fetcher: () => Promise<T>,
  deps: React.DependencyList = [],
): { state: ResourceState<T>; reload: () => void; refresh: () => void } {
  const [state, setState] = React.useState<ResourceState<T>>({
    kind: "loading",
  });
  // Bumped to re-run the load effect on manual reload().
  const [nonce, setNonce] = React.useState(0);

  // Always call the latest fetcher without making it an effect dependency
  // (callers pass an inline closure each render). Re-runs are driven by `deps`.
  const fetcherRef = React.useRef(fetcher);
  React.useEffect(() => {
    fetcherRef.current = fetcher;
  });

  // Serialize deps into a stable key so the effect's dependency array stays a
  // literal (no spread) — required by the react-hooks lint rules.
  const depsKey = JSON.stringify(deps);

  // When `deps` change (e.g. a different id), `state` still holds the PREVIOUS
  // resource's "ok" data while the new fetch is in flight — a caller that seeds
  // its own editable copy on "kind === ok" (the common "adjust state in render"
  // pattern) reads that stale data as if it were the new one. `setState` alone
  // does not fix this: it is deferred to the NEXT render, so a caller reading
  // `state` in THIS SAME render (the one where `deps` just changed) still sees
  // the old "ok" — exactly the render where its own seeding check fires, using
  // the wrong data, and never re-fires once the real data lands because its own
  // "already seeded" guard is now satisfied. Computing `effectiveState` inline
  // reports "loading" to the caller in that very render, not one render late.
  // Reproduced live: switching the resources-per-service dropdown from one
  // therapy to another kept showing the FIRST therapy's resource line forever,
  // including the very FIRST real selection after the empty placeholder state
  // (27-sep-2026). `reload()` already floors to "loading" itself; only a plain
  // deps change was missing it.
  const [prevDepsKey, setPrevDepsKey] = React.useState(depsKey);
  const depsChanged = prevDepsKey !== depsKey;
  if (depsChanged) {
    setPrevDepsKey(depsKey);
    if (state.kind !== "loading") setState({ kind: "loading" });
  }
  const effectiveState: ResourceState<T> = depsChanged
    ? { kind: "loading" }
    : state;

  React.useEffect(() => {
    let active = true;
    fetcherRef.current()
      .then((data) => {
        if (active) setState({ kind: "ok", data });
      })
      .catch((err: unknown) => {
        if (active) setState({ kind: "fail", message: apiErrorMessage(err) });
      });
    return () => {
      active = false;
    };
  }, [depsKey, nonce]);

  const reload = React.useCallback(() => {
    setState({ kind: "loading" });
    setNonce((n) => n + 1);
  }, []);

  // Silent refetch: re-runs the fetcher WITHOUT flipping to "loading", so the
  // current data stays on screen (used for live SSE-driven refreshes).
  const refresh = React.useCallback(() => {
    setNonce((n) => n + 1);
  }, []);

  return { state: effectiveState, reload, refresh };
}
