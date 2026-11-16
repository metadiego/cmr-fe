"use client";

import { useCallback, useState } from "react";

import { shouldReset } from "@/lib/forms/dialog-form";

/**
 * Form state that is re-initialised whenever the dialog opens or `key` changes.
 * `key` should identify the loaded record: data arriving later under the same key does not reset.
 */
export function useDialogForm<T>(
  initial: () => T,
  open: boolean,
  key?: unknown,
): [T, (patch: Partial<T> | ((s: T) => T)) => void] {
  const [state, setState] = useState<T>(initial);
  const [prev, setPrev] = useState({ open, key });

  // Adjust state during render (React's documented pattern) so there is no stale first frame.
  if (prev.open !== open || !Object.is(prev.key, key)) {
    const reset = shouldReset(prev, { open, key });
    setPrev({ open, key });
    if (reset) setState(initial());
  }

  const update = useCallback((patch: Partial<T> | ((s: T) => T)) => {
    setState((s) => (typeof patch === "function" ? patch(s) : { ...s, ...patch }));
  }, []);

  return [state, update];
}
