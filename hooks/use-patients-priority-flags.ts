"use client"

import * as React from "react"

import {
  getPatientPriorityFlags,
  type PatientPriorityFlag,
} from "@/lib/api/pacientes"

export interface PatientsPriorityFlags {
  byPatient: Map<string, PatientPriorityFlag[]>
  reload: (patientId: string) => void
}

// The priority flags of every patient in a list, so they can be seen without opening each one.
// One call per patient: the API has no bulk read yet (asked in
// docs/specs/priority-flags-bulk-handoff-be.md) — when it lands, only this hook changes.
// A failed read leaves that patient without flags rather than breaking the list.
export function usePatientsPriorityFlags(
  patientIds: string[],
  centerId: string | undefined
): PatientsPriorityFlags {
  const [byPatient, setByPatient] = React.useState<
    Map<string, PatientPriorityFlag[]>
  >(new Map())
  const key = [...new Set(patientIds)].sort().join(",")

  const load = React.useCallback(
    (ids: string[], isCurrent: () => boolean) => {
      Promise.all(
        ids.map((id) =>
          getPatientPriorityFlags(id, centerId).then(
            (f) => [id, f] as const,
            () => [id, [] as PatientPriorityFlag[]] as const
          )
        )
      ).then((pairs) => {
        if (!isCurrent()) return
        setByPatient((prev) => {
          const next = new Map(prev)
          for (const [id, flags] of pairs) next.set(id, flags)
          return next
        })
      })
    },
    [centerId]
  )

  React.useEffect(() => {
    let current = true
    const ids = key ? key.split(",") : []
    if (ids.length) load(ids, () => current)
    return () => {
      current = false
    }
  }, [key, load])

  const reload = React.useCallback(
    (patientId: string) => load([patientId], () => true),
    [load]
  )
  return { byPatient, reload }
}
