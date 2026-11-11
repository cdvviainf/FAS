# Plan — Visor de correos enviados (2026-11-11)

Pedido del usuario: "implementar un visor de envíos de mails dentro del sistema. Debe indicar cuándo se envió, a quién y poder reintentar". Decisiones: (1) "dentro de Herramientas y mueve también Auditoría a este menú"; (2) "El visor es por cada destinatario: si va a 3 personas son 3 líneas en el visor y el reintento es por cada casilla".

## Registro (`CorreoEnviado`, migración `20261111100000_correos_enviados`)
- Tenant (`MODELOS_TENANT`). Una fila POR DESTINATARIO: empresaId, lote (uuid que agrupa el mismo correo), destinatario, asunto, html, origen legible, pdfTipo/pdfId (adjunto), estado PENDIENTE/ENVIADO/FALLIDO, intentos, ultimoError, enviadoEn, reintentadoEn/Por, creadoEn.
- `encolarCorreo` (cola 'correos'): con empresa → crea una fila por destinatario (dedup, sin vacíos) y encola UN job por destinatario (correo individual) con `correoId`. Sin empresa → comportamiento anterior sin registro.
- Worker: éxito → ENVIADO + enviadoEn + intentos; error → intentos + ultimoError y, en el último intento (attempts=3), FALLIDO; el error se relanza para el backoff de BullMQ. El PDF adjunto se regenera al enviar (igual que antes).
- Recordatorio de Solicitud de Inspección: ya no llama `enviarCorreo` directo; pasa por `encolarCorreo` (queda registrado, por destinatario).
- Origen: Solicitudes de Inspección registran "Solicitud de Inspección {código} — Notificación / Modificación / Eliminación / Cierre / Reapertura / Recordatorio". El correo de prueba de Configuración de Correo no se registra (envío directo).
- Cambio de comportamiento aceptado: un correo a N destinatarios ahora sale como N correos individuales (necesario para estado/reintento por destinatario).

## API `/api/correos-enviados` (ítem `CONFIG_CORREOS_ENVIADOS`)
- `GET /` (LECTURA): paginado (default 50), filtros estado, q (destinatario/asunto/origen), desde/hasta (fecha, hasta inclusive). Sin HTML.
- `GET /:id` (LECTURA): incluye HTML.
- `POST /:id/reintentar` (TOTAL): solo si no está PENDIENTE (CAS) → PENDIENTE + reintentadoEn/Por y reencola ESE registro (mismo destinatario/contenido; PDF regenerado).

## Menú / permisos
- Nuevo ítem `CONFIG_CORREOS_ENVIADOS` (PANTALLA, Configuración › Herramientas, /dashboard/configuracion/correos-enviados); acceso inicial heredado de `CONFIG_AUDITORIA`.
- `CONFIG_AUDITORIA` pasa de la sección Sistema a Herramientas (UPDATE en la migración + seed + nav-config). Ruta sin cambio.

## Web
- Pantalla "Correos Enviados": filtros (búsqueda, estado, desde, hasta), tabla por destinatario (fecha, destinatario, asunto, origen, estado con error, enviado, intentos), detalle con el HTML en iframe `sandbox` y botón Reintentar por fila (con TOTAL, no PENDIENTE). Refresca cada 5 s mientras haya pendientes.

## Verificación hecha por Claude
- tsc fas-api y fas-web OK; ESLint de los archivos nuevos OK; migración aplicada en fas_test; repositorio ejecutado en runtime contra fas_test (crear, error final, enviado, listar con filtros, reintento).

## Ronda 2 — correcciones aprobadas por el usuario ("Si")
- CE-QA-001: si falla el encolado (envío inicial, por destinatario, o reintento), el registro pasa a FALLIDO con "No se pudo encolar el envío: …" (reintentable); en el envío inicial se sigue con los demás destinatarios y luego se propaga el primer error.
- CE-QA-002: el frontend envía `desde`/`hasta` como ISO con zona (inicio del día local de "desde" e inicio del día siguiente a "hasta", exclusivo; respeta cambio de horario); el backend filtra con esos límites exactos (`z.string().datetime({ offset: true })`).
- Pregunta de Codex (decisión del usuario): `intentos` es ACUMULADO en toda la vida del registro (increment por intento, incluidos los reintentos).
