import { missingFields } from "../forms/missing.ts";

// What the «New API key» form still lacks (components/admin/api-key-create-dialog.tsx). Full access
// only counts on an all-centers key: the BE refuses '*' on a center key.
export const ALL_CENTERS = "__all__";

export interface ApiKeyForm {
  name: string;
  centerId: string; // ALL_CENTERS = an admin key for every center
  fullAccess: boolean;
  permissions: string[];
  expiresAt: string; // "YYYY-MM-DD" or ""
}

export function apiKeyFormMissing(form: ApiKeyForm, labels: { name: string; permissions: string }): string[] {
  const fullAccess = form.centerId === ALL_CENTERS && form.fullAccess;
  return missingFields([
    [labels.name, form.name.trim() !== ""],
    [labels.permissions, fullAccess || form.permissions.length > 0],
  ]);
}
