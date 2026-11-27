"use client"

import * as React from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"

import { Badge } from "@/components/ui/badge"
import { DataTable, type Column } from "@/components/kit/data-table"
import { StatusBadge } from "@/components/kit/status-badge"
import {
  DayConfirmButton,
  DayRowActions,
} from "@/components/appointments-day/day-row-actions"
import type { ResourceState } from "@/hooks/use-resource"
import type { DayListRow } from "@/lib/api/appointments-day"
import {
  rowStatus,
  todayGroup,
  typeBadge,
} from "@/lib/appointments-day/day-list"

// The day's appointments of both kinds, one row each, in the backend's order (time, no-time last).
// In today mode a row not arrived whose time has passed carries a "Late" mark next to its status.
export function DayTable({
  clinicNames,
  state,
  nowHHmm,
  onReload,
  onChanged,
}: {
  /** Shown as a Clinic column when the list covers several clinics; null = one clinic, no column. */
  clinicNames: Map<string, string> | null
  state: ResourceState<DayListRow[]>
  /** Center time (HH:mm) when the day shown is today; null for any other day. */
  nowHHmm: string | null
  onReload: () => void
  onChanged: () => void
}) {
  const t = useTranslations("appointmentsDay")

  const columns: Column<DayListRow>[] = [
    {
      key: "time",
      header: t("col.time"),
      className: "w-20",
      loadingShape: "short",
      cell: (r) => <span className="tabular-nums">{r.time ?? "—"}</span>,
    },
    {
      key: "patient",
      header: t("col.patient"),
      cell: (r) => (
        <Link
          href={`/patients/${encodeURIComponent(r.patient.id)}`}
          className="font-medium hover:underline"
        >
          {r.patient.name ?? "—"}
        </Link>
      ),
    },
    {
      key: "type",
      header: t("col.type"),
      cell: (r) => {
        const b = typeBadge(r)
        return (
          <Badge variant={b.kind === "new" ? "info" : "secondary"}>
            {b.label ?? t(`type.${b.kind}`)}
          </Badge>
        )
      },
    },
    ...(clinicNames
      ? [
          {
            key: "clinic",
            header: t("col.clinic"),
            cell: (r: DayListRow) => (
              <span className="whitespace-nowrap">
                {clinicNames.get(r.centerId) ?? "—"}
              </span>
            ),
          },
        ]
      : []),
    {
      key: "bookedBy",
      // The patient's portfolio owner comes first: stats and commissions hang from it
      // (docs/specs/agendadas-la-cartera-es-lo-principal.md). Who typed the row is secondary.
      header: t("col.bookedBy"),
      cell: (r) => (
        <div className="min-w-0">
          {r.portfolioOwner ? (
            <div className="truncate">{r.portfolioOwner.name ?? "—"}</div>
          ) : (
            <div className="truncate">
              <span className="rounded bg-warning px-1.5 py-0.5 text-xs font-medium text-warning-foreground">
                {t("noPortfolio")}
              </span>
            </div>
          )}
          {r.createdBy?.name && r.createdBy.id !== r.portfolioOwner?.id && (
            <div className="truncate text-xs text-muted-foreground">
              {t("bookedByName", { name: r.createdBy.name })}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "status",
      header: t("col.status"),
      cell: (r) => <DayStatusCell row={r} nowHHmm={nowHHmm} />,
    },
    {
      key: "confirm",
      header: t("col.confirm"),
      className: "w-36",
      cell: (r) => <DayConfirmButton row={r} onChanged={onChanged} />,
    },
    {
      key: "actions",
      header: t("col.actions"),
      className: "w-24",
      cell: (r) => <DayRowActions row={r} onChanged={onChanged} />,
    },
  ]

  return (
    <DataTable
      columns={columns}
      state={state}
      getRowKey={(r) => `${r.kind}:${r.id}`}
      onReload={onReload}
      labels={{ empty: t("empty") }}
    />
  )
}

function DayStatusCell({
  row,
  nowHHmm,
}: {
  row: DayListRow
  nowHHmm: string | null
}) {
  const t = useTranslations("appointmentsDay.status")
  const { stage, confirmation } = rowStatus(row)
  const late = nowHHmm !== null && todayGroup(row, nowHHmm) === "late"
  return (
    <div className="flex flex-col items-start gap-1">
      <span className="flex flex-wrap items-center gap-1.5">
        <StatusBadge kind="lifecycle" value={stage} />
        {late && <Badge variant="warning">{t("late")}</Badge>}
      </span>
      {confirmation && (
        <span className="text-xs text-muted-foreground">
          {confirmation.via === "person"
            ? t("confirmedBy", { name: confirmation.name ?? "—" })
            : confirmation.via === "bridge"
              ? t("confirmedSheet")
              : t("confirmedImport")}
        </span>
      )}
    </div>
  )
}
