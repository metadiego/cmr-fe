"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { HugeiconsIcon } from "@hugeicons/react"
import { Stethoscope02Icon } from "@hugeicons/core-free-icons"

import {
  getOpciones as getColumnOptions,
  type Opcion as Option,
  type Tablero as BoardRows,
  type TableroDefinicion as BoardDefinition,
} from "@/lib/api/tablero"
import {
  NotificarCell as NotifyBell,
  TableroDinamico as BoardTable,
} from "@/components/agenda/tablero-dinamico"
import {
  blockColumns,
  doctorAndFlowFirst,
  hidePresente,
  notifyColumn,
} from "@/lib/frontdesk/patient-columns"
import {
  AccionesModal as RowActions,
  type AccionItem as ActionItem,
} from "@/components/tablero/acciones-modal"

interface Props {
  board: BoardRows
  definition: BoardDefinition | null
  rowIds: string[]
  color: string | null
  label: string
  centerId: string | undefined
  onChanged: () => void
}

// The patient's consultation(s) of the day: the consultation board's own columns and cells (the same
// table component the Consulta tab uses), only this patient's rows. Row actions are the column's
// declarative menu, as on that board for appointment rows.
export function ConsultationRows({
  board,
  definition,
  rowIds,
  color,
  label,
  centerId,
  onChanged,
}: Props) {
  const t = useTranslations("patientDesk")
  const ids = React.useMemo(() => new Set(rowIds), [rowIds])
  const rows = React.useMemo(
    () => board.rows.filter((r) => ids.has(r.id)),
    [board, ids]
  )
  // Name and record are the detail's title already; the notify bell goes to this block's title. The
  // consultation's own "presente" pill is also dropped: one arrival per patient, from the header.
  const columns = React.useMemo(
    () => doctorAndFlowFirst(hidePresente(blockColumns(board.columns))),
    [board]
  )
  const notify = React.useMemo(() => notifyColumn(board.columns), [board])

  const [options, setOptions] = React.useState<Record<string, Option[]>>({})
  React.useEffect(() => {
    const selects = (definition?.columns ?? []).filter(
      (c) => c.tipo === "select" && c.editable
    )
    if (!selects.length || !centerId) return
    let active = true
    Promise.all(
      selects.map((c) =>
        getColumnOptions("atencion", c.clave, centerId)
          .then((o) => [c.clave, o] as const)
          .catch(() => [c.clave, [] as Option[]] as const)
      )
    ).then((pairs) => active && setOptions(Object.fromEntries(pairs)))
    return () => {
      active = false
    }
  }, [definition, centerId])

  const backHref =
    typeof window !== "undefined"
      ? window.location.pathname + window.location.search
      : undefined

  return (
    <section className="overflow-hidden rounded-lg ring-1 ring-foreground/10">
      <header className="flex items-center gap-2 border-b bg-muted/40 px-3 py-2">
        <span
          className="size-2.5 rounded-full"
          style={{ backgroundColor: color ?? "var(--muted-foreground)" }}
          aria-hidden
        />
        <h3 className="text-sm font-semibold tracking-wide uppercase">
          {label}
        </h3>
        <span className="text-xs text-muted-foreground">
          {t("sessionsCount", { n: rows.length })}
        </span>
        {notify && (
          <span className="ml-auto flex items-center gap-2">
            {rows.map((row) => {
              // Quién toma los vitales: ya vive en la FILA (fd_enfermera, el BE la proyecta exista o no
              // la columna en este tablero — ver NotificarCell). Antes solo se podía ASIGNAR desde la
              // campana, nunca se veía quién — igual que el legado (campana + nombre), pero como una
              // píldora junto a la campana en vez de una celda aparte (handoff
              // quejas-de-mostrador-2026-10-20 §6, pedido del dueño: "mejor y más elegante").
              const enfermera = (row as Record<string, unknown>).fd_enfermera
              const nombreVitales = typeof enfermera === "string" ? enfermera : ""
              return (
                <span key={row.id} className="flex items-center gap-1">
                  {nombreVitales && (
                    <span
                      className="inline-flex items-center gap-1 rounded-full bg-card px-2 py-0.5 text-[11px] font-medium text-muted-foreground ring-1 ring-foreground/10"
                      title={t("vitalsBy", { name: nombreVitales })}
                    >
                      <HugeiconsIcon icon={Stethoscope02Icon} className="size-3" />
                      {nombreVitales}
                    </span>
                  )}
                  <NotifyBell
                    col={notify}
                    fila={row}
                    tablero="atencion"
                    centroId={centerId}
                    optionsByCol={options}
                    onRefresh={onChanged}
                  />
                </span>
              )
            })}
          </span>
        )}
      </header>
      <div className="overflow-x-auto">
        <BoardTable
          leadWidths
          columnas={columns}
          filas={rows}
          tablero="atencion"
          centroId={centerId}
          onRefresh={onChanged}
          optionsByCol={options}
          transiciones={definition?.transitions ?? []}
          estados={(definition?.statuses ?? []).map((s) => ({
            clave: s.slug,
            orden: s.sortOrder,
            color: s.color,
          }))}
          density="compacto"
          renderAccion={(row, col) => (
            <RowActions
              actions={
                ((col.render as Record<string, unknown> | null)?.actions as
                  | ActionItem[]
                  | undefined) ?? []
              }
              fila={row}
              centroId={centerId}
              volverHref={backHref}
            />
          )}
        />
      </div>
    </section>
  )
}
