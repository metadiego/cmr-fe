"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { env } from "@/lib/env";
import { getHealth, type HealthStatus } from "@/lib/api/health";
import { ApiError } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Result =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; data: HealthStatus }
  | { kind: "fail"; title: string; detail: string; corsHint: boolean };

// Live smoke test of the FE → BE wiring: calls the public /api/health endpoint
// through the shared apiRequest client and renders whatever comes back.
export function ApiHealthCheck() {
  const t = useTranslations("apiHealth");
  const [result, setResult] = React.useState<Result>({ kind: "idle" });

  async function check() {
    setResult({ kind: "loading" });
    try {
      const data = await getHealth();
      setResult({ kind: "ok", data });
    } catch (err) {
      if (err instanceof ApiError) {
        setResult({
          kind: "fail",
          title: t("errorTitle", { status: err.status, code: err.code }),
          detail: err.message,
          corsHint: false,
        });
      } else {
        // A browser CORS block or unreachable host surfaces as a TypeError
        // ("Failed to fetch") — there's no status code to read.
        const detail = err instanceof Error ? err.message : String(err);
        setResult({
          kind: "fail",
          title: t("offline"),
          detail,
          corsHint: /fetch/i.test(detail),
        });
      }
    }
  }

  const ok = result.kind === "ok";
  const fail = result.kind === "fail";

  return (
    <div className="w-full max-w-md rounded-lg border bg-card/60 p-5 text-left shadow-sm backdrop-blur">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{t("title")}</h2>
          <p className="mt-1 font-mono text-xs break-all text-muted-foreground">
            GET {env.API_BASE_URL}/api/health
          </p>
        </div>
        <Button
          size="sm"
          onClick={check}
          disabled={result.kind === "loading"}
          className="shrink-0"
        >
          {result.kind === "loading" ? t("testing") : t("test")}
        </Button>
      </div>

      {(ok || fail) && (
        <div
          className={cn(
            "mt-4 rounded-md border p-3",
            ok && "border-success/30 bg-success/10",
            fail && "border-destructive/30 bg-destructive/10",
          )}
        >
          <div className="flex items-center gap-2 text-sm font-medium">
            <span
              className={cn(
                "size-2 rounded-full",
                ok ? "bg-success" : "bg-destructive",
              )}
            />
            {ok ? t("connected") : fail ? result.title : null}
          </div>

          {ok && (
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
              <dt className="text-muted-foreground">{t("estado")}</dt>
              <dd className="font-mono">{result.data.status}</dd>
              <dt className="text-muted-foreground">{t("database")}</dt>
              <dd className="font-mono">
                {result.data.details?.database?.status ?? "—"}
              </dd>
            </dl>
          )}

          {fail && (
            <p className="mt-1 text-xs break-all text-muted-foreground">
              {result.detail}
              {result.corsHint && (
                <span className="mt-1 block">
                  {t.rich("corsHint", {
                    code: (chunks) => <code>{chunks}</code>,
                  })}
                </span>
              )}
            </p>
          )}

          {ok && (
            <pre className="mt-3 max-h-48 overflow-auto rounded bg-background/60 p-2 font-mono text-[11px] leading-relaxed">
              {JSON.stringify(result.data, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
