"use client"

import * as React from "react"

import type { BookingKind } from "@/lib/agenda/booking/url-state"
import { getTiposCita, type TipoCita } from "@/lib/api/citas"
import { getServicios, type Servicio } from "@/lib/api/servicios"
import { useCan } from "@/hooks/use-can"
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
  /** Medical types only: their configured length. */
  durationMinutes: number | null
  /** Medical types only: booked with a doctor. */
  requiresDoctor: boolean
}

export interface BookingTypes {
  medical: BookingType[]
  services: BookingType[]
  /** The raw active medical types, as CitaModal takes them. */
  appointmentTypes: TipoCita[]
  loading: boolean
  error: string | null
  /** The user lacks `servicios.read` (GET /services would 403): services are not listed, medical are. */
  servicesHidden: boolean
  find: (kind: BookingKind | undefined, id: string | undefined) => BookingType | undefined
  reload: () => void
}

const fromTipo = (x: TipoCita): BookingType => ({
  kind: "medical",
  id: x.id,
  name: x.name,
  color: x.color,
  slug: x.slug,
  durationMinutes: x.durationMinutes > 0 ? x.durationMinutes : null,
  requiresDoctor: x.requiresDoctor,
})

const fromServicio = (x: Servicio): BookingType => ({
  kind: "service",
  id: x.id,
  name: x.name,
  color: x.color,
  slug: x.slug,
  durationMinutes: null,
  requiresDoctor: false,
})

export function useBookingTypes(center: string | undefined): BookingTypes {
  const { can, ready: permsReady } = useCan()
  const canServices = permsReady && can("servicios.read")
  const tiposRes = useResource<TipoCita[]>(() => getTiposCita())
  // GET /services needs `servicios.read`: without it the services are not asked for (a 403 would fail
  // the whole list); the medical types still show, with a note in the services group.
  const serviciosRes = useResource<Servicio[]>(
    () => (center && canServices ? getServicios(center) : Promise.resolve([])),
    [center, canServices]
  )

  const appointmentTypes = React.useMemo(
    () =>
      tiposRes.state.kind === "ok"
        ? tiposRes.state.data.filter((x) => x.active !== false)
        : [],
    [tiposRes.state]
  )
  const medical = React.useMemo(() => appointmentTypes.map(fromTipo), [appointmentTypes])
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
    appointmentTypes,
    loading:
      !permsReady ||
      tiposRes.state.kind === "loading" ||
      serviciosRes.state.kind === "loading",
    error: failed ? failed.message : null,
    servicesHidden: permsReady && !canServices,
    find,
    reload,
  }
}
