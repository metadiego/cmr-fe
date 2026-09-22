# Handoff BE → FE: el centro se enciende, y el call-center es uno solo

**De:** cmr-be. **Fecha:** 2026-09-22.

## 1. Nadie está soldado a un centro

Una persona tiene **una** ficha. Dónde trabaja son sus **centros de servicio**, y admite varios:
un médico cubre en el otro centro por permisos o vacaciones, y eso tiene que ser **un clic**.

Ya existe en la API y no hace falta nada nuevo del BE:

- `GET /api/v1/personal/:id/centros` → **todos** los centros del sistema, cada uno con `activo`.
- `PUT /api/v1/personal/:id/centros` con `{ "centroIds": ["…", "…"] }` → deja encendidos
  exactamente esos. Al menos uno: sin centros la persona desaparece de todos los desplegables.
  Exige `personal.update` **en cada centro que se enciende**.

**Lo que toca al FE:** que la ficha de personal muestre esa lista con sus casillas y guarde con ese
PUT. Hoy no hay pantalla para esto, y por eso mover a un médico era una tarea de base de datos.

Verificado en producción: Víctor Ocasio y Gilberto Caraballo quedaron encendidos en los dos centros y
salen en los selects de ambos.

## 2. `/configuration/scheduling-bridge` ya no debe pedir centro para los mapeos

Existe **una sola** oficina de control de citas —físicamente en Bayamón, el headquarter— que atiende a
**todos** los centros. Los mapeos de agente y de médico pasaron a ser **globales**:

- `GET/POST/PUT/DELETE …/agent-mappings` y `…/doctor-mappings` ya **no** filtran ni piden centro.
  Siguen exigiendo el permiso `scheduling-bridge.config`.
- Un código = **una** persona, sujeto por una llave `UNIQUE` en la base. Antes `IF` apuntaba a dos
  Ivelisse distintas según el centro y la comisión caía en la que estuviera primero en la lista.

**Lo que toca al FE:** quitar el selector de centro de la sección de mapeos y mostrar **una** lista.
La configuración del puente (cada cuánto sincroniza, horario de trabajo) **sí** es por centro y se
queda como está.

## 3. Cargos

El catálogo de cargos ahora incluye `facturacion`, `contabilidad` e `inventario` además de los que
ya había. Si el FE pinta la lista, la toma de la API como siempre.
