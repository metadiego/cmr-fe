import { ApiError } from "./types";

// Uniform error string for toasts/inline messages across the app.
export function apiErrorMessage(err: unknown): string {
  if (err instanceof ApiError) return `${err.code} · ${err.message}`;
  if (err instanceof Error) return err.message;
  return String(err);
}
