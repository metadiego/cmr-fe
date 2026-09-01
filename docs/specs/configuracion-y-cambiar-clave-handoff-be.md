# FE — Configuración lleva a una ruta vacía, y no hay dónde cambiarse la contraseña

Encontrado por el dueño el 25-ago-2026 y verificado leyendo el repo. Dos fallos concretos, los dos
del FE, con el diagnóstico hecho para que no haya que investigarlo otra vez.

## 1. «Configuración de la app» abre una ruta que no existe

`components/user-menu.tsx:135` enlaza a **`/configuracion`**, y esa página **no existe**:
`app/(app)/configuracion/` tiene solo subcarpetas, ninguna `page.tsx` propia. Por eso el usuario
aterriza en un sitio inexistente y concluye —con razón— que la configuración no sirve.

Las nueve secciones **sí existen y funcionan**, cada una con su `page.tsx`:

| Ruta | Qué configura |
|---|---|
| `/configuracion/apariencia` | Apariencia corporativa (colores, radio, fondo del centro) |
| `/configuracion/menu` | El menú: qué ve cada rol |
| `/configuracion/tableros` | Tableros y sus columnas |
| `/configuracion/factura` | Factura: envío gravado, series, impuestos |
| `/configuracion/numeracion` | Numeración de facturas y devoluciones |
| `/configuracion/formatos` | Formatos de impresión |
| `/configuracion/datos-paciente` | Campos de la ficha del paciente |
| `/configuracion/requeridos` | Requisitos por servicio |
| `/configuracion/panel-enfermeria` | Panel de enfermería |

**Qué hace falta:** una página índice en `/configuracion` que las liste, con su nombre y una línea de
qué hace cada una, y que respete el permiso de cada sección (quien no administra tableros no debería
ver esa tarjeta). Es la puerta de entrada a todo lo configurable: hoy el trabajo está hecho y
escondido detrás de un 404.

## 2. Nadie puede cambiarse la contraseña por su cuenta

La pantalla existe —`app/(app)/change-password/page.tsx`— pero **solo se llega a ella cuando el
sistema fuerza el cambio**: `components/session-gate.tsx` redirige ahí mientras
`mustChangePassword` está activo. Ningún sitio la enlaza (verificado con grep en `app/` y
`components/`: la única mención es la del propio gate).

Consecuencia real: los veinte usuarios de prueba entran con una contraseña temporal común
(`Cmr2026Prueba`) y **no tienen manera de ponerse la suya** salvo pedirle al administrador un código
de un solo uso. Eso convierte cada cambio de clave en trabajo del dueño.

**Qué hace falta:** una opción **«Cambiar mi contraseña»** en el menú del avatar
(`components/user-menu.tsx`, junto a «Mi apariencia»), que lleve a `/change-password`. El backend no
necesita nada nuevo: esa pantalla ya cambia la clave en Supabase Auth y avisa al backend con
`markPasswordChanged` (`lib/api/auth.ts`). Solo hay que hacer que la pantalla pida la contraseña
actual cuando el cambio es voluntario (no forzado), o dejarla igual si se acepta el mismo flujo.

## Lo que el backend ya da y no hay que pedir

- Cambio de contraseña: lo hace el cliente de Supabase; el backend solo recibe el aviso.
- Preferencias corporativas y personales: `GET/PUT` de preferencias, ya en uso por la apariencia.
- Menú por rol y permisos: `GET /me/menu` y los permisos del principal.

## Y una petición del dueño que sigue pendiente

Los ajustes del contador de presentes (`frontdesk.presentes`: modo, figura, color, ver números,
latido, ocultar vacíos, compacta) van en estos dos sitios, no en el frontdesk:
**corporativa en `/configuracion`** y **personal en el menú del avatar**, con la corporativa por
encima. Ver `presentes-por-servicio-handoff-be.md`.
