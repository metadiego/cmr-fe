"use client"

import * as React from "react"
import { useFormatter, useTranslations } from "next-intl"
import { HugeiconsIcon } from "@hugeicons/react"
import { Copy01Icon } from "@hugeicons/core-free-icons"

import type { AuditRow } from "@/lib/api/auditoria"
import { agentTool, auditVia } from "@/lib/audit/via"
import { Badge } from "@/components/ui/badge"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

// Side panel with every raw field of one audit row: copyable requestId/IP and the full error.
// Split out of auditoria-log.tsx (at its size ceiling) when the "via" (app / Claude) was added.
export function AuditDetailSheet({
  row,
  onClose,
  centerName,
  onCopy,
}: {
  row: AuditRow | null
  onClose: () => void
  centerName: (id: string | null) => string
  onCopy: (txt: string) => void
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
            <Field label={t("col.via")}>
              <Badge
                variant={auditVia(row) === "claude" ? "default" : "outline"}
              >
                {t(`via.${auditVia(row)}`)}
              </Badge>
            </Field>
            {tool ? (
              <Field label={t("tool")}>
                <span className="font-mono text-xs">{tool}</span>
              </Field>
            ) : null}
            <Field label={t("col.accion")}>
              <span className="font-mono text-xs">{row.accion}</span>
            </Field>
            <Field label={t("col.metodo")}>
              <span className="font-mono text-xs">
                {row.metodo} {row.ruta}
              </span>
            </Field>
            <Field label={t("col.resultado")}>
              <Badge
                variant={
                  row.resultado === "error" ? "destructive" : "secondary"
                }
              >
                {row.statusCode ?? row.resultado}
              </Badge>
            </Field>
            <Field label={t("col.duracion")}>
              {row.durationMs != null ? `${row.durationMs} ms` : "—"}
            </Field>
            <Field label={t("col.centro")}>{centerName(row.clinicId)}</Field>
            <Field label={t("col.usuario")}>
              <span className="font-mono text-xs">{row.userId ?? "—"}</span>
              {row.userType ? (
                <span className="ml-2 text-muted-foreground">
                  ({row.userType})
                </span>
              ) : null}
            </Field>
            {row.entidadId ? (
              <Field label={t("entidadId")}>
                <span className="font-mono text-xs">{row.entidadId}</span>
              </Field>
            ) : null}
            <CopyableField
              label="requestId"
              value={row.requestId}
              onCopy={onCopy}
              empty={t("sinDato")}
            />
            <CopyableField
              label="IP"
              value={row.ip}
              onCopy={onCopy}
              empty={t("sinDato")}
            />
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

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  )
}

function CopyableField({
  label,
  value,
  onCopy,
  empty,
}: {
  label: string
  value: string | null
  onCopy: (txt: string) => void
  empty: string
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {value ? (
        <button
          type="button"
          onClick={() => onCopy(value)}
          className="flex items-center gap-1 font-mono text-xs hover:text-foreground"
        >
          <span className="max-w-[12rem] truncate">{value}</span>
          <HugeiconsIcon icon={Copy01Icon} className="size-3.5 opacity-60" />
        </button>
      ) : (
        <span className="text-xs text-muted-foreground">{empty}</span>
      )}
    </div>
  )
}
