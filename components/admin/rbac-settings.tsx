"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import {
  getRoles,
  getPermisos,
  getRolePermisos,
  getRoleMenu,
  setRoleMenu,
  createRole,
  updateRole,
  deleteRole,
  setRolePermisos,
  type Rol,
  type Permiso,
  type ProfileMenuItem,
} from "@/lib/api/rbac"
import { apiErrorMessage } from "@/lib/api/errors"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
    if (!window.confirm(t("confirmDelete", { role: r.nombre }))) return
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
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          {t("create")}
        </Button>
      </div>

      {state.kind === "loading" && (
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      )}
      {state.kind === "fail" && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.message}
        </p>
      )}
      {state.kind === "ok" && (
        <Table>
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
                <TableCell className="font-mono">{r.clave}</TableCell>
                <TableCell className="font-medium">{r.nombre}</TableCell>
                <TableCell>
                  <Badge variant={r.esSistema ? "secondary" : "outline"}>
                    {r.esSistema ? t("system") : t("custom")}
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
                  {!r.esSistema && (
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
        </Table>
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
              .map((i) => i.clave)
          )
        )
      })
      .catch((err) => active && toast.error(apiErrorMessage(err)))
    return () => {
      active = false
    }
  }, [role])

  function labelDe(i: ProfileMenuItem) {
    const anyI = i as unknown as { labelCustom?: string | null }
    if (anyI.labelCustom) return anyI.labelCustom
    return tRoot.has(i.labelKey) ? tRoot(i.labelKey) : i.clave
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
            {t("menuRolTitle", { role: role?.nombre ?? "" })}
          </DialogTitle>
          <DialogDescription>{t("menuRolHelp")}</DialogDescription>
        </DialogHeader>

        {!items && (
          <p className="text-sm text-muted-foreground">{t("loading")}</p>
        )}
        <div className="space-y-1">
          {items?.map((i) => {
            const anyI = i as unknown as {
              tipo?: string
              parentClave?: string | null
            }
            if (anyI.tipo === "separador") return null
            const esGrupo = anyI.tipo === "grupo"
            const indent = anyI.parentClave && !esGrupo ? "pl-6" : ""
            if (esGrupo) {
              return (
                <p
                  key={i.clave}
                  className="pt-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase"
                >
                  {labelDe(i)}
                </p>
              )
            }
            const participa = !!i.requiresPermiso
            return (
              <label
                key={i.clave}
                className={`flex items-center gap-2 text-sm ${indent}`}
              >
                <Checkbox
                  checked={participa ? selected.has(i.clave) : true}
                  disabled={!participa}
                  onCheckedChange={(v) =>
                    setSelected((prev) => {
                      const next = new Set(prev)
                      if (v === true) next.add(i.clave)
                      else next.delete(i.clave)
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
  const [nombre, setNombre] = React.useState(role?.nombre ?? "")
  const [descripcion, setDescripcion] = React.useState(role?.descripcion ?? "")
  const [todosLosCentros, setTodosLosCentros] = React.useState(!!role?.todosLosCentros)
  const [submitting, setSubmitting] = React.useState(false)

  async function onSubmit() {
    if (!role || !nombre.trim()) return
    setSubmitting(true)
    try {
      await updateRole(role.id, {
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || undefined,
        todosLosCentros,
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
          <DialogDescription>{role?.clave}</DialogDescription>
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
        clave: clave.trim(),
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || undefined,
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

function PermisosDialog({
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
    for (const p of permisos) (acc[p.modulo] ??= []).push(p)
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
          <DialogTitle>
            {t("permisosTitle", { role: role?.nombre ?? "" })}
          </DialogTitle>
          <DialogDescription>{t("permisosHelp")}</DialogDescription>
        </DialogHeader>

        {!loaded && (
          <p className="text-sm text-muted-foreground">{t("loading")}</p>
        )}
        <div className="space-y-4">
          {loaded &&
            Object.entries(byModulo).map(([modulo, list]) => (
              <div key={modulo} className="space-y-2">
                <p className="text-sm font-semibold capitalize">{modulo}</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {list.map((p) => (
                    <label
                      key={p.clave}
                      className="flex items-center gap-2 text-sm"
                    >
                      <Checkbox
                        checked={selected.has(p.clave)}
                        onCheckedChange={(v) => toggle(p.clave, v === true)}
                      />
                      <span className="font-mono text-xs">{p.accion}</span>
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
