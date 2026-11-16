"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { createConfirmQueue, type ConfirmOptions } from "@/lib/forms/confirm-queue";

// One queue for the whole app, shared by useConfirm() and the mounted ConfirmHost.
const queue = createConfirmQueue();

/**
 * `const confirm = useConfirm(); if (await confirm({ title })) …`
 * Resolves only while `ConfirmHost` is mounted (AppShell, root layout).
 */
export function useConfirm(): (o: ConfirmOptions) => Promise<boolean> {
  return queue.request;
}

/** Mount once (app shell): renders the queue's current prompt as an AlertDialog. */
export function ConfirmHost() {
  const t = useTranslations("common");
  const current = useSyncExternalStore(queue.subscribe, queue.current, queue.current);

  // Keep the last prompt so the text does not blank while the close animation runs.
  const [last, setLast] = useState<ConfirmOptions | null>(null);
  if (current && current !== last) setLast(current);
  const shown = current ?? last;

  useEffect(() => () => queue.cancelAll(), []);

  return (
    <AlertDialog open={!!current} onOpenChange={(o) => !o && queue.settle(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{shown?.title}</AlertDialogTitle>
          {shown?.description && (
            <AlertDialogDescription>{shown.description}</AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{shown?.cancelLabel ?? t("cancel")}</AlertDialogCancel>
          <AlertDialogAction
            variant={shown?.destructive ? "destructive" : "default"}
            onClick={(e) => {
              // Keep Radix from also firing onOpenChange(false), which would cancel the next prompt.
              e.preventDefault();
              queue.settle(true);
            }}
          >
            {shown?.confirmLabel ?? t("confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
