"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

// Route error boundary for the authenticated area. A render/effect crash in one
// screen shows this fallback (with a retry) instead of white-screening the whole
// app — so one broken domain can't take the rest down. (See norm
// "no-romper-otros-dominios".)
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("common");

  return (
    <div className="mx-auto max-w-lg px-6 py-16 text-center">
      <h1 className="text-lg font-semibold">{t("errorTitle")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("errorBody")}</p>
      {process.env.NODE_ENV !== "production" && (
        <pre className="mt-3 overflow-x-auto rounded-md border bg-muted/40 p-2 text-left text-xs text-muted-foreground">
          {error.message}
        </pre>
      )}
      <div className="mt-4">
        <Button onClick={reset}>{t("retry")}</Button>
      </div>
    </div>
  );
}
