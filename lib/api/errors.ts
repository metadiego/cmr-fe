import { toast } from "sonner";

import { ApiError } from "./types";

// Minimal shape of a next-intl translator: t(key) → string. Kept loose so any
// namespace's `useTranslations(...)` result can be passed.
type Translate = (key: string) => string;

// Uniform error string for toasts/inline messages across the app.
export function apiErrorMessage(err: unknown): string {
  if (err instanceof ApiError) return `${err.code} · ${err.message}`;
  if (err instanceof Error) return err.message;
  return String(err);
}

// i18n-aware error string: prefer the BE's labelKey (translated) and fall back
// to the raw message. Pass the translator for the namespace the labelKey lives
// in (or a root translator). Without a translator, behaves like apiErrorMessage.
// Rate limit (429/ThrottlerException): detectable por status/code o por el texto crudo.
export function isRateLimited(err: unknown): boolean {
  if (err instanceof ApiError) return err.status === 429 || err.code === "RATE_LIMITED";
  const msg = err instanceof Error ? err.message : String(err);
  return /RATE_LIMITED|Too Many Requests|ThrottlerException/i.test(msg);
}

export function apiErrorLabel(err: unknown, t?: Translate): string {
  if (t && isRateLimited(err)) {
    const m = t("common.rateLimited");
    if (m && m !== "common.rateLimited") return m;
  }
  if (err instanceof ApiError && err.labelKey && t) {
    const translated = t(err.labelKey);
    // next-intl returns the key itself on a miss → fall back to the message.
    if (translated && translated !== err.labelKey) return translated;
    return err.message;
  }
  return apiErrorMessage(err);
}

// Shows an error toast using the i18n-aware label.
export function toastError(err: unknown, t?: Translate): void {
  toast.error(apiErrorLabel(err, t));
}
