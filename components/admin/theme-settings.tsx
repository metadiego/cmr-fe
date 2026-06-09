"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  getSystemPreferences,
  updateSystemPreferences,
  getCentroPreferences,
  updateCentroPreferences,
} from "@/lib/api/preferences";
import { getCenters, type Centro } from "@/lib/api/centers";
import type { ThemeConfig } from "@/lib/theme/config";
import { apiErrorMessage } from "@/lib/api/errors";
import { useMe } from "@/hooks/use-me";
import { OverrideSettings } from "@/components/admin/override-settings";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ThemeEditor } from "@/components/theme/theme-editor";

// Admin theme panel (config por capas #51): the system default and per-center
// theme. Reuses ThemeEditor + LayerThemeForm; the master override is Part 3.
export function ThemeSettings() {
  const t = useTranslations("admin.theme");
  const me = useMe();
  const isMaster = me.kind === "ok" && me.me.isMaster;
  const [centers, setCenters] = React.useState<Centro[]>([]);
  const [centroId, setCentroId] = React.useState<string>("");

  React.useEffect(() => {
    let active = true;
    getCenters()
      .then((list) => active && setCenters(list))
      .catch((err) => active && toast.error(apiErrorMessage(err)));
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-medium">{t("systemTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("systemHelp")}</p>
        </div>
        <LayerThemeForm
          key="system"
          load={getSystemPreferences}
          save={updateSystemPreferences}
          savedMsg={t("savedSystem")}
        />
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-medium">{t("centerTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("centerHelp")}</p>
        </div>
        <div className="space-y-1.5">
          <Label>{t("selectCenter")}</Label>
          <Select value={centroId} onValueChange={setCentroId}>
            <SelectTrigger className="w-full max-w-xs">
              <SelectValue placeholder={t("selectCenter")} />
            </SelectTrigger>
            <SelectContent>
              {centers.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nombre} ({c.codigo})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {centroId && (
          <LayerThemeForm
            key={centroId}
            load={() => getCentroPreferences(centroId)}
            save={(config) => updateCentroPreferences(centroId, config)}
            savedMsg={t("savedCenter")}
          />
        )}
      </section>

      {isMaster && <OverrideSettings />}
    </div>
  );
}

type State =
  | { kind: "loading" }
  | { kind: "ok"; config: ThemeConfig }
  | { kind: "fail"; message: string };

// Loads a layer's config, edits it with ThemeEditor, persists + reloads. The
// parent gives it a `key` per layer, so switching layers remounts it (fresh
// load) — no synchronous setState in an effect.
function LayerThemeForm({
  load,
  save,
  savedMsg,
}: {
  load: () => Promise<ThemeConfig>;
  save: (config: ThemeConfig) => Promise<unknown>;
  savedMsg: string;
}) {
  const t = useTranslations("admin.theme");
  const [state, setState] = React.useState<State>({ kind: "loading" });
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    load()
      .then((config) => active && setState({ kind: "ok", config: config ?? {} }))
      .catch(
        (err) =>
          active && setState({ kind: "fail", message: apiErrorMessage(err) }),
      );
    return () => {
      active = false;
    };
    // Mount-only: the component is remounted via `key` when the layer changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function persist(config: ThemeConfig, msg: string) {
    setBusy(true);
    try {
      await save(config);
      toast.success(msg);
      window.location.reload();
    } catch (err) {
      toast.error(apiErrorMessage(err));
      setBusy(false);
    }
  }

  if (state.kind === "loading") {
    return <p className="text-sm text-muted-foreground">{t("loading")}</p>;
  }
  if (state.kind === "fail") {
    return (
      <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
        {state.message}
      </p>
    );
  }

  return (
    <div className="max-w-md rounded-xl border bg-card/60 p-6 shadow-sm backdrop-blur">
      <ThemeEditor
        value={state.config}
        onChange={(config) => setState({ kind: "ok", config })}
      />
      <div className="mt-6 flex gap-2">
        <Button onClick={() => persist(state.config, savedMsg)} disabled={busy}>
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
    </div>
  );
}
