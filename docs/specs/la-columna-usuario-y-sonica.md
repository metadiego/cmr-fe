# La columna «usuario» ya trae al propietario, y Ondas de Choque pasa a llamarse Sónica

**BE:** desplegando el 2-oct-2026. **FE:** dos cambios pequeños, los dos cosméticos.

## 1. La columna del módulo de citas

**Regla del dueño:** esa columna debe llevar **siempre, sin excepción, el usuario propietario** —
el agente de call center que captó al paciente, de cuya cartera cobra. No es quien agendó esa cita
suelta.

**Qué cambió en el BE:** el campo `citadoPor` de la fila ahora trae al **propietario del paciente**,
y solo cae a quien agendó la cita cuando el paciente no tiene dueño registrado. **El FE no tiene
que cambiar de campo**: es el mismo `citadoPor` de siempre, ahora con el dato correcto.

Medido en producción antes del cambio: 1.708 de 3.043 citas salían con esa celda vacía, y 1.448 de
ellas eran de pacientes que **sí** tenían dueño. Esas se llenan solas.

**Lo único que pide el dueño en el FE:** renombrar el encabezado de la columna de «Citado por» a
**«Usuario»** (`User` en inglés). El nombre del campo en la API no cambia.

En la ficha del paciente hay además dos campos nuevos para pintarlo donde haga falta:

```
GET /api/v1/pacientes/:id → creadoPorPersonalId, creadoPorNombre
GET /api/v2/patients/:id  → createdByStaffId,    createdByName
```

## 2. «Ondas de Choque» pasa a llamarse «Sónica»

Cosmético: los usuarios no entendían el nombre. **Ya está hecho en producción**, en los dos centros
— era un dato, no código:

```
GET /api/v1/frontdesk/tabs → { "clave": "ondas_choque", "nombre": "SÓNICA",
                               "labelKey": "frontdesk.pestana.ondas_choque" }
```

La **clave** sigue siendo `ondas_choque` a propósito: es lo que usan el motor de tableros, el
inventario y las facturas, y cambiarla rompería el histórico. Solo cambia lo que se lee.

**Lo que falta en el FE:** la traducción de `frontdesk.pestana.ondas_choque`, que hoy
probablemente dice «Ondas de Choque»:

- español → **Sónica**
- inglés → **Sonic**

Si el FE no tiene esa clave traducida y pinta el `nombre` del BE, ya sale «SÓNICA» sin tocar nada —
pero entonces en inglés también saldría «SÓNICA», y por eso conviene la clave.
