export type SubmitResult<T> =
  | { status: "ok"; value: T }
  | { status: "error"; error: unknown }
  | { status: "skipped" };

/** Lets only one submit run at a time; a second call while pending is skipped. */
export function createSubmitGuard() {
  let busy = false;
  return {
    async run<T>(fn: () => Promise<T>): Promise<SubmitResult<T>> {
      if (busy) return { status: "skipped" };
      busy = true;
      try {
        return { status: "ok", value: await fn() };
      } catch (error) {
        return { status: "error", error };
      } finally {
        busy = false;
      }
    },
    get busy() {
      return busy;
    },
  };
}
