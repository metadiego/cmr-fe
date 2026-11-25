import { apiFetch } from "./client";

// Transfer a package's pending sessions to another patient and/or another center (cmr-be #639/#640,
// handoff docs/specs/transferir-tratamiento-a-otro-paciente-handoff-be.md). Generalizes the existing
// center-only transfer (lib/api/frontdesk.ts transferirTratamiento, still on its own older path) with
// an optional destination patient — omitting both destination fields is rejected by the BE
// (TRANSFER_NOTHING_CHANGES), so there is nothing left to transfer to.

export type TransferPackagePayload = {
  /** Another patient receives the sessions. Omitted = the same patient. */
  destinationPatientId?: string;
  /** Omitted = the same center. */
  destinationClinicId?: string;
  /** Omitted = every pending session; a number = partial. */
  sessions?: number;
  mode?: "virtual" | "fisica";
  /** Only read in mode "fisica". */
  sourceWarehouseId?: string;
  destinationWarehouseId?: string;
  /** Required by the BE when destinationPatientId is set. */
  reason?: string;
};

export type TreatmentTransfer = {
  id: string;
  sourcePackageId: string;
  destinationPackageId: string;
  sourceClinicId: string;
  destinationClinicId: string;
  patientId: string;
  destinationPatientId: string | null;
  productId: string;
  sessions: number;
  mode: "virtual" | "fisica";
  sourceWarehouseId: string | null;
  destinationWarehouseId: string | null;
  reason: string | null;
  actorId: string | null;
  status: "anulada" | "aplicada";
  createdAt: string;
  updatedAt: string;
};

// POST /invoices/packages/:id/transfer. The Swagger response is under-declared (Record<string, never>)
// but the sibling void endpoint below returns the full TreatmentTransfer shape, and this is the same
// entity — typed as such rather than as unknown.
export function transferPackage(packageId: string, payload: TransferPackagePayload, centroId?: string): Promise<TreatmentTransfer> {
  return apiFetch<TreatmentTransfer>(
    `/invoices/packages/${encodeURIComponent(packageId)}/transfer`,
    { method: "POST", body: JSON.stringify(payload) },
    centroId,
  );
}

// POST /invoices/transfers/:id/void — reverses a transfer (pending sessions and, in "fisica" mode,
// inventory, go back to the source).
export function voidTransfer(transferId: string, centroId?: string): Promise<TreatmentTransfer> {
  return apiFetch<TreatmentTransfer>(
    `/invoices/transfers/${encodeURIComponent(transferId)}/void`,
    { method: "POST" },
    centroId,
  );
}

// GET /invoices/transfers?pacienteId= — the BE's own query param is Spanish (its existing contract,
// not renamed here per CLAUDE.md rule 6); the response itself is already English.
export function listTransfers(patientId: string, centroId?: string): Promise<TreatmentTransfer[]> {
  return apiFetch<TreatmentTransfer[]>(
    `/invoices/transfers?pacienteId=${encodeURIComponent(patientId)}`,
    {},
    centroId,
  );
}

// POST /invoices/packages/transfer-many (cmr-be #710, handoff-transferir-tratamiento-completo): moves
// several packages to one destination patient (and, when that destination is the SAME patient, to
// another center) in a single all-or-nothing call. Field names are the handoff's own — Spanish,
// unlike the English-named sibling `transferPackage` above — because this is a brand-new endpoint
// (not yet deployed: a live POST returned ENTITY_NOT_FOUND / "Cannot POST" on 2026-11-25) with its own
// contract; `almacenOrigenId`/`almacenDestinoId` follow the same Spanish-naming pattern as the rest of
// this payload but are UNVERIFIED (the handoff's own payload example omits them) — confirm against the
// real BE response once #710 ships.
export type TransferManyItemPayload = {
  paqueteId: string;
  sesiones: number;
};

export type TransferManyPayload = {
  items: TransferManyItemPayload[];
  pacienteDestinoId: string;
  clinicDestinoId?: string;
  motivo: string;
  modo?: "virtual" | "fisica";
  almacenOrigenId?: string;
  almacenDestinoId?: string;
};

export type TransferManyResult = {
  transferencias: TreatmentTransfer[];
};

export function transferManyPackages(payload: TransferManyPayload, centroId?: string): Promise<TransferManyResult> {
  return apiFetch<TransferManyResult>(
    `/invoices/packages/transfer-many`,
    { method: "POST", body: JSON.stringify(payload) },
    centroId,
  );
}
