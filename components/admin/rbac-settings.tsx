"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import {
  getRoles,
  getPermisos,
  getRoleMenu,
  setRoleMenu,
  createRole,
  updateRole,
  deleteRole,
  type Rol,
  type Permiso,
  type ProfileMenuItem,
} from "@/lib/api/rbac"
import { apiErrorMessage } from "@/lib/api/errors"
import { PermisosDialog } from "@/components/admin/permisos-dialog"
import { RbacGrid } from "@/components/admin/rbac-grid"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { DataTable } from "@/components/ui/data-table"
import { FormDialog, Field } from "@/components/kit/form-dialog"
import { useConfirm } from "@/components/kit/confirm-host"
import { useSubmit } from "@/components/kit/use-submit"
import { useDialogForm } from "@/components/kit/use-dialog-form"
import { missingFields } from "@/lib/forms/missing"

type State =
  | { kind: "loading" }
  | { kind: "ok"; roles: Rol[] }
  | { kind: "fail"; message: string }

// RBAC admin (F2): manage roles + their permisos. The BE has no GET for a role's
// current permisos, so the permisos editor sets from scratch (replace) — warned.
export function RbacSettings() {
  const t = useTranslations("admin.rbac")
  const [state, setState] = React.useState<State>({ kind: "loading" })
  const [permisos, setPermisos] = React.useState<Permiso[]>([])
  const [createOpen, setCreateOpen] = React.useState(false)
  const [permisosFor, setPermisosFor] = React.useState<Rol | null>(null)
  const [menuFor, setMenuFor] = React.useState<Rol | null>(null)
  const [editFor, setEditFor] = React.useState<Rol | null>(null)
  const [busyId, setBusyId] = React.useState<string | null>(null)
  // List view (the usual one) vs grid (all roles at once, ticking on the card).
  const confirm = useConfirm()
  const [vista, setVista] = React.useState<"lista" | "rejilla">("lista")

  const load = React.useCallback(async () => {
    try {
      const roles = await getRoles()
      setState({ kind: "ok", roles })
    } catch (err) {
      setState({ kind: "fail", message: apiErrorMessage(err) })
    }
  }, [])

  React.useEffect(() => {
    let active = true
    getRoles()
      .then((roles) => active && setState({ kind: "ok", roles }))
      .catch(
        (err) =>
          active && setState({ kind: "fail", message: apiErrorMessage(err) })
      )
    getPermisos()
      .then((list) => active && setPermisos(list))
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  async function onDelete(r: Rol) {
    // Confirm: deleting a role drags its assignments with it (FK cascade).
    const ok = await confirm({
      title: t("confirmDelete", { role: r.name }),
      confirmLabel: t("delete"),
      destructive: true,
    })
    if (!ok) return
    setBusyId(r.id)
    try {
      await deleteRole(r.id)
      toast.success(t("deleted"))
      load()
    } catch (err) {
      toast.error(apiErrorMessage(err))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-medium">{t("title")}</h2>
          <p className="text-sm text-muted-foreground">{t("help")}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle (no need to remember it per device; it is a session preference). */}
          <div className="inline-flex rounded-md border p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setVista("lista")}
              className={"rounded-md px-2.5 py-1 font-medium transition-colors " + (vista === "lista" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              {t("viewList")}
            </button>
            <button
              type="button"
              onClick={() => setVista("rejilla")}
              className={"rounded-md px-2.5 py-1 font-medium transition-colors " + (vista === "rejilla" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              {t("viewGrid")}
            </button>
          </div>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            {t("create")}
          </Button>
        </div>
      </div>

      {vista === "rejilla" && <RbacGrid />}

      {vista === "lista" && state.kind === "loading" && (
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      )}
      {vista === "lista" && state.kind === "fail" && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.message}
        </p>
      )}
      {vista === "lista" && state.kind === "ok" && (
        <DataTable>
          <TableHeader>
            <TableRow>
              <TableHead>{t("clave")}</TableHead>
              <TableHead>{t("name")}</TableHead>
              <TableHead>{t("type")}</TableHead>
              <TableHead className="text-right">{t("actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {state.roles.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono">{r.slug}</TableCell>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell>
                  <Badge variant={r.isSystem ? "secondary" : "outline"}>
                    {r.isSystem ? t("system") : t("custom")}
                  </Badge>
                </TableCell>
                <TableCell className="space-x-2 text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPermisosFor(r)}
                  >
                    {t("permisos")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setMenuFor(r)}
                  >
                    {t("menuRol")}
                  </Button>
                  {/* Edit (name/description only, NEVER the key) also for System roles: the BE accepts
                      the name PUT on System (verified). Only Delete is barred for System. */}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditFor(r)}
                  >
                    {t("edit")}
                  </Button>
                  {!r.isSystem && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onDelete(r)}
                      disabled={busyId === r.id}
                    >
                      {t("delete")}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </DataTable>
      )}

      <CreateRoleDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={load}
      />
      <PermisosDialog
        key={permisosFor?.id ?? "none"}
        role={permisosFor}
        permisos={permisos}
        onOpenChange={(open) => !open && setPermisosFor(null)}
      />
      <EditRoleDialog
        key={editFor?.id ?? "edit-none"}
        role={editFor}
        onOpenChange={(open) => !open && setEditFor(null)}
        onSaved={load}
      />
      <RoleMenuDialog
        key={menuFor?.id ?? "menu-none"}
        role={menuFor}
        onOpenChange={(open) => !open && setMenuFor(null)}
      />
    </section>
  )
}

/**
 * Role↔menu link (D2): which menu options the role sees, with checkboxes.
 * Items without a permission are visible to everyone (fixed tick); ticking/unticking
 * translates to the role's permissions without touching its non-menu permissions.
 */
function RoleMenuDialog({
  role,
  onOpenChange,
}: {
  role: Rol | null
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations("admin.rbac")
  const tc = useTranslations("admin")
  const tRoot = useTranslations()
  const open = role !== null
  const [form, update] = useDialogForm(
    () => ({
      items: null as ProfileMenuItem[] | null,
      selected: new Set<string>(),
      loadError: null as string | null,
    }),
    open,
    role?.id,
  )

  React.useEffect(() => {
    if (!role) return
    let active = true
    getRoleMenu(role.id)
      .then((list) => {
        if (!active) return
        update({
          items: list,
          selected: new Set(
            list.filter((i) => i.allowed && i.requiresPermiso).map((i) => i.slug)
          ),
          loadError: null,
        })
      })
      .catch((err) => {
        if (active) update({ loadError: apiErrorMessage(err) })
      })
    return () => {
      active = false
    }
  }, [role, update])

  function labelDe(i: ProfileMenuItem) {
    const anyI = i as unknown as { customLabel?: string | null }
    if (anyI.customLabel) return anyI.customLabel
    return tRoot.has(i.labelKey) ? tRoot(i.labelKey) : i.slug
  }

  const { submitting, submit } = useSubmit(
    async () => {
      if (!role) throw new Error("no role") // unreachable: the dialog is open only with a role
      await setRoleMenu(role.id, [...form.selected])
    },
    {
      successMessage: t("menuRolSaved"),
      onSuccess: () => onOpenChange(false),
      onError: (err) => {
        toast.error(apiErrorMessage(err))
        return true
      },
    },
  )

  const loaded = form.items !== null

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={t("menuRolTitle", { role: role?.name ?? "" })}
      description={t("menuRolHelp")}
      // Saving may remove menu permissions from the role: Enter never fires it, only the button.
      onSubmit={() => {}}
      actions={[{ label: t("save"), onClick: () => submit() }]}
      submitting={submitting}
      submittingLabel={t("saving")}
      cancelLabel={tc("cancel")}
      // Saving was already disabled until the menu loads; now it says why.
      blocked={!loaded}
      reason={loaded ? null : (form.loadError ?? t("loading"))}
    >
      {!loaded && !form.loadError && (
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      )}
      <div className="space-y-1">
        {form.items?.map((i) => {
          const anyI = i as unknown as {
            type?: string
            parentSlug?: string | null
          }
          if (anyI.type === "separador") return null
          const esGrupo = anyI.type === "grupo"
          const indent = anyI.parentSlug && !esGrupo ? "pl-6" : ""
          if (esGrupo) {
            return (
              <p
                key={i.slug}
                className="pt-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase"
              >
                {labelDe(i)}
              </p>
            )
          }
          const participa = !!i.requiresPermiso
          return (
            <label
              key={i.slug}
              className={`flex items-center gap-2 text-sm ${indent}`}
            >
              <Checkbox
                checked={participa ? form.selected.has(i.slug) : true}
                disabled={!participa}
                onCheckedChange={(v) =>
                  update((s) => {
                    const next = new Set(s.selected)
                    if (v === true) next.add(i.slug)
                    else next.delete(i.slug)
                    return { ...s, selected: next }
                  })
                }
              />
              <span className="min-w-0 truncate">{labelDe(i)}</span>
              {!participa && (
                <Badge variant="outline" className="ml-auto">
                  {t("menuRolSinPermiso")}
                </Badge>
              )}
            </label>
          )
        })}
      </div>
    </FormDialog>
  )
}

function EditRoleDialog({
  role,
  onOpenChange,
  onSaved,
}: {
  role: Rol | null
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const t = useTranslations("admin.rbac")
  const tc = useTranslations("admin")
  const open = role !== null
  const [form, update] = useDialogForm(
    () => ({
      nombre: role?.name ?? "",
      descripcion: role?.description ?? "",
      todosLosCentros: !!role?.allCenters,
    }),
    open,
    role?.id,
  )

  const missing = missingFields([[t("name"), !!form.nombre.trim()]])

  const { submitting, submit } = useSubmit(
    async () => {
      if (!role) throw new Error("no role") // unreachable: the dialog is open only with a role
      await updateRole(role.id, {
        name: form.nombre.trim(),
        description: form.descripcion.trim() || undefined,
        allCenters: form.todosLosCentros,
      })
    },
    {
      successMessage: t("updated"),
      onSuccess: () => {
        onOpenChange(false)
        onSaved()
      },
      onError: (err) => {
        toast.error(apiErrorMessage(err))
        return true
      },
    },
  )

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      title={t("editTitle")}
      description={role?.slug}
      onSubmit={() => submit()}
      submitting={submitting}
      submitLabel={t("save")}
      submittingLabel={t("saving")}
      cancelLabel={tc("cancel")}
      missing={missing}
    >
      <Field label={t("name")} htmlFor="role-edit-name" required>
        <Input
          id="role-edit-name"
          value={form.nombre}
          onChange={(e) => update({ nombre: e.target.value })}
        />
      </Field>
      <Field label={t("description")} htmlFor="role-edit-description">
        <Input
          id="role-edit-description"
          value={form.descripcion}
          onChange={(e) => update({ descripcion: e.target.value })}
        />
      </Field>
      {/* Multi-center role: whoever gets it inherits it; assigned globally (no centerId). */}
      <label className="flex items-start gap-2">
        <Checkbox
          checked={form.todosLosCentros}
          onCheckedChange={(v) => update({ todosLosCentros: v === true })}
          className="mt-0.5"
        />
        <span>
          <span className="text-sm font-medium">{t("todosLosCentros")}</span>
          <span className="block text-xs text-muted-foreground">{t("todosLosCentrosAyuda")}</span>
        </span>
      </label>
    </FormDialog>
  )
}

function CreateRoleDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}) {
  const t = useTranslations("admin.rbac")
  const tc = useTranslations("admin")
  const [form, update] = useDialogForm(
    () => ({ clave: "", nombre: "", descripcion: "" }),
    open,
  )

  const missing = missingFields([
    [t("clave"), !!form.clave.trim()],
    [t("name"), !!form.nombre.trim()],
  ])

  const { submitting, submit } = useSubmit(
    () =>
      createRole({
        slug: form.clave.trim(),
        name: form.nombre.trim(),
        description: form.descripcion.trim() || undefined,
      }),
    {
      successMessage: t("created"),
      onSuccess: () => {
        onOpenChange(false)
        onCreated()
      },
      onError: (err) => {
        toast.error(apiErrorMessage(err))
        return true
      },
    },
  )

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      title={t("createTitle")}
      description={t("createHelp")}
      onSubmit={() => submit()}
      submitting={submitting}
      submitLabel={t("createSubmit")}
      submittingLabel={t("creating")}
      cancelLabel={tc("cancel")}
      missing={missing}
    >
      <Field label={t("clave")} htmlFor="role-create-key" required>
        <Input
          id="role-create-key"
          value={form.clave}
          onChange={(e) => update({ clave: e.target.value })}
          placeholder="recepcion"
          className="font-mono"
        />
      </Field>
      <Field label={t("name")} htmlFor="role-create-name" required>
        <Input
          id="role-create-name"
          value={form.nombre}
          onChange={(e) => update({ nombre: e.target.value })}
        />
      </Field>
      <Field label={t("description")} htmlFor="role-create-description">
        <Input
          id="role-create-description"
          value={form.descripcion}
          onChange={(e) => update({ descripcion: e.target.value })}
        />
      </Field>
    </FormDialog>
  )
}
