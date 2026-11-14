"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { toastError } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";

// One "Save" for a whole staff record. Each section keeps its own draft and its own endpoint, and
// registers here whether it has changes and how to save them; the footer saves every changed section
// in order. A section that fails shows its own error and the others still save.

type Section = { dirty: boolean; save: () => Promise<void> };
type Register = (key: string, section: Section | null) => void;

const SaveGroupContext = React.createContext<Register | null>(null);

/** Registers a section of the record: `save` runs when the footer's "Save" is pressed and `dirty` is true. */
export function useSaveSection(key: string, dirty: boolean, save: () => Promise<void>) {
  const register = React.useContext(SaveGroupContext);
  const saveRef = React.useRef(save);
  React.useEffect(() => {
    saveRef.current = save;
  });
  React.useEffect(() => {
    register?.(key, { dirty, save: () => saveRef.current() });
  }, [register, key, dirty]);
  React.useEffect(() => () => register?.(key, null), [register, key]);
}

export function SaveGroup({
  children,
  footerStart,
  onSaved,
}: {
  children: React.ReactNode;
  /** Left side of the footer (e.g. "Deactivate"). */
  footerStart?: React.ReactNode;
  /** Called once after a save in which at least one section was written. */
  onSaved: () => void;
}) {
  const t = useTranslations("personalFicha");
  const tRoot = useTranslations();
  const [sections, setSections] = React.useState<Map<string, Section>>(() => new Map());
  const [busy, setBusy] = React.useState(false);

  const register = React.useCallback<Register>((key, section) => {
    setSections((prev) => {
      const next = new Map(prev);
      if (section) next.set(key, section);
      else next.delete(key);
      return next;
    });
  }, []);

  const dirty = [...sections.values()].filter((s) => s.dirty);

  async function saveAll() {
    if (busy || dirty.length === 0) return;
    setBusy(true);
    let saved = 0;
    let failed = 0;
    for (const section of dirty) {
      try {
        await section.save();
        saved++;
      } catch (e) {
        failed++;
        toastError(e, tRoot);
      }
    }
    setBusy(false);
    if (saved > 0) onSaved();
    if (failed === 0) toast.success(t("guardado"));
  }

  return (
    <SaveGroupContext.Provider value={register}>
      {children}
      <div className="sticky bottom-0 z-10 mt-6 flex items-center justify-between gap-3 border-t bg-card py-3">
        <div>{footerStart}</div>
        <div className="flex items-center gap-3">
          {dirty.length > 0 && !busy && <span className="text-xs text-muted-foreground">{t("unsavedChanges")}</span>}
          <Button size="sm" onClick={saveAll} disabled={busy || dirty.length === 0}>
            {busy ? t("guardando") : t("guardarCambios")}
          </Button>
        </div>
      </div>
    </SaveGroupContext.Provider>
  );
}
