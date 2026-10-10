"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

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
import { blockColumns, notifyColumn } from "@/lib/frontdesk/patient-columns"
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
  // Name and record are the detail's title already; the notify bell goes to this block's title.
  const columns = React.useMemo(() => blockColumns(board.columns), [board])
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
          <span className="ml-auto flex items-center gap-1">
            {rows.map((row) => (
              <NotifyBell
                key={row.id}
                col={notify}
                fila={row}
                tablero="atencion"
                centroId={centerId}
                optionsByCol={options}
                onRefresh={onChanged}
              />
            ))}
          </span>
        )}
      </header>
      <div className="overflow-x-auto">
        <BoardTable
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
