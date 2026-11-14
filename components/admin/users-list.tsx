"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import {
  getProfiles,
  reactivarProfile,
  suspenderProfile,
  generarCodigoAcceso,
  type Perfil,
  type CodigoAccesoResult,
} from "@/lib/api/profiles"
import { toastError } from "@/lib/api/errors"
import { useCan } from "@/hooks/use-can"
import { useResource } from "@/hooks/use-resource"
import { cn } from "@/lib/utils"
import {
  USER_STATUSES,
  countByStatus,
  filterUsers,
  userInitials,
  type UserStatusFilter,
} from "@/lib/admin/users-filter"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Building01Icon,
  MoreHorizontalIcon,
  Search01Icon,
  Shield01Icon,
  SquareLock02Icon,
  UserAdd01Icon,
} from "@hugeicons/core-free-icons"
import { CodigoAccesoDialog } from "@/components/admin/codigo-acceso-dialog"
import { CambiarEmailDialog } from "@/components/admin/cambiar-email-dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { DataTable, type Column } from "@/components/kit/data-table"
import { InviteDialog } from "@/components/admin/invite-dialog"
import { AccessDialog } from "@/components/admin/access-dialog"
import { ProfileCentrosDialog } from "@/components/admin/profile-centros-dialog"
import { ProfileEditDialog } from "@/components/admin/profile-edit-dialog"

// Status as a soft badge with a colored dot (approved = success, pending = warning, else destructive).
const STATUS_TONE: Record<string, { badge: string; dot: string }> = {
  aprobado: { badge: "bg-success/10 text-success", dot: "bg-success" },
  pendiente: { badge: "bg-warning text-warning-foreground", dot: "bg-warning-foreground" },
  suspendido: { badge: "bg-destructive/10 text-destructive", dot: "bg-destructive" },
  rechazado: { badge: "bg-destructive/10 text-destructive", dot: "bg-destructive" },
}

function StatusBadge({ status, label }: { status: string; label: string }) {
  const tone = STATUS_TONE[status] ?? STATUS_TONE.pendiente
  return (
    <Badge variant="ghost" className={cn("gap-1.5", tone.badge)}>
      <span aria-hidden className={cn("size-1.5 rounded-full", tone.dot)} />
      {label}
    </Badge>
  )
}

