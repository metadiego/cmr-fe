"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Settings02Icon,
  DashboardSquare01Icon,
  UserCircleIcon,
  SquareLock02Icon,
  Logout03Icon,
} from "@hugeicons/core-free-icons";

import { setLocale } from "@/i18n/locale-actions";
import { locales, type Locale } from "@/i18n/config";
import { setMyLanguage } from "@/lib/api/preferences";
import { toastError } from "@/lib/api/errors";
import { createClient } from "@/lib/supabase/client";
import { useMe } from "@/hooks/use-me";
import { useCan } from "@/hooks/use-can";
import { useMenu } from "@/hooks/use-menu";
import { routeForClave } from "@/lib/nav/manifest";
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
  const tRoot = useTranslations();
  const router = useRouter();
  const me = useMe();
  const session = me.kind === "ok" ? me.me : null;
  const { can } = useCan();
  // «Configuración de la app» se deriva del MENÚ (no de un permiso fijo): visible solo si al usuario le
  // llega alguna sección de configuración (/configuracion/*) en /me/menu.
  const menu = useMenu();
  const puedeConfigurar = menu.some((m) => routeForClave(m.slug, m.path).startsWith("/configuration/"));
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
  const fullName = [session.name, session.lastName].filter(Boolean).join(" ").trim();
  const displayName = fullName || (email ? email.split("@")[0] : t("account"));
  const initials = (
    fullName
      ? `${session.name?.[0] ?? ""}${session.lastName?.[0] ?? ""}`
      : email || "?"
  )
    .slice(0, 2)
    .toUpperCase();

  // Idiomas elegibles: la lista que manda el BE en /auth/me (agregar un idioma es una fila del
  // BE, no un despliegue del FE). Si aún no cargó, cae a los locales compilados. Handoff idioma-por-usuario.
  const idiomas =
    session.idiomasDisponibles && session.idiomasDisponibles.length > 0
      ? session.idiomasDisponibles
      : (locales as readonly string[]);

  function changeLocale(next: string) {
    if (next === locale) return;
    // Doble escritura: la cookie (setLocale) hace que el render del servidor salga ya en el nuevo
    // idioma sin recargar; el PUT /me/preferences lo RECUERDA para esta persona en cualquier equipo.
    void setLocale(next as Locale).then(() => router.refresh());
    void setMyLanguage(next).catch((e) => toastError(e, tRoot));
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

        {/* Idioma */}
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          {t("language")}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup value={locale} onValueChange={changeLocale}>
          {idiomas.map((l) => (
            <DropdownMenuRadioItem key={l} value={l}>
              {tRoot.has(`userMenu.lang_${l}`) ? t(`lang_${l}`) : l.toUpperCase()}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />

        {/* Ajustes de la app (rutas reales existentes) */}
        <DropdownMenuGroup>
          {/* «Configuración de la app» solo a quien tenga algo que configurar: el BE ya filtra el grupo
              g-configuracion por permiso en /me/menu (sus hijos son /configuracion/*). Si no le llega
              ninguna sección, no hay nada que abrir — y ahí dentro está la apariencia CORPORATIVA, que
              pisa la personal, así que no es de cualquiera. Derivado del menú, no de un permiso fijo:
              conceder una sola sección hace aparecer el ítem solo. Handoff configuracion-delicada-solo-admin. */}
          {puedeConfigurar && (
            <DropdownMenuItem asChild>
              <Link href="/configuration">
                <HugeiconsIcon icon={Settings02Icon} className="size-4" />
                {t("appSettings")}
              </Link>
            </DropdownMenuItem>
          )}
          {/* Módulos de tablero = administración de tableros: solo quien los administra. Un call-center
              que solo hace Citas no debe verlo. */}
          {can("tablero.admin") && (
            <DropdownMenuItem asChild>
              <Link href="/configuration/board-modules">
                <HugeiconsIcon icon={DashboardSquare01Icon} className="size-4" />
                {t("boardModules")}
              </Link>
            </DropdownMenuItem>
          )}
          {/* MI apariencia: colores, radio y fondo propios (capa `usuario` de preferencias). La tiene
              cualquier usuario y cualquier rol —incluido el administrador, que también quiere sus
              colores—; la corporativa (sistema, centro y overrides) vive en Configuración.
              See docs/specs/apariencia-personal-en-el-avatar-y-corporativa-en-configuracion.md */}
          <DropdownMenuItem asChild>
            <Link href="/configuration/preferences/appearance">
              <HugeiconsIcon icon={UserCircleIcon} className="size-4" />
              {t("myAppearance")}
            </Link>
          </DropdownMenuItem>
          {/* Cambiar la propia contraseña sin depender del admin: antes solo se llegaba a /change-password
              cuando el sistema forzaba el cambio. Handoff configuracion-y-cambiar-clave. */}
          <DropdownMenuItem asChild>
            <Link href="/change-password">
              <HugeiconsIcon icon={SquareLock02Icon} className="size-4" />
              {t("changePassword")}
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
