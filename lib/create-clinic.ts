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

/**
 * The clinic a create FORM starts on, for forms that list the person's clinics in their own picker:
 * what the person `picked`, else the clinic the form was opened in (`given`: a record's or a one-clinic
 * screen's), else the top bar's (`active`), else the only clinic there is. On «Ambos» (`viewAll`) the top
 * bar names no clinic, so with anything but exactly one clinic the form starts EMPTY and asks
 * (docs/specs/selector-de-centros-arriba.md).
 */
export function formCreateClinic(opts: {
  picked?: string | null;
  given?: string | null;
  active: string | null;
  centers: readonly string[];
  viewAll: boolean;
}): string {
  const { picked, given, active, centers, viewAll } = opts;
  if (picked) return picked;
  if (given) return given;
  if (centers.length === 1) return centers[0];
  if (viewAll) return "";
  return active ?? "";
}

/**
 * Whether a create may be sent with `clinicId` as its clinic. Empty is only acceptable where nothing has
 * to be chosen: not on «Ambos» (the request would silently land in the working clinic) and not when the
 * person has several clinics to choose from. `centerCount` 0 = not loaded yet.
 */
export function createClinicReady(clinicId: string, centerCount: number, viewAll: boolean): boolean {
  if (clinicId) return true;
  return !viewAll && centerCount <= 1;
}
