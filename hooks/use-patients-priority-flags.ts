"use client"

import * as React from "react"

import {
  getPatientsPriorityFlags,
  type PatientPriorityFlag,
} from "@/lib/api/pacientes"

export interface PatientsPriorityFlags {
  byPatient: Map<string, PatientPriorityFlag[]>
  reload: (patientId: string) => void
}

// The priority flags of every patient in a list, so they can be seen without opening each one.
// One bulk read for the whole list (docs/specs/priority-flags-bulk-handoff-be.md); a change reloads
// just that patient. A failed read leaves the flags as they were rather than breaking the list.
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
      getPatientsPriorityFlags(ids, centerId).then(
        (rows) => {
          if (!isCurrent()) return
          setByPatient((prev) => {
            const next = new Map(prev)
            for (const r of rows) next.set(r.patientId, r.flags)
            return next
          })
        },
        () => {}
      )
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
