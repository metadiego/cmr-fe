"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import {
  getProfiles,
  reactivarProfile,
  suspenderProfile,
  type Perfil,
} from "@/lib/api/profiles"
import { toastError } from "@/lib/api/errors"
import { useResource } from "@/hooks/use-resource"
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

// Badge de estado con semántica de color (aprobado=ok, suspendido/rechazado=alerta).
function EstadoBadge({ estado }: { estado: string }) {
  const variant =
    estado === "aprobado"
      ? ("secondary" as const)
      : estado === "pendiente"
        ? ("outline" as const)
        : ("destructive" as const)
  return <Badge variant={variant}>{estado}</Badge>
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

  // Búsqueda client-side sobre email/nombre/rol/centro (la lista es corta).
  const filtered = React.useMemo(() => {
    if (state.kind !== "ok") return state
    const term = q.trim().toLowerCase()
    if (!term) return state
    return {
      ...state,
      data: state.data.filter((p) =>
        [
          p.email,
          p.nombre,
          p.apellido ?? "",
          ...(p.roles?.map((r) => r.nombre) ?? []),
          ...(p.centros?.map((c) => c.nombre ?? "") ?? []),
        ]
          .join(" ")
          .toLowerCase()
          .includes(term)
      ),
    }
  }, [state, q])

  async function toggleSuspension(p: Perfil) {
    if (busyId) return // evita el doble POST (el 2º daría 409)
    setBusyId(p.id)
    try {
      if (p.estado === "aprobado") {
        await suspenderProfile(p.id)
        toast.success(t("users.suspendido"))
      } else if (p.estado === "suspendido") {
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
      key: "email",
      header: t("columns.email"),
      cell: (p) => (
        <div className="min-w-0">
          <div className="truncate font-medium">{p.email}</div>
          <div className="truncate text-xs text-muted-foreground">
            {[p.nombre, p.apellido].filter(Boolean).join(" ")}
          </div>
        </div>
      ),
    },
    {
      key: "roles",
      header: t("columns.roles"),
      cell: (p) =>
        p.isMaster ? (
          <Badge>master</Badge>
        ) : p.roles?.length ? (
          <div className="flex flex-wrap gap-1">
            {p.roles.map((r) => (
              <Badge key={`${r.clave}|${r.centroId ?? ""}`} variant="secondary">
                {r.nombre}
              </Badge>
            ))}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">
            {t("users.sinRol")}
          </span>
        ),
    },
    {
      key: "centros",
      header: t("columns.centros"),
      cell: (p) => {
        const activos = (p.centros ?? []).filter((c) => c.activo)
        if (!activos.length)
          return (
            <span className="text-xs text-muted-foreground">
              {t("users.sinCentro")}
            </span>
          )
        return (
          <div className="flex flex-wrap gap-1">
            {activos.map((c) => (
              <Badge
                key={c.asignacionId}
                variant={c.tipo === "temporal" ? "outline" : "secondary"}
              >
                {c.nombre ?? c.centroId.slice(0, 8)}
                {c.tipo === "temporal" && c.vigenteHasta
                  ? ` · ${t("users.hasta", { fecha: c.vigenteHasta })}`
                  : ""}
              </Badge>
            ))}
          </div>
        )
      },
    },
    {
      key: "accessMode",
      header: t("columns.accessMode"),
      cell: (p) => (p.isMaster ? "master" : p.accessMode),
    },
    {
      key: "status",
      header: t("columns.status"),
      cell: (p) => <EstadoBadge estado={p.estado} />,
    },
    {
      key: "actions",
      header: t("columns.actions"),
      align: "right",
      cell: (p) => (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={() => setAccessFor(p)}>
            {t("users.access")}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setCentrosFor(p)}>
            {t("users.centros")}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                aria-label={t("users.masAcciones")}
              >
                <span aria-hidden>⋯</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setEditFor(p)}>
                {t("users.editar")}
              </DropdownMenuItem>
              {p.estado === "aprobado" && !p.isMaster && (
                <DropdownMenuItem
                  variant="destructive"
                  disabled={busyId === p.id}
                  onClick={() => toggleSuspension(p)}
                >
                  {t("users.suspender")}
                </DropdownMenuItem>
              )}
              {p.estado === "suspendido" && (
                <DropdownMenuItem onClick={() => toggleSuspension(p)}>
                  {t("users.reactivar")}
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
      <div className="flex items-center justify-between gap-3">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("users.buscar")}
          className="max-w-xs"
        />
        <Button size="sm" onClick={() => setInviteOpen(true)}>
          {t("users.invite")}
        </Button>
      </div>

      <DataTable
        columns={columns}
        state={filtered}
        getRowKey={(p) => p.id}
        onReload={reload}
        labels={{
          empty: q.trim() ? t("users.sinResultados") : t("users.empty"),
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
    </div>
  )
}
