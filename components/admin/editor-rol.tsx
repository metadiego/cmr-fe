"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import {
  getRoles,
  getPermisos,
  getRoleMenu,
  getRolePermisos,
  setRolePermisos,
  type Rol,
  type Permiso,
  type ProfileMenuItem,
} from "@/lib/api/rbac"
import { apiErrorMessage } from "@/lib/api/errors"
import { isAdminRole } from "@/lib/access/role-keys"
import { Button } from "@/components/ui/button"
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
  for (const i of items) byClave.set(i.slug, { ...i, children: [] })
  const roots: MenuNode[] = []
  for (const i of items) {
    const node = byClave.get(i.slug)!
    const parent = i.parentSlug ? byClave.get(i.parentSlug) : undefined
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
  // Precargado con TODOS los permisos actuales del rol (no solo los de esta pantalla):
  // setRolePermisos reemplaza el set completo, así que lo no tocado aquí debe seguir viajando.
  const [permisosRol, setPermisosRol] = React.useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = React.useState(false)
  // Por-id (no un booleano): si falla, distingue "cargando" de "el rol X falló" en un reintento
  // (la carga se reintenta por botón, no automáticamente, así que un cambio de rol no la limpia
  // salvo que la nueva carga arranque).
  const [loadError, setLoadError] = React.useState<{ forRole: string; message: string } | null>(null)
  const loadingRole = !!roleId && tree?.forRole !== roleId && loadError?.forRole !== roleId
  // The admin role holds full access and cannot be edited (the backend answers 400 rbac.adminRoleFixed).
  const fixed = isAdminRole(roles?.find((r) => r.id === roleId))

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

  const loadRole = React.useCallback((id: string) => {
    let active = true
    Promise.all([getRoleMenu(id), getRolePermisos(id)])
      .then(([menu, permisosDelRol]) => {
        if (!active) return
        setLoadError(null)
        // The menu tree only lays out the permissions: since cmr-be #557 what a person sees in the menu
        // follows from their permissions, so there is no separate "visible" switch to save.
        setTree({ forRole: id, nodes: buildTree(menu) })
        setPermisosRol(new Set(permisosDelRol))
      })
      .catch((err) => {
        if (!active) return
        setLoadError({ forRole: id, message: apiErrorMessage(err) })
      })
    return () => {
      active = false
    }
  }, [])

  React.useEffect(() => {
    // El selector no ofrece "ninguno": roleId solo pasa de "" a un id real, nunca al revés.
    if (!roleId) return
    return loadRole(roleId)
  }, [roleId, loadRole])

  function labelDe(n: ProfileMenuItem): string {
    if (n.customLabel) return n.customLabel
    return tRoot.has(n.labelKey) ? tRoot(n.labelKey) : n.slug
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
      await setRolePermisos(roleId, [...permisosRol])
      toast.success(t("saved"))
    } catch (err) {
      toast.error(apiErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  function renderNode(n: MenuNode, depth: number): React.ReactNode {
    if (n.type === "separador") return null
    if (n.type === "grupo") {
      return (
        <div key={n.slug} className="space-y-1">
          <p className="pt-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {labelDe(n)}
          </p>
          {n.children.map((c) => renderNode(c, depth + 1))}
        </div>
      )
    }
    const modulo = n.requiresPermiso?.split(".")[0]
    const verbos = modulo ? permisos.filter((p) => p.module === modulo) : []
    // parentClave es texto libre (menu-admin.tsx): un ítem real puede terminar anidado bajo OTRO
    // ítem, no solo bajo un grupo. Si no se recorren sus children acá, quedan invisibles y sin
    // forma de editarlos en esta pantalla.
    return (
      <div key={n.slug}>
        <div
          className="flex flex-wrap items-center gap-3 border-b py-2"
          style={{ marginLeft: (depth - 1) * 16 }}
        >
          <span className="min-w-40 text-sm">{labelDe(n)}</span>
          {verbos.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {verbos.map((p) => (
                <label key={p.slug} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Checkbox
                    checked={permisosRol.has(p.slug)}
                    onCheckedChange={(v) => toggleVerbo(p.slug, v === true)}
                  />
                  <span className="font-mono">{p.action}</span>
                </label>
              ))}
            </div>
          )}
        </div>
        {n.children.map((c) => renderNode(c, depth + 1))}
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
              {r.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {!roleId && <p className="text-sm text-muted-foreground">{t("empty")}</p>}
      {roleId && loadingRole && <p className="text-sm text-muted-foreground">{t("loading")}</p>}
      {roleId && loadError?.forRole === roleId && (
        <div className="flex items-center gap-3">
          <p className="text-sm text-destructive">{loadError.message}</p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setLoadError(null)
              loadRole(roleId)
            }}
          >
            {t("retry")}
          </Button>
        </div>
      )}

      {roleId && tree && !loadingRole && !loadError && (
        <>
          <div className="rounded-md bg-card px-3 shadow-sm shadow-[rgba(16,32,64,0.06)] ring-1 ring-foreground/10">
            {tree.nodes.map((n) => renderNode(n, 1))}
          </div>
          {fixed && <p className="text-sm text-muted-foreground">{tRoot("admin.rbac.adminRoleFixed")}</p>}
          <Button onClick={onSubmit} disabled={submitting || fixed}>
            {submitting ? t("saving") : t("save")}
          </Button>
        </>
      )}
    </section>
  )
}
