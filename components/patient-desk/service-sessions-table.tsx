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
import { blockColumns, notifyColumn } from "@/lib/frontdesk/patient-columns"
import type {
  ColumnaEfectiva as PlacedColumn,
  CitaFila as BoardRow,
} from "@/lib/api/agenda-dia"
import { NotificarCell as NotifyBell } from "@/components/agenda/tablero-dinamico"
import { STAMP_FIELD } from "@/components/frontdesk/frontdesk-board.helpers"
import { FilaSesion as SessionRow } from "@/components/frontdesk/fila-sesion"
import { useCan } from "@/hooks/use-can"
import { cn } from "@/lib/utils"

interface Props {
  slug: string
  name: string
  color: string | null
  // Every session attended: the service is painted gray (still editable — nothing is locked).
  concluded?: boolean
  service: Service | undefined
  board: ServiceBoard | undefined
  definition: BoardDefinition | null
  sessionsById: Map<string, Session>
  sessionIds: string[]
  patientId: string
  date: string
  centerId: string | undefined
  onChanged: () => void
  onSchedule: (ctx: {
    pacienteId: string
    pacienteNombre?: string
    servicioId?: string
  }) => void
}

// One of the patient's services for the day: the service's own columns (exactly the frontdesk board's,
// through the same row component — same cells, same flow, same actions), only this patient's rows.
export function ServiceSessionsTable({
  slug,
  name,
  color,
  concluded = false,
  service,
  board,
  definition,
  sessionsById,
  sessionIds,
  patientId,
  date,
  centerId,
  onChanged,
  onSchedule,
}: Props) {
  const t = useTranslations("patientDesk")
  const tRoot = useTranslations()
  const tFrontdesk = useTranslations("frontdesk")
  const { can } = useCan()
  const columns = React.useMemo(() => board?.columns ?? [], [board])
  // Name and record are the detail's title already; the notify bell goes to this block's title.
  const render = React.useMemo(
    () => renderColumns(blockColumns(columns)),
    [columns]
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
      .map((s) => ({ clave: s.slug, labelKey: s.labelKey, color: s.color }))
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
  const [options, setOptions] = React.useState<Record<string, Option[]>>({})
  React.useEffect(() => {
    const cols = columns.filter(
      (c) =>
        c.editable &&
        (c.tipo === "select" ||
          !!(c.render as { optionsSource?: string } | null)?.optionsSource)
    )
    if (!cols.length || !centerId) return
    let active = true
    Promise.all(
      cols.map((c) =>
        getColumnOptions(slug, c.clave, centerId)
          .then((o) => [c.clave, o] as const)
          .catch(() => [c.clave, [] as Option[]] as const)
      )
    ).then((pairs) => active && setOptions(Object.fromEntries(pairs)))
    return () => {
      active = false
    }
  }, [columns, slug, centerId])

  // Dose balance of this patient, only when the service has a dose column.
  const hasDose = columns.some(
    (c) =>
      (c.render as { optionsSource?: string } | null)?.optionsSource ===
      "productos_grupo"
  )
  const [pending, setPending] = React.useState<PendingDelivery[]>([])
  React.useEffect(() => {
    if (!hasDose || !centerId) return
    let active = true
    getPendingDeliveries(patientId, centerId)
      .then((r) => active && setPending(r))
      .catch(() => {})
    return () => {
      active = false
    }
  }, [hasDose, patientId, centerId, board])

  return (
    <section
      className={cn(
        "overflow-hidden rounded-lg ring-1 ring-foreground/10",
        concluded && "bg-muted/50 grayscale"
      )}
    >
      <header className="flex items-center gap-2 border-b bg-muted/40 px-3 py-2">
        <span
          className="size-2.5 rounded-full"
          style={{
            backgroundColor:
              concluded || !color ? "var(--muted-foreground)" : color,
          }}
          aria-hidden
        />
        <h3
          className={cn(
            "text-sm font-semibold tracking-wide uppercase",
            concluded && "text-muted-foreground"
          )}
        >
          {name}
        </h3>
        <span className="text-xs text-muted-foreground">
          {t("sessionsCount", { n: rows.length })}
        </span>
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
              />
            ))}
          </span>
        )}
      </header>
      {!board ? (
        <p className="px-3 py-4 text-sm text-muted-foreground">
          {tRoot("common.loading")}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/20">
              <tr className="border-b text-left text-[11px] tracking-wide text-muted-foreground uppercase">
                {render.map((item, i) =>
                  item.kind === "flujo" ? (
                    <th key={`flow-${i}`} className="px-3 py-2 font-semibold">
                      {tFrontdesk("flujo")}
                    </th>
                  ) : (
                    <th
                      key={item.col.clave}
                      className="px-3 py-2 font-semibold"
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
                  saldoDosis={pending}
                  centro={centerId}
                  sinSaldo={false}
                  canReparar={can("frontdesk.reparar")}
                  estados={statuses.map((s) => ({
                    clave: s.slug,
                    label: tRoot(s.labelKey),
                  }))}
                  onChanged={onChanged}
                  onProgramar={onSchedule}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
