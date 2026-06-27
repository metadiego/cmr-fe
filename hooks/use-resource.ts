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
): { state: ResourceState<T>; reload: () => void } {
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

  return { state, reload };
}
