"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { configToCssVars, type ThemeConfig } from "@/lib/theme/config";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const RADIUS_PRESETS = [
  { key: "none", value: "0rem" },
  { key: "small", value: "0.375rem" },
  { key: "medium", value: "0.625rem" },
  { key: "large", value: "1rem" },
] as const;

// Hex needed by <input type="color">; stored values may be OKLCH/hex — fall back
// to a neutral when not a hex so the picker still renders.
function asHex(v?: string): string {
  return v && /^#[0-9a-f]{6}$/i.test(v) ? v : "#888888";
}

// Reusable theme editor over the ThemeConfig vocabulary. Controlled: parent owns
// the value and persists it. Live-previews edits by writing the CSS vars onto
// <html> (the parent reloads on save/reset to reach the authoritative state).
export function ThemeEditor({
  value,
  onChange,
}: {
  value: ThemeConfig;
  onChange: (next: ThemeConfig) => void;
}) {
  const t = useTranslations("appearance");

  React.useEffect(() => {
    const vars = configToCssVars(value);
    const el = document.documentElement;
    for (const [name, v] of Object.entries(vars)) el.style.setProperty(name, v);
  }, [value]);

  const setColor = (key: "primary" | "accent" | "background", hex: string) =>
    onChange({ ...value, colors: { ...value.colors, [key]: hex } });

  return (
    <div className="space-y-5">
      <ColorField
        label={t("primary")}
        value={value.colors?.primary}
        onChange={(v) => setColor("primary", v)}
      />
      <ColorField
        label={t("accent")}
        value={value.colors?.accent}
        onChange={(v) => setColor("accent", v)}
      />
      <ColorField
        label={t("background")}
        value={value.colors?.background}
        onChange={(v) => setColor("background", v)}
      />

      <div className="space-y-1.5">
        <Label>{t("radius")}</Label>
        <Select
          value={value.radius ?? ""}
          onValueChange={(r) => onChange({ ...value, radius: r })}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={t("radiusDefault")} />
          </SelectTrigger>
          <SelectContent>
            {RADIUS_PRESETS.map((p) => (
              <SelectItem key={p.key} value={p.value}>
                {t(`radius_${p.key}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: string;
  onChange: (hex: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={asHex(value)}
          onChange={(e) => onChange(e.target.value)}
          className="size-9 cursor-pointer rounded-md border bg-transparent"
          aria-label={label}
        />
        <Input
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#3b82f6"
          className="font-mono"
        />
      </div>
    </div>
  );
}
