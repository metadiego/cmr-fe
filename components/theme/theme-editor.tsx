"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { CheckmarkCircle02Icon, Image01Icon, VideoReplayIcon, Delete02Icon } from "@hugeicons/core-free-icons";

import { configToCssVars, type ThemeConfig } from "@/lib/theme/config";
import { APPROVED_BRANDS, brandKeyFor } from "@/lib/theme/brand";
import { uploadMedia } from "@/lib/api/media";
import { apiErrorMessage } from "@/lib/api/errors";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Selector de COLOR DE MARCA + fondo de página (imagen o video). Controlado: el padre es dueño del
// `value` y lo persiste. Previsualiza escribiendo las vars derivadas en <html> (el padre recarga al
// guardar para llegar al estado autoritativo). El fondo de VIDEO no tiene preview de página completa
// (no hay CSS var para eso; ver BackgroundPicker más abajo para su preview inline propia) pero
// imageUrl SÍ escribe --app-bg-image aquí igual que el color — con LIMPIEZA explícita al desmontar o
// al cambiar `value`, para que quitar el fondo (o cambiarlo) no deje una var vieja pegada en <html>.
// `disabled` apaga TODO el editor de una vez — el bloqueo del centro es de la capa entera, no campo
// por campo (handoff apariencia-personal-restaurar-y-bloqueo-de-centro).
export function ThemeEditor({
  value,
  onChange,
  disabled,
}: {
  value: ThemeConfig;
  onChange: (next: ThemeConfig) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("appearance");

  // Color: se queda "pegado" en <html> hasta que se guarda y la página recarga al estado
  // autoritativo (comportamiento de siempre, sin limpieza — cambiar de pantalla sin guardar no debe
  // devolver la app entera al color por defecto a medio uso).
  React.useEffect(() => {
    const vars = configToCssVars(value);
    const el = document.documentElement;
    for (const [name, v] of Object.entries(vars)) el.style.setProperty(name, v);
  }, [value]);

  // Fondo de imagen: a diferencia del color, esta pantalla ofrece un botón para QUITARLO — sin
  // limpieza, --app-bg-image se quedaría pegado en <html> para siempre tras "Quitar fondo" o al
  // cambiar de imagen a video. Efecto propio y acotado (no toca las vars de color de arriba).
  React.useEffect(() => {
    const el = document.documentElement;
    const url = value.background?.imageUrl;
    if (!url) return;
    el.style.setProperty("--app-bg-image", `url("${url}")`);
    return () => {
      el.style.removeProperty("--app-bg-image");
    };
  }, [value.background?.imageUrl]);

  const current = brandKeyFor(value.colors?.primary);
  // Solo se guarda el primario; se descartan las claves de color heredadas (fondo, etc.).
  const pick = (primary: string) => onChange({ ...value, colors: { primary } });

  return (
    <div className="space-y-6">
      <div className="space-y-2.5">
        <Label>{t("brandColor")}</Label>
        <div className="flex flex-wrap gap-2.5">
          {APPROVED_BRANDS.map((b) => {
            const selected = current === b.key;
            return (
              <button
                key={b.key}
                type="button"
                disabled={disabled}
                onClick={() => pick(b.primary)}
                aria-pressed={selected}
                title={t(`brand_${b.key}`)}
                className={cn(
                  "grid size-9 place-items-center rounded-full ring-1 ring-foreground/15 transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40",
                  selected && "ring-2 ring-ring ring-offset-2 ring-offset-background",
                )}
                style={{ background: b.primary }}
              >
                {selected && (
                  <HugeiconsIcon
                    icon={CheckmarkCircle02Icon}
                    className="size-4 text-white"
                  />
                )}
                <span className="sr-only">{t(`brand_${b.key}`)}</span>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">{t("brandHint")}</p>
      </div>

      <BackgroundPicker value={value} onChange={onChange} disabled={disabled} />
    </div>
  );
}

// Fondo de página: imagen o video, mutuamente excluyentes (subir uno limpia el otro). Sube directo
// a Supabase Storage con el mismo mecanismo del avatar (lib/api/media.ts, kind "background" — ya
// acepta mp4/webm además de imagen, sin cambios de BE). Guarda solo la URL pública; el padre decide
// cuándo persistir el `value` completo.
function BackgroundPicker({
  value,
  onChange,
  disabled,
}: {
  value: ThemeConfig;
  onChange: (next: ThemeConfig) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("appearance");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [kind, setKind] = React.useState<"image" | "video">(
    value.background?.videoUrl ? "video" : "image",
  );
  const [busy, setBusy] = React.useState(false);
  const url = kind === "video" ? value.background?.videoUrl : value.background?.imageUrl;

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const publicUrl = await uploadMedia("background", file);
      onChange({
        ...value,
        background: kind === "video" ? { videoUrl: publicUrl } : { imageUrl: publicUrl },
      });
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function quitar() {
    onChange({ ...value, background: undefined });
  }

  return (
    <div className="space-y-2.5">
      <Label>{t("backgroundTitle")}</Label>
      <div className="inline-flex rounded-md ring-1 ring-foreground/15">
        {(["image", "video"] as const).map((k) => (
          <button
            key={k}
            type="button"
            disabled={disabled}
            onClick={() => setKind(k)}
            aria-pressed={kind === k}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 text-sm first:rounded-l-md last:rounded-r-md disabled:pointer-events-none disabled:opacity-40",
              kind === k ? "bg-primary text-primary-foreground" : "hover:bg-muted",
            )}
          >
            <HugeiconsIcon icon={k === "image" ? Image01Icon : VideoReplayIcon} className="size-3.5" />
            {t(k === "image" ? "backgroundImage" : "backgroundVideo")}
          </button>
        ))}
      </div>

      {url ? (
        <div className="relative w-full max-w-xs overflow-hidden rounded-md ring-1 ring-foreground/15">
          {kind === "video" ? (
            <video src={url} className="aspect-video w-full object-cover" muted loop autoPlay playsInline />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL, no static import
            <img src={url} alt="" className="aspect-video w-full object-cover" />
          )}
          {!disabled && (
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className="absolute right-1.5 top-1.5 size-7"
              onClick={quitar}
              aria-label={t("backgroundRemove")}
              title={t("backgroundRemove")}
            >
              <HugeiconsIcon icon={Delete02Icon} className="size-4" />
            </Button>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">{t("backgroundEmpty")}</p>
      )}

      <div>
        <input
          ref={inputRef}
          type="file"
          accept={kind === "video" ? "video/mp4,video/webm" : "image/*"}
          className="hidden"
          onChange={onFile}
          disabled={disabled || busy}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? t("uploading") : t("backgroundUpload")}
        </Button>
      </div>
    </div>
  );
}
