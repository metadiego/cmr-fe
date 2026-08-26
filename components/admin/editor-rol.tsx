"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import {
  getRoles,
  getPermisos,
  getRoleMenu,
  getRolePermisos,
  setRoleMenu,
  setRolePermisos,
  type Rol,
  type Permiso,
  type ProfileMenuItem,
} from "@/lib/api/rbac"
import { apiErrorMessage } from "@/lib/api/errors"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type MenuNode = ProfileMenuItem & { children: MenuNode[] }

function buildTree(items: ProfileMenuItem[]): MenuNode[] {
  const byClave = new Map<string, MenuNode>()
  for (const i of items) byClave.set(i.clave, { ...i, children: [] })
  const roots: MenuNode[] = []
  for (const i of items) {
    const node = byClave.get(i.clave)!
    const parent = i.parentClave ? byClave.get(i.parentClave) : undefined
    if (parent) parent.children.push(node)
    else roots.push(node)
  }
  return roots
}

// Editor de Rol unificado (beta, pestaña NUEVA — no reemplaza roles/permisos/menu
// todavía, ver docs/specs/editor-de-rol-unificado-handoff-be.md). Por rol: una fila
// por opción de menú con su Visible/Oculto + los verbos que de verdad existan para
// el módulo de ese ítem (derivado de requiresPermiso, no un checklist fijo).
export function EditorRolUnificado() {
  const t = useTranslations("admin.editorRol")
  const tRoot = useTranslations()
  const [roles, setRoles] = React.useState<Rol[] | null>(null)
  const [permisos, setPermisos] = React.useState<Permiso[]>([])
  const [roleId, setRoleId] = React.useState<string>("")
  // roleId del último menú/permisos cargados — deriva "cargando" (roleId !== tree.forRole) sin un
  // setState sincrónico extra al inicio del efecto (react-hooks/set-state-in-effect).
  const [tree, setTree] = React.useState<{ forRole: string; nodes: MenuNode[] } | null>(null)
  const [visibles, setVisibles] = React.useState<Set<string>>(new Set())
  // Precargado con TODOS los permisos actuales del rol (no solo los de esta pantalla):
  // setRolePermisos reemplaza el set completo, así que lo no tocado aquí debe seguir viajando.
  const [permisosRol, setPermisosRol] = React.useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = React.useState(false)
  const loadingRole = !!roleId && tree?.forRole !== roleId

  React.useEffect(() => {
    let active = true
    getRoles()
      .then((r) => active && setRoles(r))
      .catch((err) => active && toast.error(apiErrorMessage(err)))
    getPermisos()
      .then((p) => active && setPermisos(p))
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  React.useEffect(() => {
    // El selector no ofrece "ninguno": roleId solo pasa de "" a un id real, nunca al revés.
    if (!roleId) return
    let active = true
    Promise.all([getRoleMenu(roleId), getRolePermisos(roleId)])
      .then(([menu, permisosDelRol]) => {
        if (!active) return
        setTree({ forRole: roleId, nodes: buildTree(menu) })
        setVisibles(
          new Set(
            menu
              .filter((i) => i.tipo !== "grupo" && i.tipo !== "separador" && i.allowed)
              .map((i) => i.clave)
          )
        )
        setPermisosRol(new Set(permisosDelRol))
      })
      .catch((err) => active && toast.error(apiErrorMessage(err)))
    return () => {
      active = false
    }
  }, [roleId])

  function labelDe(n: ProfileMenuItem): string {
    if (n.labelCustom) return n.labelCustom
    return tRoot.has(n.labelKey) ? tRoot(n.labelKey) : n.clave
  }

  function toggleVisible(clave: string, on: boolean) {
    setVisibles((prev) => {
      const next = new Set(prev)
      if (on) next.add(clave)
      else next.delete(clave)
      return next
    })
  }

  function toggleVerbo(clave: string, on: boolean) {
    setPermisosRol((prev) => {
      const next = new Set(prev)
      if (on) next.add(clave)
      else next.delete(clave)
      return next
    })
  }

  async function onSubmit() {
    if (!roleId) return
    setSubmitting(true)
    try {
      await Promise.all([
        setRoleMenu(roleId, [...visibles]),
        setRolePermisos(roleId, [...permisosRol]),
      ])
      toast.success(t("saved"))
    } catch (err) {
      toast.error(apiErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  function renderNode(n: MenuNode, depth: number): React.ReactNode {
    if (n.tipo === "separador") return null
    if (n.tipo === "grupo") {
      return (
        <div key={n.clave} className="space-y-1">
          <p className="pt-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {labelDe(n)}
          </p>
          {n.children.map((c) => renderNode(c, depth + 1))}
        </div>
      )
    }
    const modulo = n.requiresPermiso?.split(".")[0]
    const verbos = modulo ? permisos.filter((p) => p.modulo === modulo) : []
    return (
      <div
        key={n.clave}
        className="flex flex-wrap items-center gap-3 border-b py-2"
        style={{ marginLeft: (depth - 1) * 16 }}
      >
        <Switch
          checked={visibles.has(n.clave)}
          onCheckedChange={(v) => toggleVisible(n.clave, v)}
          aria-label={labelDe(n)}
        />
        <span className="min-w-40 text-sm">{labelDe(n)}</span>
        {verbos.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {verbos.map((p) => (
              <label key={p.clave} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Checkbox
                  checked={permisosRol.has(p.clave)}
                  onCheckedChange={(v) => toggleVerbo(p.clave, v === true)}
                />
                <span className="font-mono">{p.accion}</span>
              </label>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-medium">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t("help")}</p>
      </div>

      <Select value={roleId} onValueChange={setRoleId}>
        <SelectTrigger className="w-64" aria-label={t("selectRole")}>
          <SelectValue placeholder={t("selectRole")} />
        </SelectTrigger>
        <SelectContent>
          {roles?.map((r) => (
            <SelectItem key={r.id} value={r.id}>
              {r.nombre}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {!roleId && <p className="text-sm text-muted-foreground">{t("empty")}</p>}
      {roleId && loadingRole && <p className="text-sm text-muted-foreground">{t("loading")}</p>}

      {roleId && tree && !loadingRole && (
        <>
          <div className="rounded-md border px-3">
            {tree.nodes.map((n) => renderNode(n, 1))}
          </div>
          <Button onClick={onSubmit} disabled={submitting}>
            {submitting ? t("saving") : t("save")}
          </Button>
        </>
      )}
    </section>
  )
}
