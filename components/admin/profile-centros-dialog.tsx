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
import { DatePicker } from "@/components/ui/date-picker"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field } from "@/components/kit/field"
import { FormFooter } from "@/components/kit/form-footer"
import { useConfirm } from "@/components/kit/confirm-host"
import { useSubmit } from "@/components/kit/use-submit"
import { useDialogForm } from "@/components/kit/use-dialog-form"
import { missingFields } from "@/lib/forms/missing"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const TIPOS = ["base", "temporal", "fijo"] as const

/**
 * A user's centers (D4): lists their assignments (type + validity + state),
 * adds a new one (temporary = cover another center until a date; fixed/base =
 * change of center) and revokes. One center at a time is enforced by the BE.
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
    centers.find((c) => c.id === id)?.name ?? id.slice(0, 8)

  // New assignment (the list above is a viewer; this card is the only form).
  const [form, update] = useDialogForm(
    () => ({ centroId: "", tipo: "base" as (typeof TIPOS)[number], hasta: "" }),
    open,
    perfilId,
  )
  const confirm = useConfirm()

  const missing = missingFields([[t("centro"), !!form.centroId]])

  const { submitting, submit } = useSubmit(
    async () => {
      if (!profile) throw new Error("no profile") // unreachable: the dialog is open only with a profile
      await assignCenter(profile.id, {
        centerId: form.centroId,
        type: form.tipo,
        validUntil: form.tipo === "temporal" && form.hasta ? form.hasta : undefined,
      })
    },
    {
      successMessage: t("asignado"),
      onSuccess: () => {
        update({ centroId: "", tipo: "base", hasta: "" })
        refresh()
      },
    },
  )

  async function onRevoke(a: Asignacion) {
    if (!profile) return
    const ok = await confirm({
      title: t("confirmRevocar", { centro: nombreCentro(a.centerId) }),
      confirmLabel: t("revocar"),
      destructive: true,
    })
    if (!ok) return
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
      await updateAsignacion(profile.id, a.id, { active: true })
      toast.success(t("reactivada"))
      refresh()
    } catch (err) {
      toastError(err, tRoot)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o || !submitting) && onOpenChange(o)}>
      <DialogContent className="sm:max-w-xl" showCloseButton={!submitting}>
        <DialogHeader>
          <DialogTitle>
            {t("title", { nombre: profile?.name ?? "" })}
          </DialogTitle>
          <DialogDescription>{t("help")}</DialogDescription>
        </DialogHeader>

        {/* Current assignments */}
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
                    {a.center?.name ?? nombreCentro(a.centerId)}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <Badge
                      variant={a.type === "temporal" ? "outline" : "secondary"}
                    >
                      {t(`tipo_${a.type ?? "base"}`)}
                    </Badge>
                    {a.validUntil && (
                      <span>{t("hasta", { fecha: a.validUntil })}</span>
                    )}
                    {!a.active && (
                      <Badge variant="destructive">{t("inactiva")}</Badge>
                    )}
                  </div>
                </div>
                {a.active ? (
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

        {/* New assignment */}
        <div className="space-y-3 rounded-md bg-card p-3 shadow-sm shadow-[rgba(16,32,64,0.06)] ring-1 ring-foreground/10">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={t("centro")} htmlFor="profile-centers-center" required>
              <Select
                value={form.centroId || undefined}
                onValueChange={(v) => update({ centroId: v })}
              >
                <SelectTrigger id="profile-centers-center" className="w-full">
                  <SelectValue placeholder={t("centroPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {centers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t("tipoLabel")} htmlFor="profile-centers-type">
              <Select
                value={form.tipo}
                onValueChange={(v) => update({ tipo: v as (typeof TIPOS)[number] })}
              >
                <SelectTrigger id="profile-centers-type" className="w-full">
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
            </Field>
            {form.tipo === "temporal" && (
              <Field label={t("vigenteHasta")} className="sm:col-span-2">
                <DatePicker value={form.hasta} onChange={(v) => update({ hasta: v })} clearable />
              </Field>
            )}
          </div>
          {/* Inline add form inside the card: FormFooter directly, no cancel (the dialog has its own close). */}
          <FormFooter
            primary={{ label: t("agregar"), onClick: () => submit() }}
            missing={missing}
            submitting={submitting}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
