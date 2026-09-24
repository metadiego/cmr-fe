"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { Search01Icon } from "@hugeicons/core-free-icons"

import {
  getRolesConPermisos,
  getPermisos,
  setRolePermisos,
  type Permiso,
  type RolConPermisos,
} from "@/lib/api/rbac"
import { apiErrorMessage } from "@/lib/api/errors"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"

// Rejilla de un vistazo: TODOS los roles a la vez en tarjetas, cada permiso agrupado por módulo y
// plegable, marcando en la propia tarjeta, con un buscador que filtra las tarjetas a la vez. Trae los
// roles con sus permisos en UNA llamada (getRolesConPermisos). Handoff roles-la-rejilla-de-un-vistazo.
export function RbacGrid() {
  const t = useTranslations("admin.rbac")
  const [roles, setRoles] = React.useState<RolConPermisos[] | null>(null)
  const [permisos, setPermisos] = React.useState<Permiso[]>([])
  const [error, setError] = React.useState<string | null>(null)
  const [q, setQ] = React.useState("")

  React.useEffect(() => {
    let active = true
    getRolesConPermisos()
      .then((r) => active && setRoles(r))
      .catch((err) => active && setError(apiErrorMessage(err)))
    getPermisos()
      .then((p) => active && setPermisos(p))
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  // Permisos agrupados por módulo (una vez), para pintarlos igual en cada tarjeta.
  const byModulo = React.useMemo(() => {
    const acc: Record<string, Permiso[]> = {}
    for (const p of permisos) (acc[p.module] ??= []).push(p)
    return acc
  }, [permisos])

  const needle = q.trim().toLowerCase()
  const matches = (p: Permiso) =>
    !needle ||
    p.slug.toLowerCase().includes(needle) ||
    p.action.toLowerCase().includes(needle) ||
    p.module.toLowerCase().includes(needle) ||
    (p.description ?? "").toLowerCase().includes(needle)

  if (error) {
    return (
      <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
        {error}
      </p>
    )
  }
  if (!roles) return <p className="text-sm text-muted-foreground">{t("loading")}</p>

  return (
    <div className="space-y-4">
      {/* Buscador de permisos: filtra TODAS las tarjetas a la vez (clave de usabilidad con ~200 permisos). */}
      <div className="relative max-w-sm">
        <HugeiconsIcon icon={Search01Icon} className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchPermisos")} className="h-9 pl-8" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {roles.map((r) => (
          <RoleCard key={r.id} role={r} byModulo={byModulo} matches={matches} searching={!!needle} />
        ))}
      </div>
    </div>
  )
}

function RoleCard({
  role,
  byModulo,
  matches,
  searching,
}: {
  role: RolConPermisos
  byModulo: Record<string, Permiso[]>
  matches: (p: Permiso) => boolean
  searching: boolean
}) {
  const t = useTranslations("admin.rbac")
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set(role.permissions))
  const [saving, setSaving] = React.useState(false)
  // Estado inicial para detectar cambios (dirty): guardar solo cuando hay algo distinto.
  const inicial = React.useMemo(() => [...role.permissions].sort().join(","), [role.permissions])
  const sucio = [...selected].sort().join(",") !== inicial

  function toggle(clave: string, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (on) next.add(clave)
      else next.delete(clave)
      return next
    })
  }

  async function guardar() {
    setSaving(true)
    try {
      await setRolePermisos(role.id, [...selected])
      toast.success(t("permisosSaved"))
    } catch (err) {
      toast.error(apiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  // Módulos con al menos un permiso que pasa el filtro; al buscar, se abren solos.
  const modulos = Object.entries(byModulo)
    .map(([modulo, list]) => [modulo, list.filter(matches)] as const)
    .filter(([, list]) => list.length > 0)

  return (
    <section className="flex flex-col rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
      <header className="flex items-center gap-2 border-b px-4 py-3">
        <span className="font-medium">{role.name}</span>
        <Badge variant={role.isSystem ? "secondary" : "outline"}>
          {role.isSystem ? t("system") : t("custom")}
        </Badge>
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          {t("nSeleccionados", { n: selected.size })}
        </span>
        <Button size="sm" onClick={guardar} disabled={!sucio || saving}>
          {saving ? t("saving") : t("save")}
        </Button>
      </header>

      <div className="max-h-[26rem] space-y-2 overflow-y-auto p-3">
        {modulos.length === 0 ? (
          <p className="px-1 py-4 text-center text-sm text-muted-foreground">{t("sinResultados")}</p>
        ) : (
          modulos.map(([modulo, list]) => (
            <details key={modulo} open={searching || undefined} className="rounded-md bg-muted/30">
              <summary className="cursor-pointer px-3 py-1.5 text-sm font-semibold capitalize">
                {modulo}{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  ({list.filter((p) => selected.has(p.slug)).length}/{list.length})
                </span>
              </summary>
              <div className="grid grid-cols-1 gap-1.5 px-3 pb-2 pt-1 sm:grid-cols-2">
                {list.map((p) => (
                  <label key={p.slug} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={selected.has(p.slug)} onCheckedChange={(v) => toggle(p.slug, v === true)} />
                    <span className="font-mono text-xs">{p.action}</span>
                  </label>
                ))}
              </div>
            </details>
          ))
        )}
      </div>
    </section>
  )
}
