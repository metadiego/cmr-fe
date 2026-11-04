// The ONE clinic a new record is created in, on a list screen that reads every clinic (handoff
// clinic-read-scope). Reading spans clinics; creating still lands in one: the filter's single ticked
// clinic if exactly one is ticked, else the top bar's, else the session's, else the first the person may
// create in. Only clinics where the person holds the create permission (`writable`) qualify.
import { defaultScreenCenter } from "./screen-center.ts";

/** `choice`: the clinic filter's choice (`null` = every readable clinic). "" when nothing qualifies. */
export function createClinicOf(
  choice: readonly string[] | null,
  writable: readonly string[],
  topBarCenterId: string | null,
  sessionCenterId: string | null,
): string {
  if (choice?.length === 1 && writable.includes(choice[0])) return choice[0];
  return defaultScreenCenter(writable, topBarCenterId, sessionCenterId);
}
