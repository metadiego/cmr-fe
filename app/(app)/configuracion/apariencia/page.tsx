"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  getSystemPreferences,
  updateSystemPreferences,
  getCentroPreferences,
  updateCentroPreferences,
  listOverrides,
  createOverride,
  deleteOverride,
  type Override,
} from "@/lib/api/preferences";
import { getMyCentros, type Centro } from "@/lib/api/centers";
import type { ThemeConfig } from "@/lib/theme/config";
import { mezclarSoloTema } from "@/lib/theme/mezclar-capa";
import { useCan } from "@/hooks/use-can";
import { apiErrorMessage } from "@/lib/api/errors";
import { formatFechaSolo } from "@/lib/format/fecha";
import { ThemeEditor } from "@/components/theme/theme-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// APARIENCIA CORPORATIVA: las capas que NO son del usuario — sistema (lo que ven todos por defecto),
// centro (cada oficina) y los overrides temporales, que mientras están activos pisan a todo el mundo.
// La apariencia PERSONAL vive en /settings/appearance y se llega desde el avatar.
//
// Las claves que se editan aquí son SOLO las de tema; el `config` de cada capa es un sobre libre que
// también lleva ajustes de negocio (p. ej. `facturacion.exigirCobroAntesDeEmitir` en la capa centro), así
// que se lee, se mezcla y se escribe. Pisar el sobre entero rompería la facturación del centro.
// See docs/specs/apariencia-personal-en-el-avatar-y-corporativa-en-configuracion.md

/** Lo que puede estar pasando con cada capa mientras se lee del BE. */
type Estado<T> =
  | { kind: "loading" }
  | { kind: "ok"; value: T }
  | { kind: "fail"; message: string };

