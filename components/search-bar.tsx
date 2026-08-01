"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { Search01Icon } from "@hugeicons/core-free-icons";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

// Buscador RETRÁCTIL: colapsado es solo el icono (ancho mínimo); al enfocarlo (clic o ⌘K) crece.
// Al perder el foco vacío, se vuelve a colapsar. El cableado a una búsqueda real es trabajo futuro
// — esta es la superficie visual. Oculto en móvil (la búsqueda vive en el menú lateral).
export function SearchBar({ className }: { className?: string }) {
  const t = useTranslations("nav");
  const [open, setOpen] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // ⌘K / Ctrl+K abre y enfoca el buscador desde cualquier parte.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className={cn("relative hidden md:block", className)}>
      <button
        type="button"
        aria-hidden={open}
        tabIndex={open ? -1 : 0}
        aria-label={t("search")}
        onClick={() => {
          setOpen(true);
          inputRef.current?.focus();
        }}
        className={cn(
          "absolute top-1/2 left-3 -translate-y-1/2",
          open && "pointer-events-none",
        )}
      >
        <HugeiconsIcon icon={Search01Icon} className="size-4 text-muted-foreground" />
      </button>
      <Input
        ref={inputRef}
        type="search"
        placeholder={open ? t("searchPlaceholder") : ""}
        aria-label={t("search")}
        onFocus={() => setOpen(true)}
        onBlur={(e) => {
          if (!e.currentTarget.value) setOpen(false);
        }}
        className={cn(
          "h-9 cursor-pointer border-transparent bg-muted/60 pl-9 transition-[width] duration-200 ease-out hover:bg-muted focus-visible:cursor-text focus-visible:bg-background",
          open ? "w-64 cursor-text pr-12 xl:w-80" : "w-9 pr-0",
        )}
      />
      <kbd
        className={cn(
          "pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 items-center gap-1 rounded border bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground select-none",
          open ? "hidden sm:flex" : "hidden",
        )}
      >
        ⌘K
      </kbd>
    </div>
  );
}
