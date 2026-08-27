# FE → BE — Fundir los duplicados que arrastra el legacy (personal, productos, …)

**Fecha:** 2026-08-27 · **Origen:** el dueño. **Esto es migración de datos del BE, no FE.**

## Por qué están duplicados

El legacy eran **dos servidores locales** (Bayamón y Caguas), **mismo esquema, datos separados**. Todo
lo compartido —personal (médicos, técnicos, enfermeras, gerentes…), **productos**, y probablemente
catálogos— estaba **duplicado a propósito**, uno por servidor. Al unificar en una sola base, cada
persona/producto aparece **dos veces**, normalmente con el **mismo `codigoLegacy`**.

Ejemplo real (ya borrado a mano hoy): el médico **cod 333 Kenneth Cintron** existía dos veces
(Bayamón `960eb6e7-…` y Caguas `2b606087-…`), mismo `codigoLegacy=333`.

## El modelo ya es UNO (esto está bien)

`personal` es una sola entidad para todos los roles (capacidad/cargo distinguen médico/técnico/…); las
cuentas de login (`perfiles`) cuelgan por `personalId`. Lo que falta es **deduplicar los datos**, no
cambiar el modelo.

## Lo que hay que hacer en el BE (no en el FE)

1. **Detectar duplicados** por `codigoLegacy` (y, de respaldo, por nombre+apellido normalizados) en
   `personal` y en `productos`.
2. **Elegir el superviviente** (uno por `codigoLegacy`) y **repuntar TODAS las referencias** al id que
   sobrevive antes de borrar el otro: en personal → `citas.medicoId`, `frontdesk_sesiones` (tecnico/
   enfermera/medico), participaciones/sellos, `facturas.medicoId`, y las asignaciones de centro (el que
   sobrevive queda activo en **ambos** centros, que es justo lo que hoy resuelve `personal` multi-centro).
   En productos → líneas de factura, inventario/lotes/movimientos, kits, precios, etc.
3. **Borrar el duplicado** solo después de repuntar. Transaccional; nada de huérfanos.
4. Idealmente, una **prueba** que falle si vuelve a haber dos `codigoLegacy` iguales en `personal`/
   `productos`.

## El caso cod 333 (decisión del dueño)

Kenneth Cintron ya se borró entero. Si el legacy tiene registros que **referencian** el cod 333 y no se
quiere perder la traza, el dueño pide dejar **un** registro con `codigoLegacy=333` y **nombre `N/A`,
apellido `N/A`** («no aplica») como marcador, en vez de romper la referencia. Si nada lo referencia,
queda borrado y ya. Que lo decida el BE al repuntar.

## El FE no necesita cambios

En cuanto los datos queden únicos, las pantallas (selectores de médico/técnico, personal, productos)
muestran una sola entrada por persona/producto sin tocar nada: ya leen la lista tal cual del BE.
