"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import {
  getPendientesEntrega as getPendingDeliveries,
  type FrontdeskTablero as ServiceBoard,
  type PendienteEntrega as PendingDelivery,
  type Sesion as Session,
} from "@/lib/api/frontdesk"
import type { Servicio as Service } from "@/lib/api/servicios"
import {
  getOpciones as getColumnOptions,
  type Opcion as Option,
  type TableroDefinicion as BoardDefinition,
} from "@/lib/api/tablero"
import { flowColumns, renderColumns } from "@/lib/frontdesk/board-columns"
import { doseBalanceForRow, patientsNeedingDoseBalance } from "@/lib/frontdesk/dose-balance"
import {
  blockColumns,
  hideServiceStatus,
  isSessionColumn,
  isStaffColumn,
  notifyColumn,
  patientFirst,
  staffAndFlowFirst,
} from "@/lib/frontdesk/patient-columns"
import type {
  ColumnaEfectiva as PlacedColumn,
  CitaFila as BoardRow,
} from "@/lib/api/agenda-dia"
import { NotificarCell as NotifyBell } from "@/components/agenda/tablero-dinamico"
import { STAMP_FIELD } from "@/components/frontdesk/frontdesk-board.helpers"
import { isSessionToday } from "@/lib/frontdesk/reopen"
import { todayISO } from "@/lib/agenda/calendar"
import { FilaSesion as SessionRow } from "@/components/frontdesk/fila-sesion"
import type { EhrGateCtx, PackageGateCtx } from "@/components/tablero/flujo-atencion"
import { useCan } from "@/hooks/use-can"
import { cn } from "@/lib/utils"
import { ServiceTableSkeleton } from "@/components/patient-desk/patient-desk-skeleton"
import { Skeleton } from "@/components/ui/skeleton"

interface Props {
  slug: string
  name: string
  color: string | null
  // Every session attended: the service is painted gray (still editable — nothing is locked).
  concluded?: boolean
  // Every session that day was cancelled: a discreet mark instead of operative rows — except TODAY,
  // when the rows stay (dimmed) so they can be reopened (BE #508).
  cancelledOnly?: boolean
  service: Service | undefined
  board: ServiceBoard | undefined
  definition: BoardDefinition | null
  sessionsById: Map<string, Session>
  sessionIds: string[]
  date: string
  centerId: string | undefined
  // Secondary viewer (ServiceBoardViewer, owner 23-nov): many patients on one screen, not one
  // already-titled detail, so name/record are kept instead of blocked. Default false — patient-desk
  // itself does not change. Governed-by-the-board rule: same table, same pipeline, one prop.
  showPatient?: boolean
  onChanged: () => void
  onSchedule: (ctx: {
    pacienteId: string
    pacienteNombre?: string
    servicioId?: string
  }) => void
  onEhrGate?: (ctx: EhrGateCtx) => void
  onPackageGate?: (ctx: PackageGateCtx) => void
}

