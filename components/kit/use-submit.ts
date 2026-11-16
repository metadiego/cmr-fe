"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { toastError } from "@/lib/api/errors";
import { createSubmitGuard } from "@/lib/forms/submit";

/** Runs `fn` once at a time; toasts the error or the success message. */
export function useSubmit<T>(
  fn: () => Promise<T>,
  o?: { successMessage?: string; onSuccess?: (v: T) => void },
): { submitting: boolean; submit: () => Promise<void> } {
  const tRoot = useTranslations();
  const [guard] = useState(createSubmitGuard);
  const [submitting, setSubmitting] = useState(false);

  const submit = useCallback(async () => {
    if (guard.busy) return;
    setSubmitting(true);
    try {
      const r = await guard.run(fn);
      if (r.status === "error") toastError(r.error, tRoot);
      else if (r.status === "ok") {
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
  }, [guard, fn, o, tRoot]);

  return { submitting, submit };
}
