# FE → BE — Quién ve «Configuración de la app» y «Módulos de tablero»

Petición del dueño (25-ago-2026, tarde): **«Configuración de la app» solo para gerente y admin**; el
resto de roles no debe tener esa opción. **«Módulos de tablero» solo para admin.**

## El FE ya lo decide con DATOS, no con roles soldados

No hay (ni debe haber) `if (rol === "gerente")` en el FE. Los dos ítems del menú del avatar ya se
derivan así:

| Ítem (menú del avatar) | Cómo se muestra hoy en el FE | Fichero |
|---|---|---|
| **Configuración de la app** | Solo si al usuario le llega alguna sección `/configuracion/*` en `GET /me/menu` (grupo `g-configuracion`) | `components/user-menu.tsx` (`puedeConfigurar`) |
| **Módulos de tablero** | Solo si `can("tablero.admin")` | `components/user-menu.tsx` |

(«Mi apariencia» y «Cambiar mi contraseña» quedan visibles para todos: son personales.)

Como es data-driven, **la política se cumple concediendo permisos/menú en el BE, sin desplegar FE.**

## Lo que hace falta en el BE

### 1. «Configuración de la app» → gerente + admin

Hoy, por el handoff `configuracion-delicada-solo-admin`, el gerente **no** recibe ninguna sección de
configuración en su menú → el FE le esconde el ítem (correcto según ese handoff). El dueño ahora quiere
que el **gerente también lo tenga**.

Para eso, el BE debe darle al rol **gerente** la(s) sección(es) de `g-configuracion` que le tocan (las
que devuelva `GET /me/menu`), y al resto de roles ninguna. En cuanto el gerente reciba ≥1 sección, el
ítem le aparece solo. **Decisión del dueño / BE:** qué secciones exactas ve el gerente (¿todas las de
admin, o un subconjunto — p. ej. apariencia corporativa de su centro, formatos?). El FE pinta lo que
llegue; no filtra por rol.

### 2. «Módulos de tablero» → solo admin

El FE lo gatea con `tablero.admin`. Basta con que **`tablero.admin` lo tenga únicamente el rol admin**
(ni gerente ni nadie más). Si hoy algún otro rol lo tiene, quitárselo. Igual para el editor de tableros
delicado, que ya usa `tablero.config` (ver el handoff de configuración delicada).

## Verificación pedida (con sesiones reales, no la vista previa de admin)

Contra `GET /me/menu` de cada usuario:

- **gerente** (wilma/edgardo): ve «Configuración de la app» (con las secciones que se le concedan) y **no** ve «Módulos de tablero».
- **admin**: ve las dos.
- **atención / recepción / enfermería / inventario / call-center**: no ven ninguna de las dos.

Cuando lo apliques, aviso y lo reverifico en producción con las sesiones reales. El FE no cambia.
