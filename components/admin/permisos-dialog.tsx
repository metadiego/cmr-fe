"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import {
  getRolePermisos,
  setRolePermisos,
  type Rol,
  type Permiso,
} from "@/lib/api/rbac"
import { apiErrorMessage } from "@/lib/api/errors"
import { isAdminRole } from "@/lib/access/role-keys"
import { Checkbox } from "@/components/ui/checkbox"
import { FormDialog } from "@/components/kit/form-dialog"
import { useSubmit } from "@/components/kit/use-submit"
import { useDialogForm } from "@/components/kit/use-dialog-form"

// Permission editor for ONE role (dialog), grouped by module. Preloads the current keys before
// saving because the PUT is a full REPLACE. Extracted from rbac-settings.tsx (line ceiling).
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
  const open = role !== null
  // The admin role holds full access and cannot be edited (the backend answers 400 rbac.adminRoleFixed).
  const fixed = isAdminRole(role)
  // Reset per role: another role must never show (and save) the previous role's keys.
  const [form, update] = useDialogForm(
    () => ({ selected: new Set<string>(), loaded: false, loadError: null as string | null }),
    open,
    role?.id,
  )

  // PRELOAD the role's current keys: without this, saving with the empty set
  // ERASED the role's permissions (the PUT is a full replace).
  React.useEffect(() => {
    if (!role) return
    let active = true
    getRolePermisos(role.id)
      .then((claves) => {
        if (active) update({ selected: new Set(claves), loaded: true, loadError: null })
      })
      .catch((err) => {
        if (active) update({ loadError: apiErrorMessage(err) })
      })
    return () => {
      active = false
    }
  }, [role, update])

  const byModulo = React.useMemo(() => {
    const acc: Record<string, Permiso[]> = {}
    for (const p of permisos) (acc[p.module] ??= []).push(p)
    return acc
  }, [permisos])

  function toggle(clave: string, on: boolean) {
    update((s) => {
      const next = new Set(s.selected)
      if (on) next.add(clave)
      else next.delete(clave)
      return { ...s, selected: next }
    })
  }

  const { submitting, submit } = useSubmit(
    async () => {
      if (!role) throw new Error("no role") // unreachable: the dialog is open only with a role
      await setRolePermisos(role.id, [...form.selected])
    },
    { successMessage: t("permisosSaved"), onSuccess: () => onOpenChange(false) },
  )

  // Saving was already disabled while loading and for the fixed admin role; now each says why.
  const reason = fixed
    ? t("adminRoleFixed")
    : !form.loaded
      ? (form.loadError ?? t("loading"))
      : null

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      title={t("permisosTitle", { role: role?.name ?? "" })}
      description={fixed ? t("adminRoleFixed") : t("permisosHelp")}
      // Saving REPLACES (and may remove) the role's permissions: Enter never fires it, only the button.
      onSubmit={() => {}}
      actions={[{ label: t("save"), onClick: () => submit() }]}
      submitting={submitting}
      submittingLabel={t("saving")}
      cancelLabel={tc("cancel")}
      blocked={fixed || !form.loaded}
      reason={reason}
    >
      {!form.loaded && !form.loadError && (
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      )}
      {form.loaded &&
        Object.entries(byModulo).map(([modulo, list]) => (
          <div key={modulo} className="space-y-2">
            <p className="text-sm font-semibold capitalize">{modulo}</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {list.map((p) => (
                <label key={p.slug} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.selected.has(p.slug)}
                    disabled={fixed}
                    onCheckedChange={(v) => toggle(p.slug, v === true)}
                  />
                  <span className="font-mono text-xs">{p.action}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
    </FormDialog>
  )
}
