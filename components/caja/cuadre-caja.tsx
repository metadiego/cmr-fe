"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  abrirCuadre,
  cerrarCuadre,
  getCuadre,
  getDenominaciones,
  getReporteDia,
  type CajaDivision,
  type CuadreConItems,
} from "@/lib/api/caja";
import { getFormasPago, type FormaPago } from "@/lib/api/facturas";
import { apiErrorMessage } from "@/lib/api/errors";
import { money } from "@/lib/caja/totales";
import { formaPagoLabel } from "@/lib/facturacion/forma-pago-label";
import { useResource } from "@/hooks/use-resource";
import { useCentroGate } from "@/hooks/use-centro-gate";
import { useMe } from "@/hooks/use-me";
import { useCan } from "@/hooks/use-can";
import { CentroPicker } from "@/components/facturacion/centro-picker";
import { ConteoDenominaciones } from "@/components/caja/conteo-denominaciones";
import { ResumenEsperado } from "@/components/caja/resumen-esperado";
import { DesgloseCajeros } from "@/components/caja/desglose-cajeros";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const GERENCIA = ["admin", "super_admin", "gerente"];

// Alcance del cuadre: cajero fijo en sí mismo; gerencia elige consolidado o un cajero.
type Scope = "self" | "consolidated" | `user:${string}`;
function scopeUsuarioId(s: Scope): string | null | undefined {
  if (s === "self") return undefined; // el BE resuelve al propio usuario
  if (s === "consolidated") return null; // consolidado (todos)
  return s.slice("user:".length);
}

// Cuadre de caja (FE). Dos ejes SIN mezclar: división (Consulta/General) y cajero (propio /
// consolidado de gerencia). Multi-tenant por el gate de centro; RBAC cosmético para Cerrar.
// See docs/specs/2026-07-20-cuadre-caja-design.md.
export function CuadreCaja() {
  const t = useTranslations("caja");
  const tc = useTranslations("common");
  const gate = useCentroGate();
  const meState = useMe();
  const { can } = useCan();

  const me = meState.kind === "ok" ? meState.me : null;
  const isGerencia = !!me && (me.isMaster || me.roles.some((r) => GERENCIA.includes(r)));
  const canCerrar = can("caja.cerrar");
  const hoy = React.useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [fecha, setFecha] = React.useState(hoy);
  const [division, setDivision] = React.useState<CajaDivision>("general");
  // Default derivado (no efecto): gerencia arranca en consolidado; cajero en sí mismo. `me` se
  // resuelve antes del render principal (early-return de loading), así el default ya es correcto.
  const [scope, setScope] = React.useState<Scope | null>(null);
  const effScope: Scope = scope ?? (isGerencia ? "consolidated" : "self");

  if (gate.cargando || meState.kind === "loading") {
    return <Shell>{<p className="text-sm text-muted-foreground">{tc("loading")}</p>}</Shell>;
  }
  if (gate.sinCentro) {
    return <Shell>{<p className="text-sm text-muted-foreground">{t("sinCentro")}</p>}</Shell>;
  }
  if (gate.necesitaPicker) {
    return (
      <Shell>
        <CentroPicker centros={gate.centros} onPick={gate.pick} />
      </Shell>
    );
  }

  return (
    <Shell centroNombre={gate.centroNombre}>
      <div className="mb-4 flex flex-wrap items-end gap-4">
        <Tabs value={division} onValueChange={(v) => setDivision(v as CajaDivision)}>
          <TabsList>
            <TabsTrigger value="consulta">{t("division.consulta")}</TabsTrigger>
            <TabsTrigger value="general">{t("division.general")}</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2">
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
      </div>

      <Panel
        key={`${division}:${effScope}:${gate.centro}:${fecha}`}
        fecha={fecha}
        esHoy={fecha === hoy}
        division={division}
        scope={effScope}
        setScope={setScope}
        isGerencia={isGerencia}
        meId={me?.id ?? null}
        canCerrar={canCerrar}
      />
    </Shell>
  );
}

function Shell({
  children,
  centroNombre,
}: {
  children: React.ReactNode;
  centroNombre?: string;
}) {
  const t = useTranslations("caja");
  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-1 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        {centroNombre && (
          <Badge variant="secondary" className="font-normal">
            {centroNombre}
          </Badge>
        )}
      </div>
      <p className="mb-6 text-sm text-muted-foreground">{t("help")}</p>
      {children}
    </div>
  );
}

