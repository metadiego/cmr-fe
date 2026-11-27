"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { PlayIcon } from "@hugeicons/core-free-icons";

import { postCallcenterRecording } from "@/lib/api/callcenter";
import { apiErrorLabel } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";

const POLL_MS = 3000;
const MAX_ATTEMPTS = 20; // ~60s

// Handoff §3: the FIRST call may need to fetch the recording from the switchboard (pending/taken →
// re-POST every 3s until ready); the SECOND time it's instant, because it stayed uploaded.
export function CallcenterRecordingButton({ callId }: { callId: string }) {
  const t = useTranslations("callcenter");
  const tRoot = useTranslations();
  const [state, setState] = React.useState<"idle" | "loading" | "playing" | "error">("idle");
  const [url, setUrl] = React.useState<string | null>(null);

  async function play() {
    setState("loading");
    try {
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const r = await postCallcenterRecording(callId);
        if (r.status === "ready") {
          setUrl(r.url);
          setState("playing");
          return;
        }
        await new Promise((res) => setTimeout(res, POLL_MS));
      }
      toast.error(t("recordingTimeout"));
      setState("idle");
    } catch (err) {
      // Relies on apiErrorLabel's own labelKey lookup for "callcenter.no_recording" (i18n key added
      // under the same top-level "callcenter" namespace) — no special-casing by code here.
      toast.error(apiErrorLabel(err, tRoot));
      setState("error");
    }
  }

  if (state === "playing" && url) {
    return <audio controls autoPlay src={url} className="h-8 max-w-[220px]" />;
  }

  return (
    <Button variant="outline" size="sm" disabled={state === "loading"} onClick={play}>
      <HugeiconsIcon icon={PlayIcon} className="size-3.5" />
      {state === "loading" ? t("recordingLoading") : t("recordingPlay")}
    </Button>
  );
}
