"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  getServicios,
  getServicioColumnas,
  componerServicioColumna,
  type Servicio,
  type ServicioColumna,
} from "@/lib/api/servicios";
import { getColumnasCatalogo, type ColumnaCatalogo } from "@/lib/api/tablero";
import { getMyCentros, type Centro } from "@/lib/api/centers";
import { toastError } from "@/lib/api/errors";
import { useResource } from "@/hooks/use-resource";
import { Switch } from "@/components/ui/switch";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowUp01Icon, ArrowDown01Icon } from "@hugeicons/core-free-icons";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Columnas POR SERVICIO (pedido del dueño): eliges el servicio PRIMERO y editas SUS columnas — nada de
// aplicar a todos. Encender/apagar y reordenar guardan al instante vía POST /servicios/:id/columnas
// (ComponerColumnaDto). El catálogo de columnas elegibles viene del vertical `servicios` (data-driven).
export function ServicioColumnasEditor() {
  const t = useTranslations("configuracion.tableros");
  const tc = useTranslations("common");
  const tRoot = useTranslations();

  // Centro (los servicios y su composición son por centro) + servicio (obligatorio antes de tocar nada).
  const centrosRes = useResource<Centro[]>(() => getMyCentros(), []);
  const centros = React.useMemo(
    () => (centrosRes.state.kind === "ok" ? centrosRes.state.data : []),
    [centrosRes.state],
  );
  const [centroSel, setCentroSel] = React.useState("");
  const centro = centroSel || centros[0]?.id || "";

  const servRes = useResource<Servicio[]>(
    () => (centro ? getServicios(centro) : Promise.resolve([])),
    [centro],
  );
  const servicios = React.useMemo(
    () =>
      (servRes.state.kind === "ok" ? servRes.state.data : [])
        .filter((s) => s.activo !== false)
        .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0) || a.nombre.localeCompare(b.nombre)),
    [servRes.state],
  );
  const [servicioSel, setServicioSel] = React.useState("");
  const servicio = servicios.find((s) => s.id === servicioSel);

  const catRes = useResource<ColumnaCatalogo[]>(() => getColumnasCatalogo("servicios"), []);
  const catalogo = React.useMemo(
    () => (catRes.state.kind === "ok" ? catRes.state.data : []),
    [catRes.state],
  );
  const colsRes = useResource<ServicioColumna[]>(
    () => (servicio ? getServicioColumnas(servicio.id, centro) : Promise.resolve([])),
    [servicio?.id, centro],
  );
  const activas = React.useMemo(
    () => (colsRes.state.kind === "ok" ? [...colsRes.state.data].sort((a, b) => a.orden - b.orden) : []),
    [colsRes.state],
  );
  const activaPorClave = React.useMemo(() => new Map(activas.map((c) => [c.clave, c])), [activas]);
  const idPorClave = React.useMemo(() => new Map(catalogo.map((c) => [c.clave, c.id])), [catalogo]);

  const [busy, setBusy] = React.useState(false);
  async function componer(payload: Parameters<typeof componerServicioColumna>[1]) {
    if (!servicio) return;
    setBusy(true);
    try {
      await componerServicioColumna(servicio.id, payload, centro);
      colsRes.reload();
    } catch (err) {
      toastError(err, tRoot);
    } finally {
      setBusy(false);
    }
  }

  // Encender/apagar la columna EN ESTE SERVICIO.
  function toggle(clave: string, on: boolean) {
    const columnaId = idPorClave.get(clave);
    if (!columnaId) {
      toast.error(tc("error"));
      return;
    }
    const actual = activaPorClave.get(clave);
    void componer({ columnaId, visible: on, activo: on, orden: actual?.orden ?? activas.length + 1 });
  }

  // Reordenar dentro de las activas: intercambia `orden` con la vecina (2 POST).
  async function mover(clave: string, dir: -1 | 1) {
    if (!servicio) return;
    const i = activas.findIndex((c) => c.clave === clave);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= activas.length) return;
    const a = activas[i];
    const b = activas[j];
    const aId = idPorClave.get(a.clave);
    const bId = idPorClave.get(b.clave);
    if (!aId || !bId) return;
    setBusy(true);
    try {
      await componerServicioColumna(servicio.id, { columnaId: aId, orden: b.orden, visible: true, activo: true }, centro);
      await componerServicioColumna(servicio.id, { columnaId: bId, orden: a.orden, visible: true, activo: true }, centro);
      colsRes.reload();
    } catch (err) {
      toastError(err, tRoot);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {centros.length > 1 && (
          <Select value={centro} onValueChange={(v) => { setCentroSel(v); setServicioSel(""); }}>
            <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              {centros.map((c) => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Select value={servicioSel} onValueChange={setServicioSel}>
          <SelectTrigger className="h-9 w-56"><SelectValue placeholder={t("colElegirServicio")} /></SelectTrigger>
          <SelectContent>
            {servicios.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                <span className="inline-flex items-center gap-2">
                  {s.color && <span className="size-2 rounded-full" style={{ backgroundColor: s.color }} aria-hidden />}
                  {s.nombre}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!servicio ? (
        <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          {t("colElegirServicioHint")}
        </p>
      ) : colsRes.state.kind === "loading" || catRes.state.kind === "loading" ? (
        <p className="text-sm text-muted-foreground">{tc("loading")}</p>
      ) : (
        <ul className="space-y-1.5">
          {/* Activas primero (en su orden), luego las disponibles apagadas. */}
          {[...activas.map((c) => c.clave), ...catalogo.map((c) => c.clave).filter((k) => !activaPorClave.has(k))].map((clave) => {
            const activa = activaPorClave.get(clave);
            const cat = catalogo.find((c) => c.clave === clave);
            const labelKey = activa?.labelKey ?? cat?.labelKey ?? clave;
            const idx = activas.findIndex((c) => c.clave === clave);
            return (
              <li
                key={clave}
                className={
                  "flex items-center gap-3 rounded-lg border px-3 py-2 " + (activa ? "" : "opacity-60")
                }
              >
                <div className="flex flex-col">
                  <button
                    type="button"
                    onClick={() => mover(clave, -1)}
                    disabled={!activa || idx <= 0 || busy}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                    aria-label={t("moveUp")}
                  >
                    <HugeiconsIcon icon={ArrowUp01Icon} className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => mover(clave, 1)}
                    disabled={!activa || idx < 0 || idx >= activas.length - 1 || busy}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                    aria-label={t("moveDown")}
                  >
                    <HugeiconsIcon icon={ArrowDown01Icon} className="size-4" />
                  </button>
                </div>
                <span className="flex-1 text-sm font-medium">
                  {tRoot(labelKey)}
                  <span className="ml-2 font-mono text-xs text-muted-foreground">· {clave}</span>
                </span>
                <Switch
                  checked={!!activa}
                  disabled={busy}
                  onCheckedChange={(v) => toggle(clave, v === true)}
                  aria-label={tRoot(labelKey)}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
