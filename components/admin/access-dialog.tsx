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
  type Rol,
  type ProfileAccess,
  type AccessPermiso,
} from "@/lib/api/rbac"
import { getCenters, type Centro } from "@/lib/api/centers"
import { toastError } from "@/lib/api/errors"
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

function AccessPanel({ profile }: { profile: Perfil }) {
  const t = useTranslations("admin.access")
  const [centro, setCentro] = React.useState<string>(GLOBAL)
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
          <TabsTrigger value="exceptions">{t("tabs.exceptions")}</TabsTrigger>
          <TabsTrigger value="menu">{t("tabs.menu")}</TabsTrigger>
        </TabsList>

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
        await assignRoleToProfile(profile.id, role.clave, centroId)
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
          className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm"
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

  if (access.kind === "loading") return <Loading />
  if (access.kind === "fail") return <Fail message={access.message} />

  const byModulo: Record<string, AccessPermiso[]> = {}
  for (const p of access.data.permisos) (byModulo[p.modulo] ??= []).push(p)
  const overrideByClave = new Map(
    access.data.overrides.map((o) => [o.permisoClave, o])
  )

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

  return (
    <div className="space-y-4">
      {Object.entries(byModulo).map(([modulo, list]) => (
        <div key={modulo} className="space-y-2">
          <p className="text-sm font-semibold capitalize">{modulo}</p>
          {list.map((p) => {
            const value: TriState = p.override ?? "inherit"
            return (
              <div
                key={p.clave}
                className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
              >
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
              className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
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