export default function AparienciaCorporativaPage() {
  const t = useTranslations("aparienciaCorporativa");
  const { can } = useCan();
  const puedeSistema = can("preferences.update") || can("*");
  // Los overrides los crea y quita quien puede escribir preferencias corporativas (el BE los reserva a
  // super_admin). Se usa el permiso que EXISTE en el catálogo, no uno inventado.
  const puedeOverride = can("preferences.create") || can("*");

  // --- capa SISTEMA ---
  const [sistema, setSistema] = React.useState<Estado<ThemeConfig>>({ kind: "loading" });
  const originalSistema = React.useRef<ThemeConfig | null>(null);
  const [guardandoSistema, setGuardandoSistema] = React.useState(false);

  // --- capa CENTRO ---
  const [centros, setCentros] = React.useState<Centro[]>([]);
  const [centroId, setCentroId] = React.useState<string>("");
  const [centro, setCentro] = React.useState<Estado<ThemeConfig>>({ kind: "loading" });
  const originalCentro = React.useRef<ThemeConfig | null>(null);
  const [guardandoCentro, setGuardandoCentro] = React.useState(false);

  // --- OVERRIDES ---
  const [overrides, setOverrides] = React.useState<Override[]>([]);
  const [nombreOverride, setNombreOverride] = React.useState("");
  const [hastaOverride, setHastaOverride] = React.useState("");
  const [creando, setCreando] = React.useState(false);

  React.useEffect(() => {
    getSystemPreferences()
      .then((c) => {
        originalSistema.current = c;
        setSistema({ kind: "ok", value: c });
      })
      .catch((e) => setSistema({ kind: "fail", message: apiErrorMessage(e) }));
    getMyCentros()
      .then((cs) => {
        setCentros(cs);
        if (cs[0]?.id) setCentroId(cs[0].id);
      })
      .catch(() => setCentros([]));
    if (puedeOverride) listOverrides().then(setOverrides).catch(() => setOverrides([]));
  }, [puedeOverride]);

  // Mismo patrón que el resto del panel de administración (rbac-settings, centers-list): el efecto
  // solo lanza la lectura y escribe el estado en el callback, con guardia `active` por si el usuario
  // cambia de centro antes de que responda. El estado `loading` lo pone quien cambia el select.
  React.useEffect(() => {
    if (!centroId) return;
    let active = true;
    getCentroPreferences(centroId)
      .then((c) => {
        if (!active) return;
        originalCentro.current = c;
        setCentro({ kind: "ok", value: c });
      })
      .catch((e) => active && setCentro({ kind: "fail", message: apiErrorMessage(e) }));
    return () => {
      active = false;
    };
  }, [centroId]);

  async function guardarSistema() {
    if (sistema.kind !== "ok") return;
    setGuardandoSistema(true);
    try {
      await updateSystemPreferences(
        mezclarSoloTema(originalSistema.current, sistema.value),
      );
      toast.success(t("savedSystem"));
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setGuardandoSistema(false);
    }
  }

  async function guardarCentro() {
    if (centro.kind !== "ok" || !centroId) return;
    setGuardandoCentro(true);
    try {
      await updateCentroPreferences(
        centroId,
        mezclarSoloTema(originalCentro.current, centro.value),
      );
      toast.success(t("savedCentro"));
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setGuardandoCentro(false);
    }
  }

  async function crearOverride() {
    if (sistema.kind !== "ok" || !nombreOverride.trim()) return;
    setCreando(true);
    try {
      const nuevo = await createOverride({
        nombre: nombreOverride.trim(),
        config: mezclarSoloTema(null, sistema.value),
        ...(hastaOverride ? { vigenteHasta: hastaOverride } : {}),
      });
      setOverrides((prev) => [nuevo, ...prev]);
      setNombreOverride("");
      setHastaOverride("");
      toast.success(t("overrideCreated"));
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setCreando(false);
    }
  }

  async function quitarOverride(o: Override) {
    // Un DELETE que le cambia la pantalla a todo el mundo al instante y no se puede deshacer: se
    // pregunta, igual que antes de borrar un rol o revocar un centro.
    if (!window.confirm(t("overrideRemoveConfirm", { nombre: o.nombre || o.id }))) return;
    const id = o.id;
    try {
      await deleteOverride(id);
      setOverrides((prev) => prev.filter((o) => o.id !== id));
      toast.success(t("overrideRemoved"));
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  }

  if (!puedeSistema && !puedeOverride) {
    return (
      <div className="px-6 py-12">
        <p className="text-sm text-muted-foreground">{t("noAccess")}</p>
      </div>
    );
  }

  return (
    <div className="w-full px-6 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{t("description")}</p>
      </header>

      {/* Dos columnas en pantallas anchas: se usa todo el ancho, sin desperdiciar los lados. */}
      <div className="grid gap-6 xl:grid-cols-2">
        {puedeSistema && (
          <section className="rounded-md ring-1 ring-foreground/10 bg-card p-6 shadow-sm shadow-[rgba(16,32,64,0.06)] backdrop-blur">
            <h2 className="text-sm font-medium">{t("systemTitle")}</h2>
            <p className="mb-4 text-xs text-muted-foreground">{t("systemHint")}</p>
            {sistema.kind === "loading" && (
              <p className="text-sm text-muted-foreground">{t("loading")}</p>
            )}
            {sistema.kind === "fail" && (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {sistema.message}
              </p>
            )}
            {sistema.kind === "ok" && (
              <>
                <ThemeEditor
                  value={sistema.value}
                  onChange={(value) => setSistema({ kind: "ok", value })}
                />
                <Button
                  className="mt-6"
                  onClick={guardarSistema}
                  disabled={guardandoSistema}
                >
                  {guardandoSistema ? t("saving") : t("saveSystem")}
                </Button>
              </>
            )}
          </section>
        )}

        {puedeSistema && (
          <section className="rounded-md ring-1 ring-foreground/10 bg-card p-6 shadow-sm shadow-[rgba(16,32,64,0.06)] backdrop-blur">
            <h2 className="text-sm font-medium">{t("centroTitle")}</h2>
            <p className="mb-4 text-xs text-muted-foreground">{t("centroHint")}</p>
            <div className="mb-4 space-y-2">
              <Label htmlFor="ap-centro">{t("centroLabel")}</Label>
              <Select
                value={centroId}
                onValueChange={(v) => {
                  // El "cargando" lo dispara la acción del usuario, no el efecto.
                  setCentro({ kind: "loading" });
                  setCentroId(v);
                }}
              >
                <SelectTrigger id="ap-centro">
                  <SelectValue placeholder={t("centroPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {centros.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {centros.length === 0 && (
              <p className="text-sm text-muted-foreground">{t("centroVacio")}</p>
            )}
            {centros.length > 0 && centro.kind === "loading" && (
              <p className="text-sm text-muted-foreground">{t("loading")}</p>
            )}
            {centro.kind === "fail" && (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {centro.message}
              </p>
            )}
            {centro.kind === "ok" && (
              <>
                <ThemeEditor
                  value={centro.value}
                  onChange={(value) => setCentro({ kind: "ok", value })}
                />
                <Button
                  className="mt-6"
                  onClick={guardarCentro}
                  disabled={guardandoCentro || !centroId}
                >
                  {guardandoCentro ? t("saving") : t("saveCentro")}
                </Button>
              </>
            )}
          </section>
        )}

        {puedeOverride && (
          <section className="rounded-md ring-1 ring-foreground/10 bg-card p-6 shadow-sm shadow-[rgba(16,32,64,0.06)] backdrop-blur xl:col-span-2">
            <h2 className="text-sm font-medium">{t("overrideTitle")}</h2>
            <p className="mb-4 text-xs text-muted-foreground">{t("overrideHint")}</p>

            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-56 flex-1 space-y-2">
                <Label htmlFor="ov-nombre">{t("overrideName")}</Label>
                <Input
                  id="ov-nombre"
                  value={nombreOverride}
                  onChange={(e) => setNombreOverride(e.target.value)}
                  placeholder={t("overrideNamePlaceholder")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ov-hasta">{t("overrideUntil")}</Label>
                <Input
                  id="ov-hasta"
                  type="date"
                  value={hastaOverride}
                  onChange={(e) => setHastaOverride(e.target.value)}
                />
              </div>
              <Button
                onClick={crearOverride}
                disabled={creando || !nombreOverride.trim() || sistema.kind !== "ok"}
              >
                {creando ? t("saving") : t("overrideCreate")}
              </Button>
            </div>

            <ul className="mt-6 divide-y">
              {overrides.length === 0 && (
                <li className="py-3 text-sm text-muted-foreground">{t("overrideEmpty")}</li>
              )}
              {overrides.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{o.nombre || o.id}</p>
                    <p className="text-xs text-muted-foreground">
                      {o.vigenteHasta
                        ? t("overrideUntilValue", { fecha: formatFechaSolo(o.vigenteHasta) })
                        : t("overrideNoEnd")}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => quitarOverride(o)}
                  >
                    {t("overrideRemove")}
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
