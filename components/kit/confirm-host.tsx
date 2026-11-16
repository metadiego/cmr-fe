"use client";

import { useEffect, useSyncExternalStore } from "react";
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

/** `const confirm = useConfirm(); if (await confirm({ title })) …` */
export function useConfirm(): (o: ConfirmOptions) => Promise<boolean> {
  return queue.request;
}

/** Mount once (app shell): renders the queue's current prompt as an AlertDialog. */
export function ConfirmHost() {
  const t = useTranslations("common");
  const current = useSyncExternalStore(queue.subscribe, queue.current, queue.current);

  useEffect(() => () => queue.cancelAll(), []);

  return (
    <AlertDialog open={!!current} onOpenChange={(o) => !o && queue.settle(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{current?.title}</AlertDialogTitle>
          {current?.description && (
            <AlertDialogDescription>{current.description}</AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{current?.cancelLabel ?? t("cancel")}</AlertDialogCancel>
          <AlertDialogAction
            variant={current?.destructive ? "destructive" : "default"}
            onClick={(e) => {
              // Keep Radix from also firing onOpenChange(false), which would cancel the next prompt.
              e.preventDefault();
              queue.settle(true);
            }}
          >
            {current?.confirmLabel ?? t("confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
