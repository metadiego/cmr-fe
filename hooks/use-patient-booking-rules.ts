"use client"

import * as React from "react"

import type { VisitKind } from "@/lib/agenda/booking/type-list"
import { getVisitKind } from "@/lib/api/citas"
import { getBookableServices, type BookableService } from "@/lib/api/frontdesk"
import { useResource } from "@/hooks/use-resource"

// What a chosen patient may be booked for (spec 2026-11-23-appointments-booking-upgrades §4): whether
// they were attended before (first visit vs follow-up) and, per service of the booking center, how many
// sessions they can still book (packages from any of `centerIds` count). One load per patient + center,
// owned by the booking screen and shared by the type list and the service booking form.

export type BookableState = "idle" | "loading" | "ok" | "fail"

export interface PatientBookingRules {
  /** undefined while loading, on failure or without a patient: then every medical type shows. */
  visitKind: VisitKind | undefined
  /** service id → its balance; undefined until known (never a fallback to every service). */
  bookable: Map<string, BookableService> | undefined
  bookableState: BookableState
  reloadBookable: () => void
}

export function usePatientBookingRules(
  patientId: string | undefined,
  bookingCenter: string | undefined,
  centerIds: string[],
): PatientBookingRules {
  const active = !!patientId && !!bookingCenter
  const centersKey = [...centerIds].sort().join(",")

  const visitRes = useResource<VisitKind | null>(
    () =>
      patientId && bookingCenter
        ? getVisitKind(patientId, bookingCenter).then((r) => ({ attendedBefore: r.attendedBefore }))
        : Promise.resolve(null),
    [patientId, bookingCenter],
  )
  const bookableRes = useResource<BookableService[] | null>(
    () =>
      patientId && bookingCenter
        ? getBookableServices(patientId, bookingCenter, centersKey ? centersKey.split(",") : [])
        : Promise.resolve(null),
    [patientId, bookingCenter, centersKey],
  )

  const visitKind = visitRes.state.kind === "ok" ? (visitRes.state.data ?? undefined) : undefined
  const bookable = React.useMemo(() => {
    if (bookableRes.state.kind !== "ok" || !bookableRes.state.data) return undefined
    return new Map(bookableRes.state.data.map((s) => [s.serviceId, s]))
  }, [bookableRes.state])
  const bookableState: BookableState = !active ? "idle" : bookableRes.state.kind

  return { visitKind, bookable, bookableState, reloadBookable: bookableRes.reload }
}