export function UsersList() {
  const t = useTranslations("admin")
  const tRoot = useTranslations()
  const { state, reload } = useResource<Perfil[]>(() => getProfiles())
  const [inviteOpen, setInviteOpen] = React.useState(false)
  const [centrosFor, setCentrosFor] = React.useState<Perfil | null>(null)
  const [accessFor, setAccessFor] = React.useState<Perfil | null>(null)
  const [editFor, setEditFor] = React.useState<Perfil | null>(null)
  const [q, setQ] = React.useState("")
  const [busyId, setBusyId] = React.useState<string | null>(null)
  const { can } = useCan()
  const puedeCodigo = can("profiles.codigo_acceso")
  const [codigo, setCodigo] = React.useState<CodigoAccesoResult | null>(null)
  // Cambiar email de acceso: permiso profiles.email (admin/super_admin). El botón no se enseña sin él.
  const puedeEmail = can("profiles.email")
  const [emailFor, setEmailFor] = React.useState<Perfil | null>(null)

  async function generarCodigo(p: Perfil) {
    setBusyId(p.id)
    try {
      const r = await generarCodigoAcceso(p.id)
      setCodigo(r) // se muestra en un diálogo con copiar; credencial temporal, no se guarda
    } catch (err) {
      toastError(err)
    } finally {
      setBusyId(null)
    }
  }

  const [status, setStatus] = React.useState<UserStatusFilter>("all")
  // Client-side search and status filter (the list is short).
  const all = React.useMemo(() => (state.kind === "ok" ? state.data : []), [state])
  const counts = React.useMemo(() => countByStatus(all), [all])
  const filtered = React.useMemo(
    () => (state.kind === "ok" ? { ...state, data: filterUsers(state.data, q, status) } : state),
    [state, q, status]
  )
  const statusLabel = (s: string) =>
    (USER_STATUSES as readonly string[]).includes(s) ? t(`users.status.${s}`) : s

  async function toggleSuspension(p: Perfil) {
    if (busyId) return // evita el doble POST (el 2º daría 409)
    setBusyId(p.id)
    try {
      if (p.status === "aprobado") {
        await suspenderProfile(p.id)
        toast.success(t("users.suspendido"))
      } else if (p.status === "suspendido") {
        await reactivarProfile(p.id)
        toast.success(t("users.reactivado"))
      }
      reload()
    } catch (err) {
      toastError(err, tRoot)
    } finally {
      setBusyId(null)
    }
  }

  const columns: Column<Perfil>[] = [
    {
      key: "user",
      header: t("columns.user"),
      loadingShape: "avatar",
      cell: (p) => (
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            {userInitials(p)}
          </span>
          <div className="min-w-0">
            <div className="truncate font-medium">
              {[p.name, p.lastName].filter(Boolean).join(" ") || p.email}
            </div>
            <div className="truncate text-xs text-muted-foreground">{p.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: "roles",
      header: t("columns.roles"),
      cell: (p) =>
        p.isMaster ? (
          <Badge className="gap-1">
            <HugeiconsIcon icon={Shield01Icon} data-icon="inline-start" />
            {t("users.adminBadge")}
          </Badge>
        ) : p.roles?.length ? (
          <div className="flex flex-wrap gap-1">
            {p.roles.map((r) => (
              <Badge key={`${r.slug}|${r.centerId ?? ""}`} variant="secondary">
                {r.name}
              </Badge>
            ))}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">{t("users.sinRol")}</span>
        ),
    },
    {
      key: "centros",
      header: t("columns.centros"),
      cell: (p) => {
        const activos = (p.centers ?? []).filter((c) => c.active)
        if (!activos.length)
          return (
            <span className="text-xs text-muted-foreground">
              {p.isMaster ? t("users.allCenters") : t("users.sinCentro")}
            </span>
          )
        return (
          <div className="flex flex-wrap gap-1">
            {activos.map((c) => (
              <Badge key={c.asignacionId} variant="outline">
                {c.name ?? c.centerId.slice(0, 8)}
                {c.type === "temporal" && c.validUntil
                  ? ` · ${t("users.hasta", { fecha: c.validUntil })}`
                  : ""}
              </Badge>
            ))}
          </div>
        )
      },
    },
    {
      key: "status",
      header: t("columns.status"),
      cell: (p) => <StatusBadge status={p.status ?? ""} label={statusLabel(p.status ?? "")} />,
    },
    {
      key: "actions",
      header: <span className="sr-only">{t("columns.actions")}</span>,
      align: "right",
      cell: (p) => (
        <div className="flex items-center justify-end gap-1">
          <Button size="sm" variant="ghost" onClick={() => setAccessFor(p)}>
            <HugeiconsIcon icon={SquareLock02Icon} data-icon="inline-start" />
            {t("users.access")}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setCentrosFor(p)}>
            <HugeiconsIcon icon={Building01Icon} data-icon="inline-start" />
            {t("users.centros")}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon-sm" variant="ghost" aria-label={t("users.masAcciones")}>
                <HugeiconsIcon icon={MoreHorizontalIcon} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setEditFor(p)}>
                {t("users.editar")}
              </DropdownMenuItem>
              {p.status === "aprobado" && !p.isMaster && (
                <DropdownMenuItem
                  variant="destructive"
                  disabled={busyId === p.id}
                  onClick={() => toggleSuspension(p)}
                >
                  {t("users.suspender")}
                </DropdownMenuItem>
              )}
              {p.status === "suspendido" && (
                <DropdownMenuItem onClick={() => toggleSuspension(p)}>
                  {t("users.reactivar")}
                </DropdownMenuItem>
              )}
              {/* Código de acceso: el usuario pone su propia clave. Solo con permiso y perfil aprobado
                  (el BE responde 409 si está suspendido/rechazado). Handoff codigo-de-acceso. */}
              {puedeCodigo && p.status === "aprobado" && (
                <DropdownMenuItem disabled={busyId === p.id} onClick={() => generarCodigo(p)}>
                  {t("users.generarCodigo")}
                </DropdownMenuItem>
              )}
              {/* Cambiar email de acceso: solo con permiso y perfil NO master (el BE también lo rechaza).
                  Abre un diálogo con confirmación porque cierra las sesiones abiertas. Handoff cambiar-email. */}
              {puedeEmail && !p.isMaster && (
                <DropdownMenuItem onClick={() => setEmailFor(p)}>
                  {t("users.cambiarEmail")}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <HugeiconsIcon
            icon={Search01Icon}
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("users.buscar")}
            className="pl-8"
          />
        </div>
        <div
          role="group"
          aria-label={t("columns.status")}
          className="inline-flex items-center gap-0.5 rounded-lg bg-muted p-0.5"
        >
          {(["all", ...USER_STATUSES] as UserStatusFilter[])
            .filter((s) => s === "all" || counts[s] > 0)
            .map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={status === s}
                onClick={() => setStatus(s)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground",
                  status === s && "bg-background text-foreground shadow-sm"
                )}
              >
                {s === "all" ? t("users.filterAll") : statusLabel(s)}
                <span className="tabular-nums text-muted-foreground">{counts[s]}</span>
              </button>
            ))}
        </div>
        <Button size="sm" className="ml-auto" onClick={() => setInviteOpen(true)}>
          <HugeiconsIcon icon={UserAdd01Icon} data-icon="inline-start" />
          {t("users.invite")}
        </Button>
      </div>

      <DataTable
        columns={columns}
        state={filtered}
        getRowKey={(p) => p.id}
        onReload={reload}
        fill
        labels={{
          empty: q.trim() || status !== "all" ? t("users.sinResultados") : t("users.empty"),
        }}
      />

      <InviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onInvited={reload}
        onRequestAssign={(profile) => setCentrosFor(profile)}
      />
      <ProfileCentrosDialog
        key={centrosFor?.id ?? "centros-none"}
        profile={centrosFor}
        open={centrosFor !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCentrosFor(null)
            reload()
          }
        }}
      />
      <ProfileEditDialog
        key={editFor?.id ?? "edit-none"}
        profile={editFor}
        open={editFor !== null}
        onOpenChange={(open) => !open && setEditFor(null)}
        onSaved={reload}
      />
      <AccessDialog
        profile={accessFor}
        onOpenChange={(open) => !open && setAccessFor(null)}
      />

      <CodigoAccesoDialog codigo={codigo} onClose={() => setCodigo(null)} />
      <CambiarEmailDialog perfil={emailFor} onClose={() => setEmailFor(null)} onSaved={reload} />
    </div>
  )
}
