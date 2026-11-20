"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { useCitaStream } from "@/hooks/use-cita-stream";
import { useMe } from "@/hooks/use-me";
import { measurementLinked, openRequestFor, sheetPath } from "@/lib/format-sheet/sheet";

// The iPad side of the sheet screens, on the center's live bus (/api/v2/tablero/stream):
// - «Enviar al iPad»: an open_requested aimed at THIS person's staffId opens that sheet right away.
// - A measurement newly linked to a visit: offered as «X just got weighed — Open sheet» (never forced:
//   the nurse may be in the middle of another sheet).
//   The bus carries every service's measurements, so it is offered only for a visit `isSheetVisit` knows
//   (the home list of this format's visits); screens without that list never offer it.
// `onChange` lets the home list refresh (a sheet saved or a visit weighed elsewhere).
export function useSheetLive(
  slug: string,
  opts: { onChange?: () => void; currentSessionId?: string; isSheetVisit?: (sessionId: string) => boolean } = {},
): { live: boolean } {
  const router = useRouter();
  const t = useTranslations("formSheet.live");
  const me = useMe();
  const staffId = me.kind === "ok" ? (me.me.staffId ?? null) : null;
  const center = me.kind === "ok" ? me.me.activeClinicId : undefined;
  const latest = React.useRef({ ...opts, staffId });
  React.useEffect(() => {
    latest.current = { ...opts, staffId };
  });

  const { live } = useCitaStream({
    centroId: center ?? undefined,
    enabled: !!center,
    debounceMs: 600,
    onEvent: (e) => {
      const { staffId: mine, currentSessionId, isSheetVisit } = latest.current;
      const open = openRequestFor(e, mine);
      if (open) {
        if (open.sessionId === currentSessionId) return;
        toast.info(t("opened", { name: open.patientName ?? "—" }));
        router.push(sheetPath(open.slug, open.sessionId));
        return;
      }
      const weighed = measurementLinked(e);
      if (weighed && weighed.sessionId !== currentSessionId && isSheetVisit?.(weighed.sessionId)) {
        toast(t("weighed", { name: weighed.patientName ?? "—" }), {
          duration: 15_000,
          action: { label: t("openSheet"), onClick: () => router.push(sheetPath(slug, weighed.sessionId)) },
        });
      }
    },
    onInvalidate: () => latest.current.onChange?.(),
  });
  return { live };
}