function Panel({
  fecha,
  esHoy,
  division,
  scope,
  setScope,
  isGerencia,
  meId,
  canCerrar,
}: {
  fecha: string;
  esHoy: boolean;
  division: CajaDivision;
  scope: Scope;
  setScope: (s: Scope) => void;
  isGerencia: boolean;
  meId: string | null;
  canCerrar: boolean;
}) {
  const t = useTranslations("caja");
  const tc = useTranslations("common");
  const tRoot = useTranslations();

  const usuarioId = scopeUsuarioId(scope);
  const reporte = useResource(
    () => getReporteDia(fecha, division, usuarioId),
    [],
  );
  const denoms = useResource(() => getDenominaciones(), []);
  const formas = useResource(() => getFormasPago(), []);

  const [cuadre, setCuadre] = React.useState<CuadreConItems | null>(null);
  const [petty, setPetty] = React.useState<string>("");
  const [opening, setOpening] = React.useState(false);
  const [closing, setClosing] = React.useState(false);

  const clavesEfectivo = React.useMemo(
    () =>
      formas.state.kind === "ok"
        ? formas.state.data.filter((f: FormaPago) => f.esEfectivo).map((f) => f.clave)
        : [],
    [formas.state],
  );

  async function abrir() {
    setOpening(true);
    try {
      const abierto = await abrirCuadre({
        division,
        usuarioId, // undefined = propio; null = consolidado; id = ese cajero
        fecha,
        pettyDeclarado: petty ? Math.max(0, Number(petty) || 0) : undefined,
      });
      const full = await getCuadre(abierto.id);
      setCuadre(full);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setOpening(false);
    }
  }

  async function cerrar() {
    if (!cuadre) return;
    setClosing(true);
    try {
      const cerrado = await cerrarCuadre(cuadre.id);
      setCuadre(cerrado);
      reporte.reload();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setClosing(false);
    }
  }

  const inicialConteo = React.useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of cuadre?.conteo ?? []) m[c.denominacionId] = c.cantidad;
    return m;
  }, [cuadre]);

  const cargando =
    reporte.state.kind === "loading" ||
    denoms.state.kind === "loading" ||
    formas.state.kind === "loading";

  const porMetodo =
    reporte.state.kind === "ok" ? reporte.state.data.porMetodo : {};
  const porCajero =
    reporte.state.kind === "ok" ? (reporte.state.data.porCajero ?? []) : [];

  return (
    <div className="space-y-4">
      {/* Selector de alcance (solo gerencia) */}
      {isGerencia && (
        <div className="flex items-center gap-2">
          <Label className="text-sm text-muted-foreground">
            {t("scope.label")}
          </Label>
          <Select
            value={scope}
            onValueChange={(v) => setScope(v as Scope)}
          >
            <SelectTrigger className="h-9 w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="consolidated">
                {t("scope.consolidated")}
              </SelectItem>
              {porCajero
                .filter((c) => c.usuarioId)
                .map((c) => (
                  <SelectItem key={c.usuarioId} value={`user:${c.usuarioId}`}>
                    {c.usuarioId === meId
                      ? t("scope.mine")
                      : (c.usuarioId ?? "").slice(0, 8)}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {cargando ? (
        <p className="text-sm text-muted-foreground">{tc("loading")}</p>
      ) : reporte.state.kind === "fail" ? (
        <p className="text-sm text-destructive">{reporte.state.message}</p>
      ) : (
        <>
          {/* Consolidado de gerencia: desglose por cajero (drill-in) */}
          {isGerencia && scope === "consolidated" && (
            <DesgloseCajeros
              cajeros={porCajero}
              meId={meId}
              activeUsuarioId={null}
              onPick={(uid) =>
                setScope(uid ? (`user:${uid}` as Scope) : "consolidated")
              }
            />
          )}

          {!cuadre ? (
            esHoy ? (
              <div className="max-w-md space-y-3 rounded-xl border p-4">
                <p className="text-sm text-muted-foreground">{t("openHelp")}</p>
                <div className="space-y-1.5">
                  <Label htmlFor="petty">{t("petty")}</Label>
                  <Input
                    id="petty"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    value={petty}
                    onChange={(e) => setPetty(e.target.value)}
                    className="h-9"
                    placeholder="0.00"
                  />
                </div>
                <Button onClick={abrir} disabled={opening}>
                  {t("open")}
                </Button>
              </div>
            ) : (
              // Fecha anterior: reporte del día en SOLO LECTURA. Abrir/editar/imprimir/enviar
              // cuadres cerrados anteriores requiere endpoints del BE (ver handoff).
              <div className="max-w-md space-y-3 rounded-xl border p-4">
                <p className="text-sm font-medium text-muted-foreground">
                  {t("summary.byMethod")}
                </p>
                {Object.entries(porMetodo).filter(([, v]) => v !== 0).length === 0 ? (
                  <p className="text-sm text-muted-foreground">—</p>
                ) : (
                  <ul className="space-y-0.5">
                    {Object.entries(porMetodo)
                      .filter(([, v]) => v !== 0)
                      .map(([clave, monto]) => (
                        <li
                          key={clave}
                          className="flex items-center justify-between text-sm"
                        >
                          <span>{formaPagoLabel(tRoot, clave)}</span>
                          <span className="tabular-nums">{money(monto)}</span>
                        </li>
                      ))}
                  </ul>
                )}
                <p className="border-t pt-3 text-xs text-muted-foreground">
                  {t("historyReadonly")}
                </p>
              </div>
            )
          ) : (
            <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge
                    variant={cuadre.estado === "abierto" ? "default" : "secondary"}
                  >
                    {t(`status.${cuadre.estado}`)}
                  </Badge>
                  {cuadre.estado === "cerrado" && (
                    <span className="text-xs text-muted-foreground">
                      {t("readonly")}
                    </span>
                  )}
                </div>
                {cuadre.estado === "abierto" &&
                  denoms.state.kind === "ok" && (
                    <ConteoDenominaciones
                      cuadreId={cuadre.id}
                      denominaciones={denoms.state.data}
                      inicial={inicialConteo}
                      onSaved={setCuadre}
                    />
                  )}
              </div>
              <ResumenEsperado
                cuadre={cuadre}
                porMetodo={porMetodo}
                clavesEfectivo={clavesEfectivo}
                canClose={canCerrar}
                closing={closing}
                onClose={cerrar}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
