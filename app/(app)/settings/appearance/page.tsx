"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  getMyPreferences,
  updateMyPreferences,
} from "@/lib/api/preferences";
import type { ThemeConfig } from "@/lib/theme/config";
import { mezclarSoloTema } from "@/lib/theme/mezclar-capa";
import { uploadMedia } from "@/lib/api/media";
import { apiErrorMessage } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ThemeEditor } from "@/components/theme/theme-editor";
import { AvatarUploader } from "@/components/media/avatar-uploader";
import { InicioPreferencia } from "@/components/settings/inicio-preferencia";

type State =
  | { kind: "loading" }
  | { kind: "ok"; config: ThemeConfig }
  | { kind: "fail"; message: string };

// User personalization (config por capas #51 — the `usuario` layer): avatar
// (profile), theme colors/radius, and a background image. Edits are previewed
// live; Save persists via PUT /me/preferences and reloads so PresentationProvider
// paints the authoritative effective theme.
export default function AppearancePage() {
  const t = useTranslations("appearance");
  const [state, setState] = React.useState<State>({ kind: "loading" });
  const [busy, setBusy] = React.useState(false);
  const bgInputRef = React.useRef<HTMLInputElement>(null);
  // El sobre de la capa `usuario` no es solo tema: también lleva preferencias propias como el acento de
  // color por centro (colorPorCentro). Guardar el tema con un PUT del objeto del editor las borraría, así
  // que se conserva el original y se mezclan SOLO las claves de tema — igual que la pantalla corporativa.
  // See cmr-be/docs/specs/acento-de-color-por-centro.md
  const originalUsuario = React.useRef<ThemeConfig | null>(null);

  React.useEffect(() => {
    let active = true;
    getMyPreferences()
      .then((res) => {
        if (!active) return;
        originalUsuario.current = res.layers?.usuario ?? {};
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
      await updateMyPreferences(mezclarSoloTema(originalUsuario.current, config));
      toast.success(msg);
      window.location.reload();
    } catch (err) {
      toast.error(apiErrorMessage(err));
      setBusy(false);
    }
  }

  async function onBgFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || state.kind !== "ok") return;
    setBusy(true);
    let url: string;
    try {
      url = await uploadMedia("background", file);
    } catch (err) {
      toast.error(apiErrorMessage(err));
      setBusy(false);
      return;
    }
    await persist(
      {
        ...state.config,
        background: { ...state.config.background, imageUrl: url },
      },
      t("backgroundSaved"),
    );
  }

  function removeBackground() {
    if (state.kind !== "ok") return;
    persist(
      {
        ...state.config,
        background: { ...state.config.background, imageUrl: undefined },
      },
      t("backgroundRemoved"),
    );
  }

  const hasBackground = state.kind === "ok" && !!state.config.background?.imageUrl;

  return (
    <div className="mx-auto max-w-md px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("description")}</p>

      {/* Avatar (profile media, independent of the theme layers) */}
      <div className="mt-6 rounded-xl border bg-card/60 p-6 shadow-sm backdrop-blur">
        <h2 className="mb-4 text-sm font-medium">{t("avatarTitle")}</h2>
        <AvatarUploader />
      </div>

      {/* «Al entrar, llévame a…» — pantalla de entrada personal (capa usuario de preferencias). */}
      <div className="mt-6 rounded-xl border bg-card/60 p-6 shadow-sm backdrop-blur">
        <InicioPreferencia />
      </div>

      {/* Theme + background (the user preferences layer) */}
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

            <div className="mt-6 space-y-2">
              <Label>{t("backgroundTitle")}</Label>
              <input
                ref={bgInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={onBgFile}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => bgInputRef.current?.click()}
                  disabled={busy}
                >
                  {hasBackground ? t("backgroundChange") : t("backgroundUpload")}
                </Button>
                {hasBackground && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={removeBackground}
                    disabled={busy}
                  >
                    {t("backgroundRemove")}
                  </Button>
                )}
              </div>
            </div>

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
