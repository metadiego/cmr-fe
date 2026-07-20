"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  abrirCuadre,
  cerrarCuadre,
  enviarCuadreEmail,
  getCuadre,
  getDenominaciones,
  getReporteDia,
  type CajaDivision,
  type CuadreConItems,
} from "@/lib/api/caja";
import { apiErrorMessage } from "@/lib/api/errors";
import { toCsv } from "@/lib/caja/export";
import { useResource } from "@/hooks/use-resource";
import { useCentroGate } from "@/hooks/use-centro-gate";
import { useMe } from "@/hooks/use-me";
import { useCan } from "@/hooks/use-can";
import { CentroPicker } from "@/components/facturacion/centro-picker";
import { ConteoDenominaciones } from "@/components/caja/conteo-denominaciones";
import { ResumenPagos } from "@/components/caja/resumen-pagos";
import { DesgloseCajeros } from "@/components/caja/desglose-cajeros";
import { FacturasPendientes } from "@/components/caja/facturas-pendientes";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const GERENCIA = ["admin", "super_admin", "gerente"];
// Default de interfaz del Inicio (fondo de apertura). Acordado con el BE (PR #120): dato del FE,
// no hardcode de negocio en el backend. Configurable a futuro por centro si el negocio lo pide.
const DEFAULT_INICIO = 50;

// Alcance del cuadre: cajero fijo en sí mismo; gerencia elige consolidado o un cajero.
type Scope = "self" | "consolidated" | `user:${string}`;
function scopeUsuarioId(s: Scope): string | null | undefined {
  if (s === "self") return undefined; // el BE resuelve al propio usuario
  if (s === "consolidated") return null; // consolidado (todos)
  return s.slice("user:".length);
}

// Cuadre de Caja por DIVISIÓN (destino fijo: consulta | general, NUNCA mezclados). Multi-tenant
// por el gate de centro; RBAC cosmético para cerrar. See docs/specs/2026-07-20-cuadre-caja-design.md.
export function CuadreCaja({ division }: { division: CajaDivision }) {
  const t = useTranslations("caja");
  const tc = useTranslations("common");
  const gate = useCentroGate();
  const meState = useMe();
  const { can } = useCan();

  const me = meState.kind === "ok" ? meState.me : null;
  const isGerencia =
    !!me && (me.isMaster || me.roles.some((r) => GERENCIA.includes(r)));
  const canCerrar = can("caja.cerrar");
  const hoy = React.useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [fecha, setFecha] = React.useState(hoy);
  const [scope, setScope] = React.useState<Scope | null>(null);
  const effScope: Scope = scope ?? (isGerencia ? "consolidated" : "self");

  if (gate.cargando || meState.kind === "loading") {
    return (
      <Shell division={division}>
        <p className="text-sm text-muted-foreground">{tc("loading")}</p>
      </Shell>
    );
  }
  if (gate.sinCentro) {
    return (
      <Shell division={division}>
        <p className="text-sm text-muted-foreground">{t("sinCentro")}</p>
      </Shell>
    );
  }
  if (gate.necesitaPicker) {
    return (
      <Shell division={division}>
        <CentroPicker centros={gate.centros} onPick={gate.pick} />
      </Shell>
    );
  }

  return (
    <Shell division={division} centroNombre={gate.centroNombre}>
      <div className="mb-4 flex items-center gap-2">
        <Label htmlFor="caja-fecha" className="text-sm text-muted-foreground">
          {t("date")}
        </Label>
        <Input
          id="caja-fecha"
          type="date"
          value={fecha}
          max={hoy}
          onChange={(e) => setFecha(e.target.value || hoy)}
          className="h-9 w-40"
        />
      </div>

      <Panel
        key={`${division}:${effScope}:${gate.centro}:${fecha}`}
        division={division}
        fecha={fecha}
        esHoy={fecha === hoy}
        scope={effScope}
        setScope={setScope}
        isGerencia={isGerencia}
        meId={me?.id ?? null}
        canCerrar={canCerrar}
        centro={gate.centro}
      />
    </Shell>
  );
}

