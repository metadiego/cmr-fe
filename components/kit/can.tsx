"use client";

import * as React from "react";

import { useCan } from "@/hooks/use-can";

// Cosmetic permission gate around useCan (RBAC fino F1). Renders children only
// when the current principal has `permiso` (master → '*' passes everything).
// Optional `fallback` shows when denied. Use ONLY to show/hide/disable UI — the
// BE enforces real authorization (@Permissions). Never trust the FE.
//
//   <Can permiso="clientes.create"><Button>New</Button></Can>
export function Can({
  permiso,
  fallback = null,
  children,
}: {
  permiso: string;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { can } = useCan();
  return <>{can(permiso) ? children : fallback}</>;
}
