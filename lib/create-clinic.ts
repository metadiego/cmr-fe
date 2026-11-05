// The ONE clinic a new record is created in, on a list screen that reads every clinic (handoff
// clinic-read-scope). Reading spans clinics; creating still lands in one: the filter's single ticked
// clinic if exactly one is ticked, else the top bar's, else the session's, else the first the person may
// create in. Only clinics where the person holds the create permission (`writable`) qualify.
import { defaultScreenCenter } from "./screen-center.ts";

/**
 * `choice`: the list's clinics (`null` = every readable clinic). "" when nothing qualifies — or when the top
 * bar is on «Ambos» (`viewAll`) and the person may create in more than one clinic: then the form asks,
 * with no clinic picked for them (docs/specs/selector-de-centros-arriba.md).
 */
export function createClinicOf(
  choice: readonly string[] | null,
  writable: readonly string[],
  topBarCenterId: string | null,
  sessionCenterId: string | null,
  viewAll = false,
): string {
  if (choice?.length === 1 && writable.includes(choice[0])) return choice[0];
  if (viewAll && writable.length > 1) return "";
  return defaultScreenCenter(writable, topBarCenterId, sessionCenterId);
}