function Shell({
  division,
  children,
  centroNombre,
}: {
  division: CajaDivision;
  children: React.ReactNode;
  centroNombre?: string;
}) {
  const t = useTranslations("caja");
  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div
        className={cn(
          "mb-1 flex flex-wrap items-center gap-3 border-l-4 pl-3",
          division === "consulta" ? "border-l-sky-500" : "border-l-emerald-500",
        )}
      >
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("title")} — {t(`division.${division}`)}
        </h1>
        {centroNombre && (
          <Badge variant="secondary" className="font-normal">
            {centroNombre}
          </Badge>
        )}
      </div>
      <p className="mb-6 pl-3 text-sm text-muted-foreground">{t("help")}</p>
      {children}
    </div>
  );
}

function Panel({
  division,
  fecha,
  esHoy,
  scope,
  setScope,
  isGerencia,
  meId,
  canCerrar,
  centro,
}: {
  division: CajaDivision;
  fecha: string;
  esHoy: boolean;
  scope: Scope;
  setScope: (s: Scope) => void;
  isGerencia: boolean;
  meId: string | null;
  canCerrar: boolean;
  centro?: string;
}) {
  const t = useTranslations("caja");
  const tc = useTranslations("common");

  const usuarioId = scopeUsuarioId(scope);
  const reporte = useResource(() => getReporteDia(fecha, division, usuarioId), []);
  const denoms = useResource(() => getDenominaciones(), []);

  const [cuadre, setCuadre] = React.useState<CuadreConItems | null>(null);
  // Default de INTERFAZ del Inicio (fondo de apertura), acordado con el BE (PR #120): el backend
  // NO lo hardcodea, lo aporta el FE. Editable y sincronizable en vivo antes del cierre.
  const [petty, setPetty] = React.useState<string>(String(DEFAULT_INICIO));
  const [opening, setOpening] = React.useState(false);
  const [closing, setClosing] = React.useState(false);
  const [emailing, setEmailing] = React.useState(false);
  const syncTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(
    () => () => {
      if (syncTimer.current) clearTimeout(syncTimer.current);
    },
    [],
  );

  async function abrir() {
    setOpening(true);
    try {
      const abierto = await abrirCuadre({
        division,
        usuarioId,
        fecha,
        pettyDeclarado: Math.max(0, Number(petty) || 0),
      });
      const full = await getCuadre(abierto.id);
      setCuadre(full);
      // Refleja el Inicio real que quedó en el BE (retomar puede traer otro valor).
      setPetty(String(full.pettyDeclarado));
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setOpening(false);
    }
  }

  // Inicio editable EN VIVO: el BE sincroniza el fondo al retomar un cuadre abierto (PR #120),
  // así que re-abrimos (idempotente) con el nuevo valor y refrescamos. Debounced.
  function onInicio(v: string) {
    setPetty(v);
    if (cuadre?.estado !== "abierto") return;
    const id = cuadre.id;
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(async () => {
      try {
        await abrirCuadre({
          division,
          usuarioId,
          fecha,
          pettyDeclarado: Math.max(0, Number(v) || 0),
        });
        setCuadre(await getCuadre(id));
      } catch (err) {
        toast.error(apiErrorMessage(err));
      }
    }, 600);
  }

  async function cerrar() {
    if (!cuadre) return;
    setClosing(true);
    try {
      setCuadre(await cerrarCuadre(cuadre.id));
      reporte.reload();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setClosing(false);
    }
  }

  async function enviarEmail(email: string) {
    if (!cuadre) return;
    setEmailing(true);
    try {
      await enviarCuadreEmail(cuadre.id, { email });
      toast.success(t("emailSent"));
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setEmailing(false);
    }
  }

  function exportar() {
    if (reporte.state.kind !== "ok") return;
    const r = reporte.state.data;
    const rows: Array<Array<string | number>> = [
      [t("title"), t(`division.${division}`), fecha],
      [],
      [t("payments.cards")],
      [t("payments.type"), t("payments.qty"), t("payments.amount")],
      ...r.detalle.tarjetas.map((x) => [x.nombre, x.cantidad, x.monto]),
      [t("payments.totalCards"), "", r.detalle.totalTarjetas],
      [],
      [t("payments.otherMethods")],
      ...r.detalle.otros.map((x) => [x.nombre, x.cantidad, x.monto]),
      [],
      [t("payments.general")],
      [t("payments.cash"), r.detalle.efectivo.monto],
      [t("payments.electronic"), r.detalle.totalElectronicas],
      [t("payments.totalDivision"), r.detalle.total],
      [t("payments.returns"), r.devoluciones.total],
      [t("summary.counted"), cuadre?.efectivoContado ?? 0],
      [t("summary.variance"), cuadre?.diferencia ?? 0],
    ];
    const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cuadre-${division}-${fecha}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t("exported"));
  }

  function imprimir() {
    window.print();
  }

  const inicialConteo = React.useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of cuadre?.conteo ?? []) m[c.denominacionId] = c.cantidad;
    return m;
  }, [cuadre]);

  if (reporte.state.kind === "loading" || denoms.state.kind === "loading") {
    return <p className="text-sm text-muted-foreground">{tc("loading")}</p>;
  }
  if (reporte.state.kind !== "ok") {
    return <p className="text-sm text-destructive">{reporte.state.message}</p>;
  }

  const rep = reporte.state.data;
  const porCajero = rep.porCajero ?? [];

  return (
    <div className="space-y-4">
      {/* Selector de alcance (solo gerencia) */}
      {isGerencia && (
        <div className="flex items-center gap-2">
          <Label className="text-sm text-muted-foreground">{t("scope.label")}</Label>
          <Select value={scope} onValueChange={(v) => setScope(v as Scope)}>
            <SelectTrigger className="h-9 w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="consolidated">{t("scope.consolidated")}</SelectItem>
              {porCajero
                .filter((c) => c.usuarioId)
                .map((c) => (
                  <SelectItem key={c.usuarioId} value={`user:${c.usuarioId}`}>
                    {c.nombre ?? (c.usuarioId === meId ? t("scope.mine") : (c.usuarioId ?? "").slice(0, 8))}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        {/* Panel izquierdo: conteo + resumen por cajero */}
        <div className="space-y-4">
          {cuadre?.estado === "abierto" && denoms.state.kind === "ok" ? (
            <ConteoDenominaciones
              cuadreId={cuadre.id}
              denominaciones={denoms.state.data}
              inicial={inicialConteo}
              onSaved={setCuadre}
            />
          ) : !cuadre ? (
            <div className="rounded-xl border p-4">
              <h3 className="mb-1 text-sm font-semibold">{t("count.title")}</h3>
              <p className="text-sm text-muted-foreground">
                {esHoy ? t("count.hint") : t("historyReadonly")}
              </p>
            </div>
          ) : null}

          {isGerencia && (
            <DesgloseCajeros
              cajeros={porCajero}
              meId={meId}
              activeUsuarioId={scope.startsWith("user:") ? scope.slice(5) : null}
              onPick={(uid) => setScope(uid ? (`user:${uid}` as Scope) : "consolidated")}
            />
          )}
        </div>

        {/* Panel derecho: resumen de pagos + acciones */}
        <ResumenPagos
          division={division}
          detalle={rep.detalle}
          ventas={rep.ventas}
          devoluciones={rep.devoluciones}
          cuadre={cuadre}
          esHoy={esHoy}
          canCerrar={canCerrar}
          petty={petty}
          setPetty={onInicio}
          opening={opening}
          closing={closing}
          emailing={emailing}
          onOpen={abrir}
          onClose={cerrar}
          onEmail={enviarEmail}
          onExport={exportar}
          onPrint={imprimir}
        />
      </div>

      {/* Facturas pendientes */}
      <FacturasPendientes pendientes={rep.pendientes} centroId={centro} />
    </div>
  );
}
