"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import {
  getRolePermisos,
  setRolePermisos,
  type Rol,
  type Permiso,
} from "@/lib/api/rbac"
import { apiErrorMessage } from "@/lib/api/errors"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

// Editor de permisos de UN rol (diálogo), agrupado por módulo. Precarga las claves actuales antes de
// guardar porque el PUT es un REPLACE completo. Extraído de rbac-settings.tsx (techo de líneas).
export function PermisosDialog({
  role,
  permisos,
  onOpenChange,
}: {
  role: Rol | null
  permisos: Permiso[]
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations("admin.rbac")
  const tc = useTranslations("admin")
  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const [loaded, setLoaded] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)

  // PRECARGA las claves actuales del rol: sin esto, guardar con el set vacío
  // BORRABA los permisos del rol (el PUT es un replace completo).
  React.useEffect(() => {
    if (!role) return
    let active = true
    getRolePermisos(role.id)
      .then((claves) => {
        if (!active) return
        setSelected(new Set(claves))
        setLoaded(true)
      })
      .catch((err) => active && toast.error(apiErrorMessage(err)))
    return () => {
      active = false
    }
  }, [role])

  const byModulo = React.useMemo(() => {
    const acc: Record<string, Permiso[]> = {}
    for (const p of permisos) (acc[p.module] ??= []).push(p)
    return acc
  }, [permisos])

  function toggle(clave: string, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (on) next.add(clave)
      else next.delete(clave)
      return next
    })
  }

  async function onSubmit() {
    if (!role) return
    setSubmitting(true)
    try {
      await setRolePermisos(role.id, [...selected])
      toast.success(t("permisosSaved"))
      onOpenChange(false)
    } catch (err) {
      toast.error(apiErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={role !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("permisosTitle", { role: role?.name ?? "" })}</DialogTitle>
          <DialogDescription>{t("permisosHelp")}</DialogDescription>
        </DialogHeader>

        {!loaded && <p className="text-sm text-muted-foreground">{t("loading")}</p>}
        <div className="space-y-4">
          {loaded &&
            Object.entries(byModulo).map(([modulo, list]) => (
              <div key={modulo} className="space-y-2">
                <p className="text-sm font-semibold capitalize">{modulo}</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {list.map((p) => (
                    <label key={p.slug} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={selected.has(p.slug)}
                        onCheckedChange={(v) => toggle(p.slug, v === true)}
                      />
                      <span className="font-mono text-xs">{p.action}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tc("cancel")}
          </Button>
          <Button onClick={onSubmit} disabled={submitting || !loaded}>
            {submitting ? t("saving") : t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