// One of the patient's services for the day: the service's own columns (exactly the frontdesk board's,
// through the same row component — same cells, same flow, same actions), only this patient's rows.
export function ServiceSessionsTable({
  slug,
  name,
  color,
  concluded = false,
  cancelledOnly = false,
  service,
  board,
  definition,
  sessionsById,
  sessionIds,
  date,
  centerId,
  showPatient = false,
  onChanged,
  onSchedule,
  onEhrGate,
  onPackageGate,
}: Props) {
  const t = useTranslations("patientDesk")
  const tRoot = useTranslations()
  const tFrontdesk = useTranslations("frontdesk")
  const { can } = useCan()
  const columns = React.useMemo(() => board?.columns ?? [], [board])
  // Name and record are the detail's title already in patient-desk; the notify bell goes to this
  // block's title either way. A secondary viewer (showPatient) keeps them, first in the row.
  const render = React.useMemo(
    () =>
      patientFirst(
        staffAndFlowFirst(
          renderColumns(hideServiceStatus(blockColumns(columns, { keepPatient: showPatient })))
        )
      ),
    [columns, showPatient]
  )
  const notify = React.useMemo(() => notifyColumn(columns), [columns])
  const flow = React.useMemo(() => flowColumns(columns), [columns])

  const statuses = React.useMemo(() => definition?.statuses ?? [], [definition])
  const statusOf = React.useCallback(
    (key: string) => statuses.find((s) => s.slug === key),
    [statuses]
  )
  const steps = React.useMemo(() => {
    const transitions = new Set(
      (definition?.transitions ?? []).map((x) => x.slug)
    )
    return statuses
      .filter((s) => transitions.has(s.slug) && STAMP_FIELD[s.slug])
      .map((s) => ({ clave: s.slug, labelKey: s.labelKey, color: s.color, group: s.group }))
  }, [definition, statuses])
  // "Presente" ya no se marca por terapia aquí: es una sola llegada por paciente, en la cabecera
  // (regla del dueño, 10-oct-2026 — ver BE PR #424). Se oculta el paso SIN sacarlo de `steps`: la
  // posición en el flujo (pendiente→presente→en_terapia→asistido) sigue intacta para que `FilaSesion`
  // ubique el estado actual — solo deja de pintarse como un pill más en la fila.
  const pasosOcultos = React.useMemo(() => new Set(["presente"]), [])

  const ids = React.useMemo(() => new Set(sessionIds), [sessionIds])
  const rows = React.useMemo(
    () => (board?.rows ?? []).filter((r) => ids.has(r.id)),
    [board, ids]
  )

  // Options of the editable selects / datalists of THIS service (e.g. the dose products).
  // Keyed by the column KEYS, not the board object: every refresh brings a new board, and refetching
  // each select's options on every refresh helped burst the BE quota (RATE_LIMITED, 04-nov-2026).
  const [options, setOptions] = React.useState<Record<string, Option[]>>({})
  const optionKeys = columns
    .filter(
      (c) =>
        c.editable &&
        (c.tipo === "select" ||
          !!(c.render as { optionsSource?: string } | null)?.optionsSource)
    )
    .map((c) => c.clave)
    .join(",")
  React.useEffect(() => {
    if (!optionKeys || !centerId) return
    let active = true
    Promise.all(
      optionKeys.split(",").map((clave) =>
        getColumnOptions(slug, clave, centerId)
          .then((o) => [clave, o] as const)
          .catch(() => [clave, [] as Option[]] as const)
      )
    ).then((pairs) => active && setOptions(Object.fromEntries(pairs)))
    return () => {
      active = false
    }
  }, [optionKeys, slug, centerId])

  // Dose balance, only when the service has a dose column — ONE fetch per DISTINCT patient on this
  // board (never per row), and every row reads ONLY its own patient's entry (doseBalanceForRow),
  // never another patient's. patient-desk's `rows` are already filtered to one patient, so this is
  // exactly the old single-fetch behavior there; the general service viewer (all patients of one
  // service) gets the same correctness for free. cmr-fe #139, lib/frontdesk/dose-balance.ts.
  const hasDose = columns.some(
    (c) =>
      (c.render as { optionsSource?: string } | null)?.optionsSource ===
      "productos_grupo"
  )
  const patientIdOf = React.useCallback(
    (rowId: string) => sessionsById.get(rowId)?.patientId,
    [sessionsById]
  )
  const patientsToFetch = React.useMemo(
    () => patientsNeedingDoseBalance(rows.map((r) => r.id), patientIdOf, hasDose),
    [rows, patientIdOf, hasDose]
  )
  const [pendingByPatient, setPendingByPatient] = React.useState<Record<string, PendingDelivery[]>>({})
  React.useEffect(() => {
    if (!patientsToFetch.length || !centerId) return
    // Sin invoice.read el BE 403 cada llamada — no pedirlo es la forma eficiente de no generar ese
    // ruido (handoff-ruido-403-auditoria.md), no solo de no mostrarlo.
    if (!can("invoice.read")) return
    let active = true
    Promise.all(
      patientsToFetch.map((id) =>
        getPendingDeliveries(id, centerId)
          .then((r) => [id, r] as const)
          .catch(() => [id, [] as PendingDelivery[]] as const)
      )
    ).then((pairs) => active && setPendingByPatient(Object.fromEntries(pairs)))
    return () => {
      active = false
    }
    // `can` deliberately excluded: a fresh closure every render would refire this on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientsToFetch, centerId])

  return (
    <section
      className={cn(
        "overflow-hidden rounded-lg ring-1 ring-foreground/10",
        // Concluded keeps its own colors (owner, 12-nov: gray read as disabled or cancelled); a green
        // ring and the «Atendido» badge say it is done. Only a cancelled-only service goes gray.
        cancelledOnly && "bg-muted/50 grayscale",
        concluded && !cancelledOnly && "ring-2 ring-success/60"
      )}
    >
      <header className="flex h-10 items-center gap-2 border-b bg-muted/40 px-3">
        <span
          className="size-2.5 rounded-full"
          style={{
            backgroundColor: color || "var(--muted-foreground)",
          }}
          aria-hidden
        />
        <h3 className="text-sm font-semibold">
          {name}
        </h3>
        {concluded && !cancelledOnly && (
          <span className="rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-semibold text-success-foreground">
            ✓ {t("serviceDone")}
          </span>
        )}
        {board || cancelledOnly ? (
          <span className="text-xs text-muted-foreground">
            {cancelledOnly
              ? t("cancelled")
              : t("sessionsCount", { n: rows.length })}
          </span>
        ) : (
          <Skeleton aria-hidden className="h-3 w-16" />
        )}
        {notify && (
          <span className="ml-auto flex items-center gap-1">
            {rows.map((row) => (
              <NotifyBell
                key={row.id}
                col={notify as unknown as PlacedColumn}
                fila={row as BoardRow}
                tablero={slug}
                centroId={centerId}
                optionsByCol={options}
                onRefresh={onChanged}
                inline
              />
            ))}
          </span>
        )}
      </header>
      {cancelledOnly && !isSessionToday(date, todayISO()) ? null : !board ? (
        <ServiceTableSkeleton rows={Math.max(1, sessionIds.length)} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-[11px] tracking-wide text-muted-foreground uppercase">
                {render.map((item, i) =>
                  // Fixed widths for the leading columns (staff, flow, session) so they line up across
                  // the patient's services.
                  item.kind === "flujo" ? (
                    <th
                      key={`flow-${i}`}
                      className="w-60 px-3 py-2 font-semibold"
                    >
                      {tFrontdesk("flujo")}
                    </th>
                  ) : (
                    <th
                      key={item.col.clave}
                      className={cn(
                        "px-3 py-2 font-semibold",
                        isStaffColumn(item.col) && "w-52",
                        isSessionColumn(item.col) && "w-24"
                      )}
                    >
                      {item.col.label ??
                        tRoot(
                          (item.col.render as { labelKey?: string } | null)
                            ?.labelKey ?? item.col.labelKey
                        )}
                    </th>
                  )
                )}
                <th className="px-3 py-2 text-right font-semibold">
                  {tRoot("fd.col.acciones")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row) => (
                <SessionRow
                  key={row.id}
                  fila={row}
                  sesion={sessionsById.get(row.id)}
                  colsRender={render}
                  flujoCols={flow}
                  flujo={steps}
                  pasosOcultos={pasosOcultos}
                  transiciones={definition?.transitions ?? []}
                  estadoDe={statusOf}
                  servicio={service}
                  tablero={slug}
                  fecha={date}
                  optionsByCol={options}
                  saldoDosis={doseBalanceForRow(pendingByPatient, sessionsById.get(row.id)?.patientId)}
                  centro={centerId}
                  sinSaldo={false}
                  canReparar={can("frontdesk.reparar")}
                  estados={statuses.map((s) => ({
                    clave: s.slug,
                    label: tRoot(s.labelKey),
                  }))}
                  onChanged={onChanged}
                  onProgramar={onSchedule}
                  onEhrGate={onEhrGate}
                  onPackageGate={onPackageGate}
                  drawFromAllowedActions
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
