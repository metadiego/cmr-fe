"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import type { Perfil } from "@/lib/api/profiles"
import {
  getRoles,
  getProfileAccess,
  getProfileMenu,
  assignRoleToProfile,
  removeRoleFromProfile,
  setProfileOverride,
  removeProfileOverride,
  setPermisoCentros,
  type Rol,
  type ProfileAccess,
  type AccessPermiso,
  type CentroRef,
} from "@/lib/api/rbac"
import { getCenters, type Centro } from "@/lib/api/centers"
import { AccessPorCentroTab } from "@/components/admin/access-por-centro-tab"
import { toastError } from "@/lib/api/errors"
import { cn } from "@/lib/utils"
import { useResource } from "@/hooks/use-resource"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const GLOBAL = "__global__"

// "Accesos del usuario": per-profile roles + permission exceptions + menu
// preview, scoped to a center or global. Opened from the users list.
export function AccessDialog({
  profile,
  onOpenChange,
}: {
  profile: Perfil | null
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations("admin.access")

  return (
    <Sheet open={profile !== null} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{t("title")}</SheetTitle>
          <SheetDescription>{profile?.email}</SheetDescription>
        </SheetHeader>
        {profile && (
          <div className="px-4 pb-6">
            <AccessPanel key={profile.id} profile={profile} />
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

// Ámbito inicial: si TODOS los roles del perfil apuntan al mismo centro no-nulo (ningún rol
// global), nace ahí en vez de en Global — así el admin ve los roles ya marcados sin tener que
// cambiar el selector a mano (FE-HANDOFF-AMBITO-DEFAULT-ACCESOS).
function defaultCentroDe(profile: Perfil): string {
  const roles = profile.roles ?? []
  const tieneRolGlobal = roles.some((r) => r.centroId === null)
  const centrosDeRoles = new Set(
    roles.map((r) => r.centroId).filter((c): c is string => c !== null)
  )
  return !tieneRolGlobal && centrosDeRoles.size === 1 ? [...centrosDeRoles][0] : GLOBAL
}

function AccessPanel({ profile }: { profile: Perfil }) {
  const t = useTranslations("admin.access")
  const [centro, setCentro] = React.useState<string>(() => defaultCentroDe(profile))
  const centroId = centro === GLOBAL ? undefined : centro

  const centers = useResource<Centro[]>(() => getCenters())
  const access = useResource<ProfileAccess>(
    () => getProfileAccess(profile.id, centroId),
    [profile.id, centro]
  )
  const roles = useResource<Rol[]>(() => getRoles())

  return (
    <div className="mt-4 space-y-4">
      <div className="space-y-1.5">
        <span className="text-sm text-muted-foreground">{t("scope")}</span>
        <Select value={centro} onValueChange={setCentro}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={GLOBAL}>{t("global")}</SelectItem>
            {centers.state.kind === "ok" &&
              centers.state.data.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nombre}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="roles">
        <TabsList>
          <TabsTrigger value="roles">{t("tabs.roles")}</TabsTrigger>
          <TabsTrigger value="porCentro">{t("tabs.porCentro")}</TabsTrigger>
          <TabsTrigger value="exceptions">{t("tabs.exceptions")}</TabsTrigger>
          <TabsTrigger value="menu">{t("tabs.menu")}</TabsTrigger>
        </TabsList>

        {/* Un rol distinto por centro (perfil+rol+centro): tabla por centro + roles globales. Handoff
            roles-por-centro-en-la-ui. No depende del selector de ámbito de arriba: gestiona todos los centros. */}
        <TabsContent value="porCentro" className="mt-4">
          <AccessPorCentroTab profile={profile} />
        </TabsContent>

        <TabsContent value="roles" className="mt-4">
          <RolesTab
            profile={profile}
            centroId={centroId}
            roles={roles.state}
            access={access.state}
            onChanged={access.reload}
          />
        </TabsContent>

        <TabsContent value="exceptions" className="mt-4">
          <ExceptionsTab
            profile={profile}
            centroId={centroId}
            access={access.state}
            onChanged={access.reload}
          />
        </TabsContent>

        <TabsContent value="menu" className="mt-4">
          <MenuPreviewTab
            profile={profile}
            centroId={centroId}
            centro={centro}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function RolesTab({
  profile,
  centroId,
  roles,
  access,
  onChanged,
}: {
  profile: Perfil
  centroId?: string
  roles: ReturnType<typeof useResource<Rol[]>>["state"]
  access: ReturnType<typeof useResource<ProfileAccess>>["state"]
  onChanged: () => void
}) {
  const t = useTranslations("admin.access")
  const [busy, setBusy] = React.useState<string | null>(null)

  if (roles.kind === "loading" || access.kind === "loading") return <Loading />
  if (roles.kind === "fail") return <Fail message={roles.message} />
  if (access.kind === "fail") return <Fail message={access.message} />

  const assigned = new Map(access.data.roles.map((r) => [r.clave, r]))

  async function toggle(role: Rol, on: boolean) {
    setBusy(role.clave)
    try {
      if (on) {
        // El rol se asigna GLOBAL (sin centroId): el centro vive en las asignaciones de centro del perfil,
        // y un rol multi-centro rechaza centroId. Handoff rol-multicentro-y-preparacion-legado.
        await assignRoleToProfile(profile.id, role.clave)
      } else {
        const a = assigned.get(role.clave)
        if (a) await removeRoleFromProfile(profile.id, a.rolId, centroId)
      }
      toast.success(t("saved"))
      onChanged()
    } catch (err) {
      toastError(err)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-2">
      {roles.data.map((role) => (
        <label
          key={role.id}
          className="flex items-center gap-3 rounded-md bg-card px-3 py-2 text-sm shadow-sm shadow-[rgba(16,32,64,0.06)] ring-1 ring-foreground/10"
        >
          <Checkbox
            checked={assigned.has(role.clave)}
            disabled={busy === role.clave}
            onCheckedChange={(v) => toggle(role, v === true)}
          />
          <span className="font-medium">{role.nombre}</span>
          <span className="font-mono text-xs text-muted-foreground">
            {role.clave}
          </span>
        </label>
      ))}
    </div>
  )
}

type TriState = "inherit" | "grant" | "deny"

function ExceptionsTab({
  profile,
  centroId,
  access,
  onChanged,
}: {
  profile: Perfil
  centroId?: string
  access: ReturnType<typeof useResource<ProfileAccess>>["state"]
  onChanged: () => void
}) {
  const t = useTranslations("admin.access")
  const [busy, setBusy] = React.useState<string | null>(null)
  // Repintado local de la columna «Centros» tras el PUT (la respuesta trae la fila recalculada), para no
  // recargar toda la ficha. Clave del permiso → sus centros concedidos.
  const [centrosPorClave, setCentrosPorClave] = React.useState<Record<string, CentroRef[]>>({})
  const [busyCentros, setBusyCentros] = React.useState<string | null>(null)

  if (access.kind === "loading") return <Loading />
  if (access.kind === "fail") return <Fail message={access.message} />

  const byModulo: Record<string, AccessPermiso[]> = {}
  for (const p of access.data.permisos) (byModulo[p.modulo] ??= []).push(p)
  const overrideByClave = new Map(
    access.data.overrides.map((o) => [o.permisoClave, o])
  )
  const disponibles = access.data.centrosDisponibles

  async function change(p: AccessPermiso, next: TriState) {
    setBusy(p.clave)
    try {
      if (next === "inherit") {
        const o = overrideByClave.get(p.clave)
        if (o) await removeProfileOverride(profile.id, o.permisoId, centroId)
      } else {
        await setProfileOverride(profile.id, p.clave, next, centroId)
      }
      toast.success(t("saved"))
      onChanged()
    } catch (err) {
      toastError(err)
    } finally {
      setBusy(null)
    }
  }

  // Centros concedidos vigentes de la fila (el repintado local pisa lo que trajo el fetch).
  const centrosDe = (p: AccessPermiso): CentroRef[] => centrosPorClave[p.clave] ?? p.centrosConcedidos

  async function toggleCentro(p: AccessPermiso, cid: string) {
    const actuales = centrosDe(p).map((c) => c.id)
    const next = actuales.includes(cid) ? actuales.filter((x) => x !== cid) : [...actuales, cid]
    setBusyCentros(p.clave)
    try {
      const fila = await setPermisoCentros(profile.id, p.clave, next)
      // Deja la fila EXACTAMENTE en la lista devuelta; repinta solo esta fila.
      setCentrosPorClave((m) => ({ ...m, [p.clave]: fila.centrosConcedidos }))
      toast.success(t("saved"))
    } catch (err) {
      toastError(err)
    } finally {
      setBusyCentros(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Los centros de la fila son excepciones POR USUARIO; si a muchos les hace falta lo mismo, es un rol. */}
      <p className="text-xs text-muted-foreground">{t("centrosHelp")}</p>
      {Object.entries(byModulo).map(([modulo, list]) => (
        <div key={modulo} className="space-y-2">
          <p className="text-sm font-semibold capitalize">{modulo}</p>
          {list.map((p) => {
            const value: TriState = p.override ?? "inherit"
            const concedidos = new Set(centrosDe(p).map((c) => c.id))
            return (
              <div key={p.clave} className="space-y-2 rounded-md bg-card px-3 py-2 shadow-sm shadow-[rgba(16,32,64,0.06)] ring-1 ring-foreground/10">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs">{p.accion}</span>
                      {p.override && (
                        <Badge variant="outline">{t("exception")}</Badge>
                      )}
                      {p.effective && (
                        <Badge variant="secondary">{t("effective")}</Badge>
                      )}
                    </div>
                    {p.descripcion && (
                      <p className="truncate text-xs text-muted-foreground">
                        {p.descripcion}
                      </p>
                    )}
                  </div>
                  <Select
                    value={value}
                    disabled={busy === p.clave}
                    onValueChange={(v) => change(p, v as TriState)}
                  >
                    <SelectTrigger className="w-36 shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inherit">{t("inherit")}</SelectItem>
                      <SelectItem value="grant">{t("grant")}</SelectItem>
                      <SelectItem value="deny">{t("deny")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Columna «Centros»: permiso suelto en centros ajenos. Vacío = sin excepciones (donde le
                    toque por su rol y sus centros), NO «ninguno». Chips por centro; clic hace el PUT. */}
                {disponibles.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 border-t pt-2">
                    <span className="mr-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t("centros")}</span>
                    {concedidos.size === 0 && (
                      <span className="text-xs italic text-muted-foreground">{t("sinExcepciones")}</span>
                    )}
                    {disponibles.map((c) => {
                      const on = concedidos.has(c.id)
                      return (
                        <button
                          key={c.id}
                          type="button"
                          disabled={busyCentros === p.clave}
                          onClick={() => toggleCentro(p, c.id)}
                          className={cn(
                            "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors disabled:opacity-50",
                            on
                              ? "border-primary/40 bg-primary/15 text-primary"
                              : "border-border text-muted-foreground hover:bg-accent"
                          )}
                        >
                          {c.nombre}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

/**
 * Menú del usuario, EDITABLE (R4): dar o quitar una opción del menú a este
 * usuario sin cambiarle el rol. El toggle escribe un override (grant/deny) del
 * `permisoClave` del ítem — mismo motor que la pestaña Excepciones.
 */
function MenuPreviewTab({
  profile,
  centroId,
  centro,
}: {
  profile: Perfil
  centroId?: string
  centro: string
}) {
  const t = useTranslations("admin.access")
  const tRoot = useTranslations()
  const { state, refresh } = useResource(
    () => getProfileMenu(profile.id, centroId),
    [profile.id, centro]
  )
  const { state: accessState, refresh: refreshAccess } = useResource(
    () => getProfileAccess(profile.id, centroId),
    [profile.id, centro]
  )
  const [busy, setBusy] = React.useState<string | null>(null)

  // Overrides vigentes por clave de permiso (para saber si el toggle es excepción).
  const overridePorClave = React.useMemo(() => {
    const map = new Map<string, { permisoId: string; efecto: string }>()
    if (accessState.kind === "ok") {
      for (const o of accessState.data.overrides) {
        map.set(o.permisoClave, { permisoId: o.permisoId, efecto: o.efecto })
      }
    }
    return map
  }, [accessState])

  // ¿El ROL ya concede el permiso? Decide si el estado deseado se logra
  // heredando (quitar la excepción) o hace falta una excepción.
  const viaRolePorClave = React.useMemo(() => {
    const map = new Map<string, boolean>()
    if (accessState.kind === "ok") {
      for (const p of accessState.data.permisos) map.set(p.clave, p.viaRole)
    }
    return map
  }, [accessState])

  async function toggle(permisoClave: string, dar: boolean) {
    setBusy(permisoClave)
    try {
      const actual = overridePorClave.get(permisoClave)
      const viaRole = viaRolePorClave.get(permisoClave) ?? false
      if (viaRole === dar) {
        // El rol ya da el resultado deseado → basta con heredar (sin excepción).
        if (actual) {
          await removeProfileOverride(profile.id, actual.permisoId, centroId)
        }
      } else {
        // El rol dice lo contrario → hace falta la excepción explícita.
        await setProfileOverride(
          profile.id,
          permisoClave,
          dar ? "grant" : "deny",
          centroId
        )
      }
      refresh()
      refreshAccess()
    } catch (err) {
      toastError(err, tRoot)
    } finally {
      setBusy(null)
    }
  }

  if (state.kind === "loading") return <Loading />
  if (state.kind === "fail") return <Fail message={state.message} />
  if (state.data.length === 0)
    return <p className="text-sm text-muted-foreground">{t("menuEmpty")}</p>

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">{t("menuEditableHelp")}</p>
      <ul className="space-y-1">
        {state.data.map((item) => {
          const permiso = item.requiresPermiso
          const esExcepcion = permiso ? overridePorClave.has(permiso) : false
          return (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-md bg-card px-3 py-2 text-sm shadow-sm shadow-[rgba(16,32,64,0.06)] ring-1 ring-foreground/10"
              style={{ marginLeft: item.parentClave ? 16 : 0 }}
            >
              <span
                className={
                  item.allowed ? "" : "text-muted-foreground line-through"
                }
              >
                {safe(tRoot, item.labelKey)}
              </span>
              <div className="flex shrink-0 items-center gap-2">
                {esExcepcion && (
                  <Badge variant="outline">{t("excepcion")}</Badge>
                )}
                {permiso ? (
                  <Switch
                    checked={item.allowed}
                    disabled={busy === permiso}
                    onCheckedChange={(v) => toggle(permiso, v)}
                    aria-label={safe(tRoot, item.labelKey)}
                  />
                ) : (
                  <Badge variant="secondary">{t("sinPermiso")}</Badge>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// Translate a full key, falling back to the key itself on a miss.
function safe(t: (k: string) => string, key: string): string {
  try {
    const v = t(key)
    return v || key
  } catch {
    return key
  }
}

function Loading() {
  const t = useTranslations("common")
  return <p className="text-sm text-muted-foreground">{t("loading")}</p>
}

function Fail({ message }: { message: string }) {
  return (
    <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {message}
    </p>
  )
}
