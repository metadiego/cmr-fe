# Alarma del panel de enfermería: activa por defecto y audible

**Pedido del dueño (14-nov-2026):** el sonido del panel debe estar activado por defecto y es muy bajo.

## Qué cambia
- **Activa por defecto.** El contexto de audio se crea al abrir el panel. Si el navegador lo deja
  suspendido (política de autoplay), el PRIMER toque, clic o tecla en cualquier parte de la página lo
  desbloquea. El botón «Activar sonido» solo aparece mientras siga bloqueado, como aviso.
- **Si llega un aviso estando bloqueado**, empieza a sonar en cuanto se desbloquea (antes había que
  esperar al siguiente aviso).
- **Más fuerte.** Pico de 0.25 → 0.95 de la escala completa, el tono más su octava (más presencia en
  altavoces de tableta), pitido más largo (0.55 s cada 1 s) y un compresor para que no sature.
- Los tonos por sección (vitales 880 Hz seno, intravenoso 587 Hz triángulo) no cambian.

## Límite
El volumen del equipo (tableta/PC) sigue mandando: el navegador no puede subir el volumen del sistema.

## Código
`lib/panel/nursing-alarm.ts` (+ `nursing-alarm.test.ts`), usado por `components/paneles/panel-enfermeria.tsx`.
Sin cambios en el BE.
