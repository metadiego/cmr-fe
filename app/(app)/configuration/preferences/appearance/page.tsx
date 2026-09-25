"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { getMyPreferences, updateMyPreferences } from "@/lib/api/preferences";
import type { ThemeConfig } from "@/lib/theme/config";
import { mezclarSoloTema } from "@/lib/theme/mezclar-capa";
import { apiErrorMessage } from "@/lib/api/errors";
import { useResource } from "@/hooks/use-resource";
import { ThemeEditor } from "@/components/theme/theme-editor";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { AvatarUploader } from "@/components/media/avatar-uploader";
import { Button } from "@/components/ui/button";

// Apariencia PERSONAL: avatar + color de marca + fondo, todos en la capa `usuario` (por-usuario, no
// por-centro). Restaurado (owner, 2026-09-25) — se había retirado el 1-sep-2026 dejando solo el
// avatar. El BE ya resuelve la precedencia (override → usuario → centro → sistema) en `effective`;
// esta pantalla solo lee/escribe la capa PROPIA del usuario (`layers.user`), nunca `effective`
// directo — guardar `effective` copiaría valores heredados del centro/sistema como si fueran una
// elección personal. Si el centro bloqueó su apariencia (`layers.centroBloqueado`), el editor entero
// queda deshabilitado con un aviso — el bloqueo es de TODA la capa, no campo por campo.
// Ver .personal/apariencia-personal-restaurar-y-bloqueo-de-centro-handoff.md.
export default function AppearancePage() {
  const t = useTranslations("appearance");
  const tc = useTranslations("common");
  const [original, setOriginal] = React.useState<ThemeConfig | null>(null);
  const { state } = useResource(() => getMyPreferences(), []);
  const [draft, setDraft] = React.useState<ThemeConfig | null>(null);
  const [guardando, setGuardando] = React.useState(false);
  const [seededFor, setSeededFor] = React.useState<unknown>(null);

  // Sembrar el borrador SOLO al primer load (no en cada refetch en segundo plano, que perdería
  // ediciones a medio hacer). Ajuste de estado durante el render (no un efecto): react.dev/you-might-not-need-an-effect.
  if (state.kind === "ok" && state !== seededFor) {
    setSeededFor(state);
    const capaUsuario = state.data.layers.user ?? {};
    setOriginal(capaUsuario);
    setDraft(capaUsuario);
  }

  const bloqueado = state.kind === "ok" && state.data.layers.centroBloqueado === true;

  async function guardar() {
    if (!draft) return;
    setGuardando(true);
    try {
      await updateMyPreferences(mezclarSoloTema(original, draft));
      toast.success(tc("saved"));
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <PageContainer>
      <PageHeader title={t("title")} description={t("description")} />

      <div className="space-y-6">
        {/* Avatar (media de perfil, independiente de las capas de tema) */}
        <div className="rounded-md bg-card p-6 shadow-sm shadow-[rgba(16,32,64,0.06)] ring-1 ring-foreground/10 backdrop-blur">
          <h2 className="mb-4 text-sm font-medium">{t("avatarTitle")}</h2>
          <AvatarUploader />
        </div>

        <div className="rounded-md bg-card p-6 shadow-sm shadow-[rgba(16,32,64,0.06)] ring-1 ring-foreground/10 backdrop-blur">
          {bloqueado && (
            <div className="mb-4 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
              <p className="font-medium text-warning-foreground">{t("lockedTitle")}</p>
              <p className="text-muted-foreground">{t("lockedBody")}</p>
            </div>
          )}
          {state.kind === "loading" && <p className="text-sm text-muted-foreground">{tc("loading")}</p>}
          {state.kind === "fail" && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {state.message}
            </p>
          )}
          {draft && (
            <>
              <ThemeEditor value={draft} onChange={setDraft} disabled={bloqueado} />
              {!bloqueado && (
                <Button className="mt-6" onClick={guardar} disabled={guardando}>
                  {guardando ? tc("saving") : tc("save")}
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
