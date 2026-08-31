"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, CheckmarkCircle02Icon } from "@hugeicons/core-free-icons";

import {
  listVialesAbiertos,
  listPresentaciones,
  createPresentacion,
  updatePresentacion,
  listUnidades,
  type VialAbierto,
  type Presentacion,
  type Unidad,
} from "@/lib/api/inventario";
import { apiErrorMessage } from "@/lib/api/errors";
import { useResource } from "@/hooks/use-resource";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const nf = new Intl.NumberFormat("es-PR", { maximumFractionDigits: 2 });

// Ficha del producto: viales ABIERTOS con su remanente (para no abrir otro teniendo uno a medias) y las
// PRESENTACIONES del vial (cambiar de vial = elegir la activa, sin borrar). Autocontenido: trae sus datos
// y las unidades por su cuenta. Handoff HANDOFF-viales-presentaciones-y-remanente.
export function VialYPresentaciones({ productoId }: { productoId: string }) {
  const t = useTranslations("inventario.viales");
  const unidadesRes = useResource<Unidad[]>(() => listUnidades(), []);
  const unidadNombre = React.useMemo(() => {
    const m = new Map<string, string>();
    if (unidadesRes.state.kind === "ok") unidadesRes.state.data.forEach((u) => m.set(u.id, u.nombre));
    return m;
  }, [unidadesRes.state]);
  const un = (id?: string | null) => (id ? unidadNombre.get(id) ?? "" : "");

  return (
    <div className="space-y-5 rounded-xl border p-4">
      <VialesAbiertos productoId={productoId} un={un} t={t} />
      <Presentaciones productoId={productoId} un={un} unidades={unidadesRes.state.kind === "ok" ? unidadesRes.state.data : []} t={t} />
    </div>
  );
}

type T = ReturnType<typeof useTranslations>;

