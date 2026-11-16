export type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

type Pending = { options: ConfirmOptions; resolve: (ok: boolean) => void };

/** FIFO queue of confirmation prompts; one is current at a time. */
export function createConfirmQueue() {
  const pending: Pending[] = [];
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((fn) => fn());

  return {
    request(options: ConfirmOptions): Promise<boolean> {
      return new Promise<boolean>((resolve) => {
        pending.push({ options, resolve });
        notify();
      });
    },
    current(): ConfirmOptions | null {
      return pending[0]?.options ?? null;
    },
    /** Resolves the current prompt and advances to the next. */
    settle(ok: boolean): void {
      const head = pending.shift();
      if (!head) return;
      head.resolve(ok);
      notify();
    },
    /** Resolves every pending prompt with false (host unmount). */
    cancelAll(): void {
      if (pending.length === 0) return;
      for (const p of pending.splice(0)) p.resolve(false);
      notify();
    },
    subscribe(fn: () => void): () => void {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
  };
}
