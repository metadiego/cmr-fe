"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import {
  reactivarProfile,
  suspenderProfile,
  generarCodigoAcceso,
  type Perfil,
  type CodigoAccesoResult,
} from "@/lib/api/profiles"
import { toastError } from "@/lib/api/errors"
import { useCan } from "@/hooks/use-can"
import { cn } from "@/lib/utils"
import { HugeiconsIcon } from "@hugeicons/react"
import { MoreHorizontalIcon, Shield01Icon, SquareLock02Icon } from "@hugeicons/core-free-icons"
import { CodigoAccesoDialog } from "@/components/admin/codigo-acceso-dialog"
import { CambiarEmailDialog } from "@/components/admin/cambiar-email-dialog"
import { AccessDialog } from "@/components/admin/access-dialog"
import { ProfileEditDialog } from "@/components/admin/profile-edit-dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

// The login of a staff member, managed from their record (Staff and Users are one screen): status,
// exceptions, and every action the old users table had. Roles and centers are the person's positions
// («Puestos» on the same record). Only an admin gets here: managing access needs full access in the BE.

const USER_STATUSES = ["aprobado", "pendiente", "suspendido", "rechazado"]

// Status as a soft badge with a colored dot (approved = success, pending = warning, else destructive).
const STATUS_TONE: Record<string, { badge: string; dot: string }> = {
  aprobado: { badge: "bg-success/10 text-success", dot: "bg-success" },
  pendiente: { badge: "bg-warning text-warning-foreground", dot: "bg-warning-foreground" },
  suspendido: { badge: "bg-destructive/10 text-destructive", dot: "bg-destructive" },
  rechazado: { badge: "bg-destructive/10 text-destructive", dot: "bg-destructive" },
}

export function UserStatusBadge({ status }: { status: string }) {
  const t = useTranslations("admin")
  const tone = STATUS_TONE[status] ?? STATUS_TONE.pendiente
  return (
    <Badge variant="ghost" className={cn("gap-1.5", tone.badge)}>
      <span aria-hidden className={cn("size-1.5 rounded-full", tone.dot)} />
      {USER_STATUSES.includes(status) ? t(`users.status.${status}`) : status}
    </Badge>
  )
}

export function UserAccessPanel({ profile, onChanged }: { profile: Perfil; onChanged: () => void }) {
  const t = useTranslations("admin")
  const tRoot = useTranslations()
  const { can } = useCan()
  const [busy, setBusy] = React.useState(false)
  const [accessOpen, setAccessOpen] = React.useState(false)
  const [editOpen, setEditOpen] = React.useState(false)
  const [emailOpen, setEmailOpen] = React.useState(false)
  const [codigo, setCodigo] = React.useState<CodigoAccesoResult | null>(null)

  async function run(fn: () => Promise<void>) {
    if (busy) return // avoids a double POST (the second would be a 409)
    setBusy(true)
    try {
      await fn()
    } catch (err) {
      toastError(err, tRoot)
    } finally {
      setBusy(false)
    }
  }

  const toggleSuspension = () =>
    run(async () => {
      if (profile.status === "aprobado") {
        await suspenderProfile(profile.id)
        toast.success(t("users.suspendido"))
      } else {
        await reactivarProfile(profile.id)
        toast.success(t("users.reactivado"))
      }
      onChanged()
    })

  // A temporary credential shown once in a dialog with copy; never stored.
  const generateCode = () => run(async () => setCodigo(await generarCodigoAcceso(profile.id)))

  return (
    <div className="space-y-3 rounded-md border px-3 py-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <UserStatusBadge status={profile.status ?? ""} />
        {profile.isAdmin && (
          <Badge className="gap-1">
            <HugeiconsIcon icon={Shield01Icon} data-icon="inline-start" />
            {t("users.adminBadge")}
          </Badge>
        )}
        <span className="min-w-0 truncate text-muted-foreground">{profile.email}</span>
        <div className="ml-auto flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={() => setAccessOpen(true)}>
            <HugeiconsIcon icon={SquareLock02Icon} data-icon="inline-start" />
            {t("users.access")}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon-sm" variant="ghost" aria-label={t("users.masAcciones")}>
                <HugeiconsIcon icon={MoreHorizontalIcon} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setEditOpen(true)}>{t("users.editar")}</DropdownMenuItem>
              {profile.status === "aprobado" && !profile.isAdmin && (
                <DropdownMenuItem variant="destructive" disabled={busy} onClick={toggleSuspension}>
                  {t("users.suspender")}
                </DropdownMenuItem>
              )}
              {profile.status === "suspendido" && (
                <DropdownMenuItem disabled={busy} onClick={toggleSuspension}>
                  {t("users.reactivar")}
                </DropdownMenuItem>
              )}
              {/* The BE answers 409 for a login that is not approved. */}
              {can("profiles.codigo_acceso") && profile.status === "aprobado" && (
                <DropdownMenuItem disabled={busy} onClick={generateCode}>
                  {t("users.generarCodigo")}
                </DropdownMenuItem>
              )}
              {/* Signs the person out everywhere, so the dialog asks for confirmation. */}
              {can("profiles.email") && !profile.isAdmin && (
                <DropdownMenuItem onClick={() => setEmailOpen(true)}>{t("users.cambiarEmail")}</DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <ProfileEditDialog
        key={editOpen ? profile.id : "edit-none"}
        profile={editOpen ? profile : null}
        open={editOpen}
        onOpenChange={(open) => !open && setEditOpen(false)}
        onSaved={onChanged}
      />
      <AccessDialog
        profile={accessOpen ? profile : null}
        onOpenChange={(open) => {
          if (!open) {
            setAccessOpen(false)
            onChanged()
          }
        }}
      />
      <CodigoAccesoDialog codigo={codigo} onClose={() => setCodigo(null)} />
      <CambiarEmailDialog
        perfil={emailOpen ? profile : null}
        onClose={() => setEmailOpen(false)}
        onSaved={onChanged}
      />
    </div>
  )
}
