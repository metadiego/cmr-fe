"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import {
  assignCenter,
  getAsignaciones,
  revokeAsignacion,
  updateAsignacion,
  type Asignacion,
  type Perfil,
} from "@/lib/api/profiles"
import { getCenters, type Centro } from "@/lib/api/centers"
import { toastError } from "@/lib/api/errors"
import { useResource } from "@/hooks/use-resource"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const TIPOS = ["base", "temporal", "fijo"] as const

/**
 * Centros de un usuario (D4): lista sus asignaciones (tipo + vigencia + estado),
 * agrega una nueva (temporal = cubrir en otro centro hasta una fecha; fijo/base =
 * cambio de centro) y revoca. Un centro a la vez lo garantiza el BE.
 */
export function ProfileCentrosDialog({
  profile,
  open,
  onOpenChange,
}: {
  profile: Perfil | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations("admin.centrosPerfil")
  const tRoot = useTranslations()
  const perfilId = profile?.id ?? ""

  const { state: asigState, refresh } = useResource<Asignacion[]>(
    () => (open && perfilId ? getAsignaciones(perfilId) : Promise.resolve([])),
    [open, perfilId]
  )
  const { state: centersState } = useResource<Centro[]>(
    () => (open ? getCenters() : Promise.resolve([])),
    [open]
  )
  const centers = centersState.kind === "ok" ? centersState.data : []
  const nombreCentro = (id: string) =>
    centers.find((c) => c.id === id)?.nombre ?? id.slice(0, 8)

  // Alta
  const [centroId, setCentroId] = React.useState("")
  const [tipo, setTipo] = React.useState<(typeof TIPOS)[number]>("base")
  const [hasta, setHasta] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)

  function reset() {
    setCentroId("")
    setTipo("base")
    setHasta("")
  }

  async function onAdd() {
    if (!centroId || !profile) return
    setSubmitting(true)
    try {
      await assignCenter(profile.id, {
        centroId,
        tipo,
        vigenteHasta: tipo === "temporal" && hasta ? hasta : undefined,
      })
      toast.success(t("asignado"))
      reset()
      refresh()
    } catch (err) {
      toastError(err, tRoot)
    } finally {
      setSubmitting(false)
    }
  }

  async function onRevoke(a: Asignacion) {
    if (!profile) return
    if (
      !window.confirm(t("confirmRevocar", { centro: nombreCentro(a.centroId) }))
    )
      return
    try {
      await revokeAsignacion(profile.id, a.id)
      toast.success(t("revocada"))
      refresh()
    } catch (err) {
      toastError(err, tRoot)
    }
  }

  async function onReactivate(a: Asignacion) {
    if (!profile) return
    try {
      await updateAsignacion(profile.id, a.id, { activo: true })
      toast.success(t("reactivada"))
      refresh()
    } catch (err) {
      toastError(err, tRoot)
    }
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset()
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {t("title", { nombre: profile?.nombre ?? "" })}
          </DialogTitle>
          <DialogDescription>{t("help")}</DialogDescription>
        </DialogHeader>

        {/* Asignaciones actuales */}
        <div className="space-y-2">
          {asigState.kind === "loading" && (
            <p className="text-sm text-muted-foreground">
              {tRoot("common.loading")}
            </p>
          )}
          {asigState.kind === "fail" && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {asigState.message}
            </p>
          )}
          {asigState.kind === "ok" && asigState.data.length === 0 && (
            <p className="text-sm text-muted-foreground">{t("vacio")}</p>
          )}
          {asigState.kind === "ok" &&
            asigState.data.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between gap-3 rounded-md bg-card px-3 py-2 shadow-sm shadow-[rgba(16,32,64,0.06)] ring-1 ring-foreground/10"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">
                    {a.centro?.nombre ?? nombreCentro(a.centroId)}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <Badge
                      variant={a.tipo === "temporal" ? "outline" : "secondary"}
                    >
                      {t(`tipo_${a.tipo ?? "base"}`)}
                    </Badge>
                    {a.vigenteHasta && (
                      <span>{t("hasta", { fecha: a.vigenteHasta })}</span>
                    )}
                    {!a.activo && (
                      <Badge variant="destructive">{t("inactiva")}</Badge>
                    )}
                  </div>
                </div>
                {a.activo ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onRevoke(a)}
                  >
                    {t("revocar")}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onReactivate(a)}
                  >
                    {t("reactivar")}
                  </Button>
                )}
              </div>
            ))}
        </div>

        {/* Alta de asignación */}
        <div className="space-y-3 rounded-md bg-card p-3 shadow-sm shadow-[rgba(16,32,64,0.06)] ring-1 ring-foreground/10">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t("centro")}</Label>
              <Select value={centroId || undefined} onValueChange={setCentroId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("centroPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {centers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("tipoLabel")}</Label>
              <Select
                value={tipo}
                onValueChange={(v) => setTipo(v as (typeof TIPOS)[number])}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS.map((x) => (
                    <SelectItem key={x} value={x}>
                      {t(`tipo_${x}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {tipo === "temporal" && (
              <div className="space-y-1.5 sm:col-span-2">
                <Label>{t("vigenteHasta")}</Label>
                <Input
                  type="date"
                  value={hasta}
                  onChange={(e) => setHasta(e.target.value)}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              size="sm"
              onClick={onAdd}
              disabled={!centroId || submitting}
            >
              {t("agregar")}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
