"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  getMyPreferences,
  updateMyPreferences,
} from "@/lib/api/preferences";
import type { ThemeConfig } from "@/lib/theme/config";
import { apiErrorMessage } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { ThemeEditor } from "@/components/theme/theme-editor";

type State =
  | { kind: "loading" }
  | { kind: "ok"; config: ThemeConfig }
  | { kind: "fail"; message: string };

// User personalization (config por capas #51 — the `usuario` layer). Edits are
// previewed live by ThemeEditor; Save persists via PUT /me/preferences and
// reloads so the PresentationProvider paints the authoritative effective theme.
export default function AppearancePage() {
  const t = useTranslations("appearance");
  const [state, setState] = React.useState<State>({ kind: "loading" });
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    getMyPreferences()
      .then((res) => {
        if (active)
          setState({ kind: "ok", config: res.layers?.usuario ?? {} });
      })
      .catch(
        (err) =>
          active && setState({ kind: "fail", message: apiErrorMessage(err) }),
      );
    return () => {
      active = false;
    };
  }, []);

  async function persist(config: ThemeConfig, msg: string) {
    setBusy(true);
    try {
      await updateMyPreferences(config);
      toast.success(msg);
      window.location.reload();
    } catch (err) {
      toast.error(apiErrorMessage(err));
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("description")}</p>

      <div className="mt-6 rounded-xl border bg-card/60 p-6 shadow-sm backdrop-blur">
        {state.kind === "loading" && (
          <p className="text-sm text-muted-foreground">{t("loading")}</p>
        )}

        {state.kind === "fail" && (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {state.message}
          </p>
        )}

        {state.kind === "ok" && (
          <>
            <ThemeEditor
              value={state.config}
              onChange={(config) => setState({ kind: "ok", config })}
            />
            <div className="mt-6 flex gap-2">
              <Button
                onClick={() => persist(state.config, t("saved"))}
                disabled={busy}
              >
                {busy ? t("saving") : t("save")}
              </Button>
              <Button
                variant="outline"
                onClick={() => persist({}, t("resetDone"))}
                disabled={busy}
              >
                {t("reset")}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
