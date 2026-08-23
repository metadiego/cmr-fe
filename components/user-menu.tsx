"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Settings02Icon,
  DashboardSquare01Icon,
  UserCircleIcon,
  Logout03Icon,
} from "@hugeicons/core-free-icons";

import { setLocale } from "@/i18n/locale-actions";
import { locales, type Locale } from "@/i18n/config";
import { createClient } from "@/lib/supabase/client";
import { useMe } from "@/hooks/use-me";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Menú del avatar: concentra tema, idioma, ajustes de la app y cerrar sesión. Configurable —
// las opciones se agregan aquí (no dispersas por la barra). El hover muestra el usuario (hoy el
// BE solo expone el email; cuando exponga un nombre, se usa aquí sin más cambios).
export function UserMenu() {
  const t = useTranslations("userMenu");
  const router = useRouter();
  const me = useMe();
  const session = me.kind === "ok" ? me.me : null;
  const { theme, setTheme } = useTheme();
  const locale = useLocale() as Locale;

  const [signingOut, setSigningOut] = React.useState(false);
  async function signOut() {
    setSigningOut(true);
    await createClient().auth.signOut();
    // Navegación DURA (no router.replace): la suave dejaba el menú pegado en «Saliendo…» porque el header
    // no se remonta. Recargar en /login limpia del todo el estado de sesión.
    window.location.assign("/login");
  }

  if (!session) {
    return (
      <Link
        href="/login"
        className="inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium"
      >
        {t("signIn")}
      </Link>
    );
  }

  const email = session.email ?? "";
  // Nombre visible: nombre/apellido del perfil (cmr-be PR #221); si el login no tiene perfil
  // (nombre null, p. ej. cuentas master), cae a la parte antes de @ del email.
  const fullName = [session.nombre, session.apellido].filter(Boolean).join(" ").trim();
  const displayName = fullName || (email ? email.split("@")[0] : t("account"));
  const initials = (
    fullName
      ? `${session.nombre?.[0] ?? ""}${session.apellido?.[0] ?? ""}`
      : email || "?"
  )
    .slice(0, 2)
    .toUpperCase();

  function changeLocale(next: string) {
    if (next === locale) return;
    void setLocale(next as Locale).then(() => router.refresh());
  }

  return (
    <DropdownMenu>
      <Tooltip content={displayName}>
        <DropdownMenuTrigger
          aria-label={displayName}
          className="rounded-full outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Avatar className="size-8">
            {session.avatarUrl ? <AvatarImage src={session.avatarUrl} alt="" /> : null}
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
      </Tooltip>

      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="truncate text-sm font-medium">{displayName}</span>
          {email ? (
            <span className="truncate text-xs font-normal text-muted-foreground">{email}</span>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Tema */}
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          {t("theme")}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme ?? "system"} onValueChange={setTheme}>
          <DropdownMenuRadioItem value="light">{t("themeLight")}</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">{t("themeDark")}</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">{t("themeSystem")}</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />

        {/* Idioma */}
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          {t("language")}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup value={locale} onValueChange={changeLocale}>
          {locales.map((l) => (
            <DropdownMenuRadioItem key={l} value={l}>
              {t(`lang_${l}`)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />

        {/* Ajustes de la app (rutas reales existentes) */}
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href="/configuracion">
              <HugeiconsIcon icon={Settings02Icon} className="size-4" />
              {t("appSettings")}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/settings/tablero-modulos">
              <HugeiconsIcon icon={DashboardSquare01Icon} className="size-4" />
              {t("boardModules")}
            </Link>
          </DropdownMenuItem>
          {/* MI apariencia: colores, radio y fondo propios (capa `usuario` de preferencias). La tiene
              cualquier usuario y cualquier rol —incluido el administrador, que también quiere sus
              colores—; la corporativa (sistema, centro y overrides) vive en Configuración.
              See docs/specs/apariencia-personal-en-el-avatar-y-corporativa-en-configuracion.md */}
          <DropdownMenuItem asChild>
            <Link href="/settings/appearance">
              <HugeiconsIcon icon={UserCircleIcon} className="size-4" />
              {t("myAppearance")}
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />

        <DropdownMenuItem onSelect={signOut} disabled={signingOut}>
          <HugeiconsIcon icon={Logout03Icon} className="size-4" />
          {signingOut ? t("signingOut") : t("signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
