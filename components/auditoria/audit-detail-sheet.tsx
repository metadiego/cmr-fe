"use client"

import { useFormatter, useTranslations } from "next-intl"

import type { AuditRow } from "@/lib/api/auditoria"
import { agentTool, auditVia } from "@/lib/audit/via"
import { Badge } from "@/components/ui/badge"
import { Campo, CopiableCampo } from "@/components/auditoria/audit-fields"
import { ChangeLogList } from "@/components/change-log/change-log-list"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

// Side panel with every raw field of one audit row: copyable requestId/IP and the full error.
// Split out of auditoria-log.tsx (at its size ceiling) when the "via" (app / Claude) was added.
// The label/value rows are the shared ones in audit-fields.tsx.
export function AuditDetailSheet({
  row,
  onClose,
  centerName,
  onCopy,
  onEntity,
}: {
  row: AuditRow | null
  onClose: () => void
  centerName: (id: string | null) => string
  onCopy: (txt: string) => void
  onEntity: (id: string) => void
}) {
  const t = useTranslations("auditoria")
  const format = useFormatter()
  const tool = row ? agentTool(row) : null
  return (
    <Sheet open={!!row} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>{t("detalleTitulo")}</SheetTitle>
          <SheetDescription>
            {row ? format.dateTime(new Date(row.createdAt), "dateAndTime") : ""}
          </SheetDescription>
        </SheetHeader>
        {row && (
          <div className="flex-1 space-y-3 overflow-y-auto px-6 py-5 text-sm">
            <Campo label={t("col.via")}>
              <Badge
                variant={auditVia(row) === "claude" ? "default" : "outline"}
              >
                {t(`via.${auditVia(row)}`)}
              </Badge>
            </Campo>
            {tool ? (
              <Campo label={t("tool")}>
                <span className="font-mono text-xs">{tool}</span>
              </Campo>
            ) : null}
            <Campo label={t("col.accion")}>
              <span className="font-mono text-xs">{row.accion}</span>
            </Campo>
            <Campo label={t("col.metodo")}>
              <span className="font-mono text-xs">
                {row.metodo} {row.ruta}
              </span>
            </Campo>
            <Campo label={t("col.resultado")}>
              <Badge
                variant={
                  row.resultado === "error" ? "destructive" : "secondary"
                }
              >
                {row.statusCode ?? row.resultado}
              </Badge>
            </Campo>
            <Campo label={t("col.duracion")}>
              {row.durationMs != null ? `${row.durationMs} ms` : "—"}
            </Campo>
            <Campo label={t("col.centro")}>{centerName(row.clinicId)}</Campo>
            <Campo label={t("col.usuario")}>
              {row.usuarioNombre ?? (
                <span className="font-mono text-xs">{row.userId ?? "—"}</span>
              )}
              {row.userType ? (
                <span className="ml-2 text-muted-foreground">
                  ({row.userType})
                </span>
              ) : null}
            </Campo>
            {row.entidadId ? (
              <Campo label={t("entidadId")}>
                <button
                  type="button"
                  onClick={() => onEntity(row.entidadId!)}
                  className="font-mono text-xs hover:underline"
                  title={t("filtrarPorEntidad")}
                >
                  {row.entidadId}
                </button>
              </Campo>
            ) : null}
            <CopiableCampo
              label="requestId"
              value={row.requestId}
              onCopy={onCopy}
              vacio={t("sinDato")}
            />
            <CopiableCampo
              label="IP"
              value={row.ip}
              onCopy={onCopy}
              vacio={t("sinDato")}
            />
            {/* Before / after of this request (BE #529: today only frontdesk sessions; empty elsewhere). */}
            {row.requestId && row.resultado !== "error" ? (
              <ChangeLogList filter={{ requestId: row.requestId }} pageSize={20} />
            ) : null}
            {row.resultado === "error" ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3">
                <p className="text-xs font-semibold text-destructive">
                  {row.errorCode ?? t("error")}
                </p>
                {row.errorMensaje ? (
                  <p className="mt-1 text-xs">{row.errorMensaje}</p>
                ) : null}
              </div>
            ) : null}
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
