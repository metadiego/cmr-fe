"use client"

import * as React from "react"

import type { BookingKind } from "@/lib/agenda/booking/url-state"
import { getTiposCita, type TipoCita } from "@/lib/api/citas"
import { getServicios, type Servicio } from "@/lib/api/servicios"
import { useResource } from "@/hooks/use-resource"

// What the booking screen can book: the active medical appointment types (global) and the active
// services of the screen's center, in their configured order. One load shared by the type picker and
// the toolbar chip, so a chosen type can be named and coloured without a second request.

export interface BookingType {
  kind: BookingKind
  id: string
  name: string
  color: string | null
  slug: string
}

export interface BookingTypes {
  medical: BookingType[]
  services: BookingType[]
  loading: boolean
  error: string | null
  find: (kind: BookingKind | undefined, id: string | undefined) => BookingType | undefined
  reload: () => void
}

const fromTipo = (x: TipoCita): BookingType => ({
  kind: "medical",
  id: x.id,
  name: x.name,
  color: x.color,
  slug: x.slug,
})

const fromServicio = (x: Servicio): BookingType => ({
  kind: "service",
  id: x.id,
  name: x.name,
  color: x.color,
  slug: x.slug,
})

export function useBookingTypes(center: string | undefined): BookingTypes {
  const tiposRes = useResource<TipoCita[]>(() => getTiposCita())
  const serviciosRes = useResource<Servicio[]>(
    () => (center ? getServicios(center) : Promise.resolve([])),
    [center]
  )

  const medical = React.useMemo(
    () =>
      tiposRes.state.kind === "ok"
        ? tiposRes.state.data.filter((x) => x.active !== false).map(fromTipo)
        : [],
    [tiposRes.state]
  )
  const services = React.useMemo(
    () =>
      serviciosRes.state.kind === "ok"
        ? serviciosRes.state.data
            .filter((x) => x.active !== false)
            .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
            .map(fromServicio)
        : [],
    [serviciosRes.state]
  )

  const find = React.useCallback(
    (kind: BookingKind | undefined, id: string | undefined) => {
      if (!kind || !id) return undefined
      return (kind === "medical" ? medical : services).find((x) => x.id === id)
    },
    [medical, services]
  )

  const failed =
    tiposRes.state.kind === "fail"
      ? tiposRes.state
      : serviciosRes.state.kind === "fail"
        ? serviciosRes.state
        : null
  const reloadTipos = tiposRes.reload
  const reloadServicios = serviciosRes.reload
  const reload = React.useCallback(() => {
    reloadTipos()
    reloadServicios()
  }, [reloadTipos, reloadServicios])

  return {
    medical,
    services,
    loading: tiposRes.state.kind === "loading" || serviciosRes.state.kind === "loading",
    error: failed ? failed.message : null,
    find,
    reload,
  }
}
