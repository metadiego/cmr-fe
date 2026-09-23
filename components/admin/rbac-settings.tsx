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
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { DataTable } from "@/components/ui/data-table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

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
  // Vista lista (la de siempre) vs rejilla (todos los roles a la vez, marcando en la tarjeta).
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
    // Confirmación: borrar un rol arrastra sus asignaciones (FK cascade).
    if (!window.confirm(t("confirmDelete", { role: r.name }))) return
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
          {/* Toggle de vista (por dispositivo no hace falta recordarlo; es una preferencia de sesión). */}
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
                  {/* Editar (solo nombre/descripción, NUNCA la clave) también para roles Sistema: el BE
                      acepta el PUT de nombre en Sistema (verificado). Solo Eliminar queda vedado a Sistema. */}
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
 * Vínculo rol↔menú (D2): qué opciones del menú ve el rol, con checkboxes.
 * Ítems sin permiso son visibles para todos (check fijo); marcar/desmarcar
 * traduce a permisos del rol sin tocar sus permisos no ligados a menú.
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
  const [items, setItems] = React.useState<ProfileMenuItem[] | null>(null)
  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = React.useState(false)

  React.useEffect(() => {
    if (!role) return
    let active = true
    getRoleMenu(role.id)
      .then((list) => {
        if (!active) return
        setItems(list)
        setSelected(
          new Set(
            list
              .filter((i) => i.allowed && i.requiresPermiso)
              .map((i) => i.slug)
          )
        )
      })
      .catch((err) => active && toast.error(apiErrorMessage(err)))
    return () => {
      active = false
    }
  }, [role])

  function labelDe(i: ProfileMenuItem) {
    const anyI = i as unknown as { customLabel?: string | null }
    if (anyI.customLabel) return anyI.customLabel
    return tRoot.has(i.labelKey) ? tRoot(i.labelKey) : i.slug
  }

  async function onSubmit() {
    if (!role) return
    setSubmitting(true)
    try {
      await setRoleMenu(role.id, [...selected])
      toast.success(t("menuRolSaved"))
      onOpenChange(false)
    } catch (err) {
      toast.error(apiErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={role !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {t("menuRolTitle", { role: role?.name ?? "" })}
          </DialogTitle>
          <DialogDescription>{t("menuRolHelp")}</DialogDescription>
        </DialogHeader>

        {!items && (
          <p className="text-sm text-muted-foreground">{t("loading")}</p>
        )}
        <div className="space-y-1">
          {items?.map((i) => {
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
                  checked={participa ? selected.has(i.slug) : true}
                  disabled={!participa}
                  onCheckedChange={(v) =>
                    setSelected((prev) => {
                      const next = new Set(prev)
                      if (v === true) next.add(i.slug)
                      else next.delete(i.slug)
                      return next
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

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tc("cancel")}
          </Button>
          <Button onClick={onSubmit} disabled={submitting || !items}>
            {submitting ? t("saving") : t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
  const [nombre, setNombre] = React.useState(role?.name ?? "")
  const [descripcion, setDescripcion] = React.useState(role?.description ?? "")
  const [todosLosCentros, setTodosLosCentros] = React.useState(!!role?.allCenters)
  const [submitting, setSubmitting] = React.useState(false)

  async function onSubmit() {
    if (!role || !nombre.trim()) return
    setSubmitting(true)
    try {
      await updateRole(role.id, {
        name: nombre.trim(),
        description: descripcion.trim() || undefined,
        allCenters: todosLosCentros,
      })
      toast.success(t("updated"))
      onOpenChange(false)
      onSaved()
    } catch (err) {
      toast.error(apiErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={role !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("editTitle")}</DialogTitle>
          <DialogDescription>{role?.slug}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t("name")}</Label>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("description")}</Label>
            <Input
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
            />
          </div>
          {/* Rol multi-centro: quien lo recibe lo hereda; se asigna global (sin centroId). */}
          <label className="flex items-start gap-2">
            <Checkbox checked={todosLosCentros} onCheckedChange={(v) => setTodosLosCentros(v === true)} className="mt-0.5" />
            <span>
              <span className="text-sm font-medium">{t("todosLosCentros")}</span>
              <span className="block text-xs text-muted-foreground">{t("todosLosCentrosAyuda")}</span>
            </span>
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tc("cancel")}
          </Button>
          <Button onClick={onSubmit} disabled={submitting || !nombre.trim()}>
            {submitting ? t("saving") : t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
  const [clave, setClave] = React.useState("")
  const [nombre, setNombre] = React.useState("")
  const [descripcion, setDescripcion] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)

  function handleOpenChange(next: boolean) {
    if (!next) {
      setClave("")
      setNombre("")
      setDescripcion("")
    }
    onOpenChange(next)
  }

  async function onSubmit() {
    if (!clave.trim() || !nombre.trim()) return
    setSubmitting(true)
    try {
      await createRole({
        slug: clave.trim(),
        name: nombre.trim(),
        description: descripcion.trim() || undefined,
      })
      toast.success(t("created"))
      handleOpenChange(false)
      onCreated()
    } catch (err) {
      toast.error(apiErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("createTitle")}</DialogTitle>
          <DialogDescription>{t("createHelp")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t("clave")}</Label>
            <Input
              value={clave}
              onChange={(e) => setClave(e.target.value)}
              placeholder="recepcion"
              className="font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t("name")}</Label>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("description")}</Label>
            <Input
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            {tc("cancel")}
          </Button>
          <Button
            onClick={onSubmit}
            disabled={submitting || !clave.trim() || !nombre.trim()}
          >
            {submitting ? t("creating") : t("createSubmit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
