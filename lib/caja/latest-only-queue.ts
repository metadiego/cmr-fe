// Runs one save at a time and keeps only the LATEST pending payload. The cash count is saved while
// the cashier types (owner, 04-nov-2026: "deben persistir"); the BE replaces the whole count by
// deleting and re-inserting its lines, so two saves in flight could cross and duplicate lines.
// A change that arrives while a save runs is queued; a newer one replaces it (the older is stale).

export type LatestOnlyQueue<T> = {
  push: (payload: T) => void;
  /** Resolves once nothing is running or queued (used before closing the count). */
  idle: () => Promise<void>;
};

export function latestOnlyQueue<T>(
  save: (payload: T) => Promise<void>,
  onState?: (s: "saving" | "saved" | "error", err?: unknown) => void,
): LatestOnlyQueue<T> {
  let running: Promise<void> | null = null;
  let pending: { payload: T } | null = null;

  const runNext = (): Promise<void> => {
    if (!pending) {
      running = null;
      return Promise.resolve();
    }
    const { payload } = pending;
    pending = null;
    onState?.("saving");
    running = save(payload)
      .then(
        () => {
          if (!pending) onState?.("saved");
        },
        (err) => onState?.("error", err),
      )
      .then(runNext);
    return running;
  };

  return {
    push(payload) {
      pending = { payload };
      if (!running) void runNext();
    },
    async idle() {
      while (running) await running;
    },
  };
}
