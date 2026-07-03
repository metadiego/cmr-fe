"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, Add01Icon, Settings02Icon } from "@hugeicons/core-free-icons";

import { getAgendaDia, type AgendaDia, type CentroDia, type ColumnaEfectiva, type TipoFranja } from "@/lib/api/agenda-dia";
import { getMyCentros, type Centro } from "@/lib/api/centers";
import { getTiposCita, type TipoCita } from "@/lib/api/citas";
import { getMedicos, type Personal } from "@/lib/api/personal";
import { useResource } from "@/hooks/use-resource";
import { useCitaStream } from "@/hooks/use-cita-stream";
import { useCan } from "@/hooks/use-can";
import { Can } from "@/components/kit/can";
import { CitaActions } from "@/components/citas/cita-actions";
import { filaToCita } from "@/lib/agenda/fila-to-cita";
import { Cell } from "@/components/agenda/tablero-dinamico";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CitaModal } from "@/components/agenda/cita-modal";

const ALL = "__all__";
const CENTRO_KEY = "cmr_agenda_centro";

export function DiaView({ fecha }: { fecha: string }) {
  const t = useTranslations("agenda");
  const tc = useTranslations("common");
  const [centro, setCentro] = React.useState<string>(ALL);
  const [modal, setModal] = React.useState<
    { fecha: string; centroId?: string; hora?: string; tipoCitaId?: string } | null
  >(null);

  // Restore persisted center choice once.
  const [prevF, setPrevF] = React.useState(false);
  if (!prevF && typeof window !== "undefined") {
    setPrevF(true);
    const saved = window.localStorage.getItem(CENTRO_KEY);
    if (saved) setCentro(saved);
  }
  function pickCentro(v: string) {
    setCentro(v);
    if (typeof window !== "undefined") window.localStorage.setItem(CENTRO_KEY, v);
  }

  const centrosRes = useResource<Centro[]>(() => getMyCentros());
  const centros = centrosRes.state.kind === "ok" ? centrosRes.state.data : [];
  const tiposRes = useResource<TipoCita[]>(() => getTiposCita());
  const medicosRes = useResource<Personal[]>(() => getMedicos());
  const tipos = tiposRes.state.kind === "ok" ? tiposRes.state.data : [];
  const medicos = medicosRes.state.kind === "ok" ? medicosRes.state.data : [];

  const { state, reload, refresh } = useResource<AgendaDia>(
    () =>
      getAgendaDia(fecha, centro === ALL ? { combinado: true } : { centroId: centro }),
    [fecha, centro],
  );

  // Live: refetch (silently) whenever anyone changes a cita in this scope, so
  // every open window stays in sync. combined → null (all permitted centers).
  const { live } = useCitaStream({
    centroId: centro === ALL ? null : centro,
    entidad: "cita",
    onInvalidate: refresh,
  });

  const fechaLabel = new Date(fecha + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const data = state.kind === "ok" ? state.data : null;
  const centrosData = data?.centros ?? [];

  return (
    <div className="mx-auto max-w-7xl px-6 py-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Link
          href="/citas"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
          {t("today")}
        </Link>
        <h1 className="text-xl font-semibold capitalize">{fechaLabel}</h1>
        {live && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            {t("dia.live")}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Can permiso="citas.config">
            <Link
              href="/citas/agenda/cupos"
              className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <HugeiconsIcon icon={Settings02Icon} className="size-4" />
              {t("cupos.configure")}
            </Link>
          </Can>
          <Select value={centro} onValueChange={pickCentro}>
            <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("dia.allCenters")}</SelectItem>
              {centros.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {state.kind === "loading" && <p className="text-sm text-muted-foreground">{tc("loading")}</p>}
      {state.kind === "fail" && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.message}
        </p>
      )}

      {data && centrosData.length > 1 ? (
        <Tabs defaultValue={centrosData[0]?.clinicId}>
          <TabsList className="mb-3">
            {centrosData.map((c) => (
              <TabsTrigger key={c.clinicId} value={c.clinicId}>{c.nombre}</TabsTrigger>
            ))}
          </TabsList>
          {centrosData.map((c) => (
            <TabsContent key={c.clinicId} value={c.clinicId}>
              <CentroSheet
                centro={c}
                columnas={data.columnas}
                fecha={fecha}
                onChanged={refresh}
                onAgendar={(hora, tipo) =>
                  setModal({ fecha, centroId: c.clinicId, hora: hora ?? undefined, tipoCitaId: tipo.tipoCitaId })
                }
              />
            </TabsContent>
          ))}
        </Tabs>
      ) : data && centrosData.length === 1 ? (
        <CentroSheet
          centro={centrosData[0]}
          columnas={data.columnas}
          fecha={fecha}
          onChanged={refresh}
          onAgendar={(hora, tipo) =>
            setModal({ fecha, centroId: centrosData[0].clinicId, hora: hora ?? undefined, tipoCitaId: tipo.tipoCitaId })
          }
        />
      ) : null}

      {modal && (
        <CitaModal
          open
          fecha={modal.fecha}
          centroId={modal.centroId}
          horaInicial={modal.hora}
          tipoCitaIdInicial={modal.tipoCitaId}
          tipos={tipos}
          medicos={medicos}
          onOpenChange={(o) => !o && setModal(null)}
          onSaved={reload}
        />
      )}
    </div>
  );
}

