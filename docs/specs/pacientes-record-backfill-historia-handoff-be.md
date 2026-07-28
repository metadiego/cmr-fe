# HANDOFF BE — Backfill del número de récord desde legacy `Mclientes.Historia`

> Competencia BE/migración (no FE). El frontdesk ya proyecta la columna récord (`fd_record`) correctamente;
> el problema es de DATO: a ~60% de los pacientes nuevos les falta el `record`.

## Síntoma (verificado en prod)
- En el board del frontdesk, las filas (incluidas las de auto-presente al pagar) muestran el **récord en blanco**
  para muchos pacientes. Ej.: paciente `-DORIA RICARDO J GONZALEZ PORRATA` → `record: null`, `numeroHistoria: null`.
- Muestreo `GET /facturas/buscar-paciente`: ~**8 de 20** pacientes traen `record`; el resto null.

## Regla de negocio (dueño)
Todo paciente que llega al frontdesk YA fue visto por el médico y se le asignó número de récord ANTES de pasar a
facturación. Por tanto, en ese punto SIEMPRE debería tener récord. Si falta, es el **script de migración**, no el flujo.

## Causa raíz (a corregir)
El migrador NO está trayendo el récord del legacy. En la tabla legacy **`Mclientes`** el campo del número de récord
se llama **`Historia`** (clave del cliente: `codclien`). Hay que mapear `Mclientes.Historia` → `pacientes.record`
(campo nuevo; ver [[be-pacientes-docid-rename]]/[[pacientes-v2-migracion]]).

## Evidencia legacy (SQL Server `farmacias`, Bayamón)
- `Mclientes`: 160,579 filas; **99,549** con `Historia` no vacío (~62%).
- Valores basura a filtrar: `Historia = ''` o `'No asign'` → tratar como sin récord (no migrar esos como récord).
- Ejemplos: `codclien 99999 → Historia 64833`, `99997 → 64984`, `99995 → 64887`.

## Pedido
1. Backfill: para cada paciente migrado, si `pacientes.record` está vacío, tomar `Mclientes.Historia`
   (join por la clave con que se migró el cliente, típicamente `codclien`) cuando sea un récord válido
   (numérico / no `''` ni `No asign`).
2. Corregir el script de migración/ETL para que en adelante mapee `Historia → record` (y `numeroHistoria` si aplica).
3. Idempotente y multi-tenant (por centro). Verificar contra un paciente conocido tras correr.

## Nota
El FE no cambia: en cuanto el `record` exista, el board (`fd_record`) y el auto-presente lo muestran solos
(confirmado en vivo con el paciente `SONIA MEDINA SANTANA`, récord `55682` → la fila de frontdesk mostró 55682).
