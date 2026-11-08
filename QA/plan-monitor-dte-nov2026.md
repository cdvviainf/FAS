# Plan — Monitor DTE (documentos electrónicos emitidos) — nov-2026

Fecha: 2026-11-07 · Alcance QA: `monitor-dte-nov2026`

## Pedido del usuario
Dentro de Facturación, un monitor de documentos electrónicos: por ahora solo los **emitidos y firmados**, con su
**estado SII**, y las funciones de **descargar XML y PDF**.

## Decisiones (propuesta aprobada por el usuario, 2026-11-07)
- Fuente: `DocumentoDte` con `estado = GENERADO` y folio (todos los orígenes: Factura Exportación 110, Factura
  Nacional 33/34, NC 61/112, Guía de despacho de Embarque 52 y de Movimiento 52). El Generador DTE aún no emite.
- Estado SII persistido en `DocumentoDte` (migración `20261107120000_monitor_dte`): `estadoSii`
  (`PENDIENTE/ACEPTADO/RECHAZADO`), `estadoSiiGlosa`, `estadoSiiConsultadoEn`. Backfill: facturas desde su estado
  (APROBADA→ACEPTADO, RECHAZADA→RECHAZADO + glosa); el resto de GENERADO → PENDIENTE.
- `marcarGenerado` deja `estadoSii = PENDIENTE`.
- "Consultar estado SII": factura timbrada (ENVIADA_SII/APROBADA) → su `consultarEstadoSii` (mismos efectos que el
  botón del detalle, que ahora además persiste el veredicto en `DocumentoDte`). Guías, NC y facturas no timbradas
  (anuladas/rechazadas) → consulta genérica `actualizarEstadoEmitido` + `interpretarEstadoSii` (fail-safe), solo
  actualiza `DocumentoDte`.
- Seguimiento automático extendido: tipo `documento-dte` en `dte-seguimiento-sii.queue.ts` (id = DocumentoDte.id).
  Se encola al firmar guías y NC (best-effort, no revierte el timbrado) y el resync de arranque incluye los
  `DocumentoDte` GENERADO con `estadoSii = PENDIENTE` que no son facturas.
- Permiso: ítem nuevo `FACT_MONITOR_DTE` (Gestión Comercial › Facturación y Cobranza), acceso inicial = nivel de
  `FACT_NACIONAL`. Con LECTURA: ver, descargar y consultar.

## API (`/api/monitor-dte`)
- `GET /` — filtros `tipoDte`, `estadoSii`, `fechaDesde`/`fechaHasta` (sobre `generadoEn`), `folio`, `receptor`
  (RUT o razón social del payload, ILIKE), paginación `{ data, meta }`. Fila: tipo, folio, fecha emisión, receptor,
  total (respuesta LibreDTE `total` o monto del origen), origen (etiqueta, código, ruta), estado SII.
- `POST /:id/consultar-sii`, `GET /:id/xml`, `GET /:id/pdf` (PDF timbrado vía LibreDTE).

## Frontend
- `/dashboard/facturacion/monitor-dte` + entrada de menú "Monitor DTE". Tabla con filtros, badge de estado SII
  (glosa en tooltip/rojo si rechazado), enlace al documento de origen, acciones PDF / XML / Consultar SII.

## Riesgos
- Guías y NC ya emitidas parten en PENDIENTE hasta la consulta o el resync.
- Monto/fecha dependen de la forma de la respuesta de LibreDTE (fallback al origen / generadoEn).

## QA ronda 1 (2026-11-07)
- FAS-MDTE-R1-001 (Media): fechas inválidas / rango invertido → corregido: `fechaIso` valida fecha calendario real
  y el schema exige `fechaDesde <= fechaHasta` (400 de validación). Frontend: `min`/`max` en los date inputs.
- Zona horaria: **decisión del usuario** — los límites del día se calculan en `America/Santiago` (offset −03/−04
  tomado al mediodía del día), independiente de la TZ del servidor.
- Apertura del PDF con `window.open` tras await: se mantiene (mismo patrón que el resto de la app).

## Ajuste 2026-11-08 (pedido del usuario)
- Fechas por defecto = inicio y término de la temporada activa (`fechaInicio`/`fechaTermino` del listado de
  temporadas que ya usa el `TemporadaProvider`). Al cambiar la temporada se reaplica su rango (el usuario puede
  ajustarlo a mano). La consulta espera a conocer las fechas de la temporada para no listar todo primero; si la
  temporada no aparece en el listado, no bloquea.

## QA ronda 3 (2026-11-08)
- FAS-MDTE-R3-002 (Media): el rango por temporada dependía de `CONFIG_TEMPORADAS`. **Decisión del usuario:** la
  temporada es un concepto transversal a todas las transacciones → **lectura de temporadas para cualquier usuario
  autenticado**: `GET /api/config/temporadas`, `GET /api/config/temporadas/:id` y `GET /api/config/temporadas/predeterminada`
  solo exigen `requireAuth` (flag `lecturaAutenticados` en `MantenedorConfig`). Crear/editar/eliminar siguen con
  `CONFIG_TEMPORADAS` TOTAL. Arregla también el selector global de temporada para perfiles sin ese ítem.
- Monitor: si las temporadas no cargan (error) o la temporada activa no aparece, no se bloquea la consulta y se
  muestra el aviso "No se pudo cargar la temporada; filtra por fechas manualmente".

## QA ronda 4 (2026-11-08)
- FAS-MDTE-R4-003 (Media): tras aplicar una temporada, cambiar a otra ausente (o el reset por cambio de empresa)
  conservaba el rango anterior → corregido: el rango queda asociado a la temporada para la que se calculó
  (`rango.clave`). Si la temporada actual (o null) no coincide, la consulta se deshabilita hasta resolver: con
  fechas → se aplican; sin temporada / ausente / error → fechas en blanco + aviso. Mientras el provider
  reinicializa (`isLoading`) o el listado de temporadas carga/refresca, no se resuelve ni se consulta.

## QA ronda 5 + arbitraje (2026-11-08)
- FAS-MDTE-R5-004 (Media, árbitro: BUG_REAL): en el primer render tras cambiar de empresa se podía consultar con
  el rango anterior → corregido: la vigencia del rango es por **empresa + temporada** (`rango.empresaId` +
  `rango.clave`), y la query solo se habilita con `rangoVigente && !resolviendo`.
