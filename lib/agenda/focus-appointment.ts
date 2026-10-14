// After saving an appointment, the day view shows ONLY that one (owner, 13-oct-2026: «debería agregarla y
// filtrarla sola a ella»), with a button to clear it. Pure, so it is tested: it narrows each center's slots
// to the appointment with that id and drops the empty slots/types; holidays, notes and summary stay.

interface Row {
  id?: unknown
}
interface Type<R extends Row> {
  appointments: R[]
}
interface Slot<R extends Row, T extends Type<R>> {
  tipos: T[]
}
interface Center<R extends Row, T extends Type<R>, S extends Slot<R, T>> {
  slots?: S[]
  franjas?: S[]
}

export function focusAppointment<
  R extends Row,
  T extends Type<R>,
  S extends Slot<R, T>,
  C extends Center<R, T, S>,
>(center: C, id: string | null): C {
  if (!id) return center
  const narrow = (slots: S[] | undefined) =>
    slots
      ?.map((s) => ({
        ...s,
        tipos: s.tipos
          .map((t) => ({
            ...t,
            appointments: t.appointments.filter((a) => String(a.id) === id),
          }))
          .filter((t) => t.appointments.length > 0),
      }))
      .filter((s) => s.tipos.length > 0)
  return {
    ...center,
    slots: narrow(center.slots),
    franjas: narrow(center.franjas),
  }
}

// Whether the appointment is in the center's day at all (a focus on one that is not there would show an
// empty day that looks like a failure).
export function hasAppointment<
  R extends Row,
  T extends Type<R>,
  S extends Slot<R, T>,
>(center: Center<R, T, S>, id: string): boolean {
  return (center.slots ?? center.franjas ?? []).some((s) =>
    s.tipos.some((t) => t.appointments.some((a) => String(a.id) === id))
  )
}
