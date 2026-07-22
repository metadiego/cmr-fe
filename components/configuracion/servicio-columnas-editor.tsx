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

const TODOS = "__all__";

// Un servicio agrupado por CLAVE con su fila (id) en cada centro donde existe activo.
type ServicioMulti = {
  clave: string;
  nombre: string;
  color: string | null;
  filas: { centroId: string; id: string }[];
};

// Columnas POR SERVICIO (pedido del dueño): eliges el servicio PRIMERO y editas SUS columnas — nada de
// aplicar a todos los servicios. El selector de centro arranca en "Todos los centros": el cambio se aplica
// a la fila del servicio en CADA centro (fan-out por API); si eliges un centro, solo a ese.
export function ServicioColumnasEditor() {
  const t = useTranslations("configuracion.tableros");
  const tc = useTranslations("common");
  const tRoot = useTranslations();

  const centrosRes = useResource<Centro[]>(() => getMyCentros(), []);
  const centros = React.useMemo(
    () => (centrosRes.state.kind === "ok" ? centrosRes.state.data : []),
    [centrosRes.state],
  );
  const [centroSel, setCentroSel] = React.useState(TODOS);
  const centrosKey = centros.map((c) => c.id).join(",");

  // Servicios de TODOS los centros (para agrupar por clave y poder abanicar el cambio).
  const servAllRes = useResource<{ centroId: string; servicios: Servicio[] }[]>(
    () =>
      centros.length
        ? Promise.all(
            centros.map((c) =>
              getServicios(c.id)
                .then((servicios) => ({ centroId: c.id, servicios }))
                .catch(() => ({ centroId: c.id, servicios: [] as Servicio[] })),
            ),
          )
        : Promise.resolve([]),
    [centrosKey],
  );

  const grupos = React.useMemo<ServicioMulti[]>(() => {
    const all = servAllRes.state.kind === "ok" ? servAllRes.state.data : [];
    const fuentes = centroSel === TODOS ? all : all.filter((x) => x.centroId === centroSel);
    const map = new Map<string, ServicioMulti>();
    for (const { centroId, servicios } of fuentes) {
      for (const s of servicios) {
        if (s.activo === false) continue;
        const g = map.get(s.clave) ?? { clave: s.clave, nombre: s.nombre, color: s.color ?? null, filas: [] };
        g.filas.push({ centroId, id: s.id });
        map.set(s.clave, g);
      }
    }
    return [...map.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [servAllRes.state, centroSel]);

  const [servicioSel, setServicioSel] = React.useState("");
  const sel = grupos.find((g) => g.clave === servicioSel);
  // La vista lee las columnas de la PRIMERA fila (los centros comparten composición al editarse desde aquí).
  const primera = sel?.filas[0];

  const catRes = useResource<ColumnaCatalogo[]>(() => getColumnasCatalogo("servicios"), []);
  const catalogo = React.useMemo(
    () => (catRes.state.kind === "ok" ? catRes.state.data : []),
    [catRes.state],
  );
  const colsRes = useResource<ServicioColumna[]>(
    () => (primera ? getServicioColumnas(primera.id, primera.centroId) : Promise.resolve([])),
    [primera?.id, primera?.centroId],
  );
  const activas = React.useMemo(
    () => (colsRes.state.kind === "ok" ? [...colsRes.state.data].sort((a, b) => a.orden - b.orden) : []),
    [colsRes.state],
  );
  const activaPorClave = React.useMemo(() => new Map(activas.map((c) => [c.clave, c])), [activas]);
  const idPorClave = React.useMemo(() => new Map(catalogo.map((c) => [c.clave, c.id])), [catalogo]);

  const [busy, setBusy] = React.useState(false);

  // Aplica un cambio de composición a la fila del servicio en CADA centro seleccionado (fan-out).
  async function componerEnTodos(payload: Parameters<typeof componerServicioColumna>[1]) {
    if (!sel) return;
    const resultados = await Promise.allSettled(
      sel.filas.map((f) => componerServicioColumna(f.id, payload, f.centroId)),
    );
    const fallos = resultados.filter((r) => r.status === "rejected");
    if (fallos.length === resultados.length) throw (fallos[0] as PromiseRejectedResult).reason;
    if (fallos.length > 0) toast.warning(t("colParcial", { n: fallos.length }));
  }

  function toggle(clave: string, on: boolean) {
    const columnaId = idPorClave.get(clave);
    if (!columnaId || !sel) return;
    const actual = activaPorClave.get(clave);
    setBusy(true);
    componerEnTodos({ columnaId, visible: on, activo: on, orden: actual?.orden ?? activas.length + 1 })
      .then(() => colsRes.reload())
      .catch((err) => toastError(err, tRoot))
      .finally(() => setBusy(false));
  }

  async function mover(clave: string, dir: -1 | 1) {
    if (!sel) return;
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
      await componerEnTodos({ columnaId: aId, orden: b.orden, visible: true, activo: true });
      await componerEnTodos({ columnaId: bId, orden: a.orden, visible: true, activo: true });
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
          <Select value={centroSel} onValueChange={(v) => { setCentroSel(v); setServicioSel(""); }}>
            <SelectTrigger className="h-9 w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>{t("colTodosCentros")}</SelectItem>
              {centros.map((c) => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Select value={servicioSel} onValueChange={setServicioSel}>
          <SelectTrigger className="h-9 w-56"><SelectValue placeholder={t("colElegirServicio")} /></SelectTrigger>
          <SelectContent>
            {grupos.map((g) => (
              <SelectItem key={g.clave} value={g.clave}>
                <span className="inline-flex items-center gap-2">
                  {g.color && <span className="size-2 rounded-full" style={{ backgroundColor: g.color }} aria-hidden />}
                  {g.nombre}
                  {centroSel === TODOS && g.filas.length < centros.length && (
                    <span className="text-xs text-muted-foreground">({g.filas.length}/{centros.length})</span>
                  )}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {sel && centroSel === TODOS && (
          <span className="text-xs text-muted-foreground">{t("colAplicaEn", { n: sel.filas.length })}</span>
        )}
      </div>

      {!sel ? (
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
