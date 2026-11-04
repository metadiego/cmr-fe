import type { BookingKind } from "./url-state.ts"

// Pure helpers behind the availability hooks (hooks/use-booking-availability.ts).

/** Cache key of one day's availability. The month asks without a patient; the day view may add one. */
export function dayKey(
  center: string,
  kind: BookingKind,
  typeId: string,
  date: string,
  patientId?: string
): string {
  return [center, kind, typeId, date, patientId ?? ""].join("|")
}

/** A response only counts when the request it answers is still the one on screen. */
export function isCurrent(requestKey: string, currentKey: string): boolean {
  return requestKey === currentKey
}

/**
 * Dates to refetch after live events. An event without a date (e.g. "eliminada", or the safety-net
 * poll) could have touched any day, so every visible date is refreshed.
 */
export function datesToRefresh(
  eventDates: (string | undefined)[],
  visible: string[]
): string[] {
  if (eventDates.some((d) => d === undefined)) return [...visible]
  const wanted = new Set(eventDates)
  return visible.filter((d) => wanted.has(d))
}

/** Runs the tasks with at most `limit` in flight; results keep the input order. */
export async function runLimited<T>(
  tasks: (() => Promise<T>)[],
  limit: number
): Promise<PromiseSettledResult<T>[]> {
  const results = new Array<PromiseSettledResult<T>>(tasks.length)
  let next = 0
  const worker = async () => {
    while (next < tasks.length) {
      const i = next++
      try {
        results[i] = { status: "fulfilled", value: await tasks[i]() }
      } catch (reason) {
        results[i] = { status: "rejected", reason }
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(limit, tasks.length)) }, worker)
  )
  return results
}
