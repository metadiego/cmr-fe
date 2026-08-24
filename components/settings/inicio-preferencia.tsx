"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { getMyPreferences, updateMyPreferences, getInicio, type Inicio } from "@/lib/api/preferences";
import type { ThemeConfig } from "@/lib/theme/config";
import { useMenu } from "@/hooks/use-menu";
import { useResource } from "@/hooks/use-resource";
import { apiErrorMessage } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

// «Al entrar, llévame a…» — la persona elige su pantalla de entrada entre las de su PROPIO menú. Se guarda
// en la capa `usuario` de preferencias (config.inicio), conservando el resto (tema, colorPorCentro…). El
// BE la resuelve en GET /me/inicio: si pierde el permiso de la elegida, cae a la deducida. Handoff
// al-entrar-cada-uno-a-su-trabajo.
const AUTO = "__auto__"; // sin elección → el BE deduce por el orden del trabajo diario

export function InicioPreferencia() {
  const t = useTranslations("inicioPref");
  const tRoot = useTranslations();
  const menu = useMenu();
  const inicioRes = useResource<Inicio>(() => getInicio());
  const [sel, setSel] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  // Opciones = ítems navegables del menú de la persona (no grupos/separadores), deduplicados por ruta.
  const opciones = React.useMemo(() => {
    const seen = new Set<string>();
    const out: { path: string; label: string }[] = [];
    for (const m of menu) {
      if (m.tipo === "grupo" || m.tipo === "separador") continue;
      if (!m.path || m.path === "#" || seen.has(m.path)) continue;
      seen.add(m.path);
      out.push({ path: m.path, label: m.labelCustom ?? (m.labelKey && tRoot.has(m.labelKey) ? tRoot(m.labelKey) : m.path) });
    }
    return out;
  }, [menu, tRoot]);

  const elegida = inicioRes.state.kind === "ok" ? inicioRes.state.data.elegida : null;
  const pathResuelto = inicioRes.state.kind === "ok" ? inicioRes.state.data.path : null;
  // Valor mostrado: lo pendiente de guardar, o lo ya elegido, o «automática».
  const valor = sel ?? elegida ?? AUTO;
  // Aviso: eligió una pantalla que ya no está disponible (el BE cayó a la deducida).
  const preferidaNoDisponible = !!elegida && elegida !== pathResuelto;

  async function guardar() {
    if (busy) return;
    setBusy(true);
    try {
      const prefs = await getMyPreferences();
      const base: ThemeConfig = { ...(prefs.layers.usuario ?? {}) };
      if (valor === AUTO) delete base.inicio;
      else base.inicio = valor;
      await updateMyPreferences(base);
      toast.success(t("guardado"));
      inicioRes.reload();
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const cambiado = valor !== (elegida ?? AUTO);

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold">{t("title")}</h2>
        <p className="text-xs text-muted-foreground">{t("desc")}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={valor} onValueChange={setSel}>
          <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={AUTO}>{t("auto")}</SelectItem>
            {opciones.map((o) => <SelectItem key={o.path} value={o.path}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={guardar} disabled={busy || !cambiado}>{busy ? t("guardando") : t("guardar")}</Button>
      </div>
      {preferidaNoDisponible && (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          {t("noDisponible", { elegida: elegida ?? "", actual: pathResuelto ?? "" })}
        </p>
      )}
    </section>
  );
}
