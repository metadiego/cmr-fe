"use client"

import { getFrontdeskQueue, type FrontdeskQueue } from "@/lib/api/frontdesk-queue"
import { useResource } from "@/hooks/use-resource"
import { useCitaStream as useLiveStream } from "@/hooks/use-cita-stream"

// The therapy queue (GET /frontdesk/queue, BE PR #420, live 10-oct-2026): who is waiting and who is
// in therapy, per service, for the queue strip + side panel. Same SSE bus as the rest of the frontdesk
// (no new event to listen for — BE confirmed the queue only changes on session transitions, which
// already publish) and the same refetch-on-any-invalidation pattern as usePatientDay.
export function useTherapyQueue(centerId: string | undefined, date: string) {
  const res = useResource<FrontdeskQueue | null>(
    () => (centerId ? getFrontdeskQueue(date, undefined, centerId) : Promise.resolve(null)),
    [centerId, date],
  )
  const { live } = useLiveStream({ centroId: centerId ?? null, enabled: !!centerId, onInvalidate: res.refresh })
  return {
    queue: res.state.kind === "ok" ? res.state.data : null,
    loading: res.state.kind === "loading",
    live,
    refresh: res.refresh,
  }
}
