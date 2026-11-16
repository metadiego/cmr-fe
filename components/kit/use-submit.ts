"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { toastError } from "@/lib/api/errors";
import { createSubmitGuard } from "@/lib/forms/submit";

/**
 * Runs `fn` once at a time; toasts the error or the success message.
 * `submit(...args)` forwards its arguments to `fn`, so one guard can serve several buttons.
 * `onError` may return `true` to say it handled the error (the generic toast is skipped).
 */
export function useSubmit<T, A extends unknown[] = []>(
  fn: (...args: A) => Promise<T>,
  o?: {
    successMessage?: string;
    onSuccess?: (v: T) => void;
    onError?: (err: unknown) => boolean | void;
  },
): { submitting: boolean; submit: (...args: A) => Promise<void> } {
  const tRoot = useTranslations();
  const [guard] = useState(createSubmitGuard);
  const [submitting, setSubmitting] = useState(false);

  const submit = useCallback(
    async (...args: A) => {
      if (guard.busy) return;
      setSubmitting(true);
      try {
        const r = await guard.run(() => fn(...args));
        if (r.status === "error") {
          if (!o?.onError?.(r.error)) toastError(r.error, tRoot);
        } else if (r.status === "ok") {
          if (o?.successMessage) toast.success(o.successMessage);
          try {
            o?.onSuccess?.(r.value);
          } catch (err) {
            toastError(err, tRoot);
          }
        }
      } finally {
        setSubmitting(false);
      }
    },
    [guard, fn, o, tRoot],
  );

  return { submitting, submit };
}