function CentroSheet({
  centro,
  columnas,
  fecha,
  onAgendar,
  onChanged,
}: {
  centro: CentroDia;
  columnas: ColumnaEfectiva[];
  fecha: string;
  onAgendar: (hora: string | null, tipo: TipoFranja) => void;
  onChanged: () => void;
}) {
  const t = useTranslations("agenda");
  const tRoot = useTranslations();
  const { can } = useCan();
  // Combined mode returns each center's columns concatenated → dedupe by clave.
  const seen = new Set<string>();
  const cols = columnas
    .filter((c) => (seen.has(c.clave) ? false : (seen.add(c.clave), true)))
    .filter((c) => !c.permiso || can(c.permiso));
  const r = centro.resumen;
  const festivos = centro.festivos ?? [];
  const bloqueado = centro.bloqueado ?? false;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3 text-sm">
        <span className="font-semibold">{centro.nombre}</span>
        <span className="text-muted-foreground">
          {t("dia.summary", {
            total: r?.totalCitas ?? 0,
            atendidas: r?.atendidas ?? 0,
            noShow: r?.noShow ?? 0,
          })}
        </span>
        {festivos.map((f) => (
          <span
            key={f.fecha + f.nombre}
            className={
              f.bloqueaAgenda
                ? "rounded bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive"
                : "rounded bg-sky-500/10 px-2 py-0.5 text-xs text-sky-700 dark:text-sky-400"
            }
          >
            {f.bloqueaAgenda ? "🚫" : "🎉"} {f.nombre}
            {f.bloqueaAgenda ? ` — ${t("dia.closed")}` : ""}
          </span>
        ))}
        {centro.notasDia.filter((n) => n.activo).map((n) => (
          <span key={n.id} className="rounded bg-amber-500/10 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-400">
            📌 {n.contenido}
          </span>
        ))}
      </div>

      {bloqueado && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {t("dia.closedNotice")}
        </div>
      )}

      {centro.franjas.map((franja) =>
        franja.tipos.map((tipo) => {
          if (tipo.citas.length === 0 && tipo.vacios === 0) return null;
          const key = `${franja.hora ?? "sin"}-${tipo.tipoCitaId}`;
          return (
            <section key={key} className="space-y-1">
              <h3 className="flex items-center gap-2 text-sm font-medium">
                <span className="font-mono">{franja.hora ?? t("dia.noTime")}</span>
                <span>{tipo.tipoNombre}</span>
                <span className="text-xs text-muted-foreground">
                  {tipo.citas.length}/{tipo.cupo}
                </span>
              </h3>
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs text-muted-foreground">
                    <tr>
                      {cols.map((col) => (
                        <th key={col.clave} className="px-3 py-1.5 text-left font-medium whitespace-nowrap">
                          {tRoot(col.labelKey)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tipo.citas.map((fila) => (
                      <tr key={fila.id} className="border-t">
                        {cols.map((col) => (
                          <td key={col.clave} className="px-3 py-1.5 whitespace-nowrap">
                            {col.tipo === "accion" ? (
                              <CitaActions
                                cita={filaToCita(fila, centro, franja, tipo, fecha)}
                                onChanged={onChanged}
                              />
                            ) : (
                              <Cell col={col} value={fila[col.clave]} />
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {tipo.vacios > 0 && (
                      <tr className="border-t bg-muted/10">
                        <td colSpan={cols.length} className="px-3 py-1.5">
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-muted-foreground">
                              {t("dia.freeSlots", { n: tipo.vacios })}
                            </span>
                            <Can permiso="citas.create">
                              <button
                                type="button"
                                onClick={() => onAgendar(franja.hora, tipo)}
                                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                              >
                                <HugeiconsIcon icon={Add01Icon} className="size-3.5" />
                                {t("dia.book", { tipo: tipo.tipoNombre, hora: franja.hora ?? "" })}
                              </button>
                            </Can>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          );
        }),
      )}
    </div>
  );
}

