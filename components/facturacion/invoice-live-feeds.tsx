"use client";

import * as React from "react";

import { useCitaStream } from "@/hooks/use-cita-stream";

// Live invoice events across clinics. The BE's SSE bus is per clinic (`tablero/stream` follows the
// X-Tenant-ID), so a list showing several clinics listens to each of them: one feed per clinic, each
// reporting whether it is connected. `live` = every listened clinic is connected.
export function useInvoiceLiveFeeds(clinicIds: readonly string[]) {
  const [connected, setConnected] = React.useState<Record<string, boolean>>({});
  const onLive = React.useCallback((id: string, live: boolean) => {
    setConnected((prev) => (prev[id] === live ? prev : { ...prev, [id]: live }));
  }, []);
  const live = clinicIds.length > 0 && clinicIds.every((id) => connected[id]);
  return { live, onLive };
}

export function InvoiceLiveFeeds({
  clinicIds,
  onInvalidate,
  onLive,
}: {
  clinicIds: readonly string[];
  onInvalidate: () => void;
  onLive: (clinicId: string, live: boolean) => void;
}) {
  return (
    <>
      {clinicIds.map((id) => (
        <InvoiceLiveFeed key={id} clinicId={id} onInvalidate={onInvalidate} onLive={onLive} />
      ))}
    </>
  );
}

function InvoiceLiveFeed({
  clinicId,
  onInvalidate,
  onLive,
}: {
  clinicId: string;
  onInvalidate: () => void;
  onLive: (clinicId: string, live: boolean) => void;
}) {
  const { live } = useCitaStream({ centroId: clinicId, entidad: "factura", onInvalidate });
  React.useEffect(() => {
    onLive(clinicId, live);
  }, [clinicId, live, onLive]);
  React.useEffect(() => () => onLive(clinicId, false), [clinicId, onLive]);
  return null;
}