// ————— Viales abiertos con remanente —————
function VialesAbiertos({ productoId, un, t }: { productoId: string; un: (id?: string | null) => string; t: T }) {
  const { state } = useResource<VialAbierto[]>(() => listVialesAbiertos(productoId), [productoId]);
  const viales = React.useMemo(() => {
    const list = state.kind === "ok" ? state.data : [];
    // Más viejo primero: es el orden en que el sistema los consume.
    return [...list].sort((a, b) => String(a.fechaApertura ?? a.createdAt ?? "").localeCompare(String(b.fechaApertura ?? b.createdAt ?? "")));
  }, [state]);

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">{t("abiertosTitle")}</h3>
      {state.kind === "loading" && <p className="text-xs text-muted-foreground">{t("cargando")}</p>}
      {state.kind === "ok" && viales.length === 0 && (
        <p className="rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">{t("sinAbiertos")}</p>
      )}
      <ul className="space-y-2">
        {viales.map((v) => {
          const unidad = un(v.unidadId);
          const pct = Math.max(0, Math.min(100, Number(v.porcentajeUsado ?? 0)));
          const remanente = Number(v.remanente ?? 0);
          const excedido = Number(v.excedido ?? 0);
          return (
            <li key={v.id} className="rounded-xl bg-card p-3 shadow-sm shadow-[rgba(16,32,64,0.06)] ring-1 ring-foreground/10">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium">
                  {t("vialDe", { capacidad: nf.format(Number(v.capacidadTotal ?? 0)), unidad })}
                </span>
                {excedido > 0 ? (
                  <span className="rounded-md bg-warning px-2 py-0.5 text-xs font-semibold text-warning-foreground">
                    {t("excedido", { n: nf.format(excedido), unidad })}
                  </span>
                ) : (
                  <span className="tabular-nums">
                    <span className="text-xl font-bold">{nf.format(remanente)}</span>
                    <span className="ml-1 text-xs font-medium text-muted-foreground">{unidad} {t("restan")}</span>
                  </span>
                )}
              </div>
              {/* Barra de uso: cuánto se ha consumido de ESE vial. */}
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={"h-full rounded-full " + (excedido > 0 ? "bg-warning-foreground" : pct >= 80 ? "bg-warning-foreground" : "bg-primary")}
                  style={{ width: `${excedido > 0 ? 100 : pct}%` }}
                />
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {t("consumidoDe", { consumido: nf.format(Number(v.consumido ?? 0)), total: nf.format(Number(v.capacidadTotal ?? 0)), unidad })}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ————— Presentaciones del vial (elegir la activa) —————
function Presentaciones({
  productoId,
  un,
  unidades,
  t,
}: {
  productoId: string;
  un: (id?: string | null) => string;
  unidades: Unidad[];
  t: T;
}) {
  const { state, reload } = useResource<Presentacion[]>(() => listPresentaciones(productoId), [productoId]);
  const presentaciones = state.kind === "ok" ? state.data : [];
  const [busy, setBusy] = React.useState(false);
  const [creando, setCreando] = React.useState(false);
  const [nombre, setNombre] = React.useState("");
  const [contenido, setContenido] = React.useState("");
  const [unidadId, setUnidadId] = React.useState("");

  // Solo unidades de masa/volumen (mg, mL…): el contenido del vial se mide así, no en "caja".
  const unidadesContenido = React.useMemo(
    () => unidades.filter((u) => u.dimension === "masa" || u.dimension === "volumen"),
    [unidades],
  );

  async function activar(p: Presentacion) {
    if (p.esDefault || busy) return;
    setBusy(true);
    try {
      await updatePresentacion(p.id, { esDefault: true });
      toast.success(t("activada", { nombre: p.nombre }));
      reload();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function toggleActivo(p: Presentacion) {
    setBusy(true);
    try {
      await updatePresentacion(p.id, { activo: !p.activo });
      reload();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function crear() {
    const c = Number(contenido);
    if (!nombre.trim() || !contenido.trim() || Number.isNaN(c) || c <= 0 || !unidadId) {
      toast.error(t("crearInvalido"));
      return;
    }
    setBusy(true);
    try {
      await createPresentacion({ productoId, nombre: nombre.trim(), contenido: c, unidadContenidoId: unidadId });
      toast.success(t("creada"));
      setNombre("");
      setContenido("");
      setUnidadId("");
      setCreando(false);
      reload();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">{t("presentacionesTitle")}</h3>
      {state.kind === "loading" && <p className="text-xs text-muted-foreground">{t("cargando")}</p>}
      <ul className="space-y-1.5">
        {presentaciones.map((p) => {
          const tieneVial = p.contenido != null;
          return (
            <li
              key={p.id}
              className={
                "flex items-center gap-3 rounded-lg border px-3 py-2 " +
                (p.esDefault ? "border-primary bg-primary/5 " : "") +
                (p.activo === false ? "opacity-50" : "")
              }
            >
              {/* Radio de "activa" (esDefault): cambiar de vial = un clic. */}
              <button
                type="button"
                onClick={() => activar(p)}
                disabled={busy || p.activo === false}
                aria-label={t("marcarActiva")}
                className="shrink-0 text-primary disabled:opacity-40"
              >
                {p.esDefault ? (
                  <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-5" />
                ) : (
                  <span className="inline-block size-4 rounded-full border-2 border-muted-foreground/40" />
                )}
              </button>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{p.nombre}</div>
                <div className="text-[11px] text-muted-foreground">
                  {tieneVial
                    ? t("contenidoVial", { contenido: nf.format(Number(p.contenido)), unidad: un(p.unidadContenidoId) })
                    : t("sinVial")}
                  {p.esDefault ? ` · ${t("activa")}` : ""}
                </div>
              </div>
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => toggleActivo(p)}>
                {p.activo === false ? t("reactivar") : t("dejarDeComprar")}
              </Button>
            </li>
          );
        })}
      </ul>

      {creando ? (
        <div className="space-y-2 rounded-lg border border-dashed p-3">
          <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder={t("nombrePlaceholder")} className="h-8" />
          <div className="flex gap-2">
            <Input value={contenido} onChange={(e) => setContenido(e.target.value)} inputMode="decimal" placeholder={t("contenidoPlaceholder")} className="h-8 w-28" />
            <Select value={unidadId} onValueChange={setUnidadId}>
              <SelectTrigger className="h-8 flex-1"><SelectValue placeholder={t("unidadPlaceholder")} /></SelectTrigger>
              <SelectContent>
                {unidadesContenido.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={crear} disabled={busy || !nombre.trim() || !contenido.trim() || !unidadId}>{t("crear")}</Button>
            <Button size="sm" variant="ghost" onClick={() => setCreando(false)}>{t("cancelar")}</Button>
          </div>
        </div>
      ) : (
        <Button type="button" size="sm" variant="outline" onClick={() => setCreando(true)}>
          <HugeiconsIcon icon={Add01Icon} className="size-4" />
          {t("nuevaPresentacion")}
        </Button>
      )}

      {/* El cambio de activa NO recalcula los viales ya abiertos. */}
      <p className="rounded-lg bg-muted/50 px-3 py-2 text-[11px] text-muted-foreground">{t("avisoDesdeAhora")}</p>
    </section>
  );
}
