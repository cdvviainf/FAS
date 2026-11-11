# Plan — Solicitud de Pago a Productores (2026-11-10)

Supersede `Docs/productores.md` §4.2 (SolicitudPago sobre CuotaDocumentoCompra, no implementado): por ahora el pago se basa en la OC y su condición de pago, sobre lo REALMENTE despachado.

## Decisiones del usuario
1. Despachado = Embarque con despacho confirmado y no anulado (`despachadoEn != null && despachoAnuladoEn == null`, embarque no eliminado).
2. Se paga por cuotas de la condición de pago de la OC; se puede solicitar un monto distinto, asociado a la cuota (≤ saldo de la cuota).
3. Si un pallet no calza con la OC, el precio queda pendiente y NO se puede solicitar el pago de ese grupo.
4. El pago se registra en la cta. cte. como DEBE al productor, "Pago factura N° X"; el N° de factura del productor se registra al pagar (mientras no exista la captura de documentos de compra).
5. Solicitar NO genera movimiento en cta. cte.; recién "Confirmar pago" lo genera.
- Diseño aprobado ("Ok, avanza con la Solicitud de Pago"): permiso aparte para confirmar el pago; la cta. cte. queda en la moneda de la OC (USD), sin conversión.

## Cálculo de lo despachado (`solicitudes-pago.calculo.ts`, puro)
- Base: pallets no eliminados cuya Recepción (no eliminada) tiene OC (no eliminada) del productor, en Embarques despachados. Grupo = (OC, Embarque).
- Precio por línea de pallet: líneas de OC con especie + variedad + embalaje (artículo) iguales; categoría y etiqueta iguales cuando la línea de OC las define; calibre en la lista de la línea (sin lista = cualquiera); se prefieren las líneas con etiqueta específica. Debe resultar UN precio por caja: sin calce, sin precio o precios distintos → línea "pendiente" y el grupo queda bloqueado (cuotas no solicitables), mostrando el motivo.
- Monto grupo = Σ cajas × precio. Kilos = Σ cajas × kgNetoEnvase (null si falta alguno).
- Cuotas = OrdenCompraCuotaPago (orden por id): PORCENTAJE → % × monto; MONTO_UNITARIO → valorUnitario × cajas (o × kilos si unidad KG; si faltan kilos → bloqueo). Si todas son % y suman 100, el redondeo se ajusta en la última. OC sin condición de pago → una cuota implícita 100% (ordenCompraCuotaPagoId null). Cuota en moneda distinta a la de la OC → bloqueo. OC a GRANEL → bloqueo (la recepción de granel no genera pallets).
- Vencimiento: ZARPE = fecha de zarpe del Embarque (manual o AGL360) + plazo; ARRIBO = fechaArribo + plazo; FACTURA / ENVIO_DOCUMENTOS = sin fecha (pendiente de la captura de facturas).
- Saldo de cuota = monto calculado − Σ montoSolicitado en solicitudes no anuladas (al editar se excluye la propia).

## Modelo (migración `20261110200000_solicitud_pago`)
- `SolicitudPago` (tenant; `MODELOS_TENANT`): numero `SP-{AAAA}-{NNNN}` (lock por año, único por empresa), temporadaId (obligatoria, `temporadaParaCrear`), entidadProductorId, monedaId (de las OC; no se mezclan monedas), fecha, observaciones, estado SOLICITADA/PAGADA/ANULADA, montoTotal, fechaPago, numeroTransferencia, conceptoCtaCteId, pagadoEn/Por, anuladoEn/Por, auditoría.
- `SolicitudPagoLinea`: ordenCompraId, embarqueId, ordenCompraCuotaPagoId?, numeroCuota, fechaVencimiento, montoCalculado (snapshot), montoSolicitado, numeroFactura, movimientoCcId (único), movimientoAnulacionCcId (único).
- Ítems de menú: `PROD_SOLICITUD_PAGO` (PANTALLA, /dashboard/productores/pagos; acceso inicial heredado de PRODUCTORES_PROFORMA) y `PROD_SOLICITUD_PAGO_CONFIRMAR` (ACCION, se asigna a mano). Seed actualizado.

## API (`/api/productores/solicitudes-pago`)
- `GET /despachado?entidadProductorId&ordenCompraId?&embarqueId?&temporadaId?&excluirSolicitudId?` (LECTURA): grupos OC×Embarque con detalle de pallets valorizado, bloqueos y cuotas (monto, solicitado, saldo, bloqueada).
- `GET /` (lista paginada, filtros q/estado/productor/temporada), `GET /:id` (LECTURA).
- `POST /` (TOTAL): `{ entidadProductorId, temporadaId?, observaciones?, lineas[{ ordenCompraId, embarqueId, ordenCompraCuotaPagoId|null, montoSolicitado }] }`. En una transacción con lock por productor: recalcula lo despachado, valida cada cuota (existe, no bloqueada, monto > 0 y ≤ saldo), misma moneda, sin repetidas; correlativo; crea.
- `PUT /:id` (TOTAL, solo SOLICITADA): reemplaza líneas/observaciones con la misma validación (excluyendo la propia solicitud del saldo); no cambia moneda.
- `POST /:id/confirmar-pago` (permiso `PROD_SOLICITUD_PAGO_CONFIRMAR` TOTAL): `{ fechaPago, conceptoCtaCteId, numeroTransferencia?, facturas[{ lineaId, numeroFactura }] }` — N° de factura obligatorio en TODAS las cuotas. Transacción con lock por productor: CAS SOLICITADA→PAGADA; concepto bloqueado `FOR UPDATE`, de la empresa, no eliminado/bloqueado, naturaleza DEBE o AMBOS (R6); un DEBE por cuota (glosa "Pago factura N° X — SP-…", referencia = número, moneda de la solicitud, temporada de la solicitud, fecha = fecha de pago).
- `POST /:id/anular` (TOTAL): SOLICITADA → ANULADA (libera saldo). PAGADA → requiere además `PROD_SOLICITUD_PAGO_CONFIRMAR` TOTAL; ANULADA + contramovimiento HABER por cuota del mismo concepto ("Anula pago factura N° X — SP-…"). Los movimientos son inmutables (R5: corrección por reverso); el HABER de reverso sobre un concepto solo-DEBE se considera parte de R5 (reverso del propio movimiento), no una imputación sujeta a R6.

## PDF
- Documento `solicitud-pago` v1 (motor de documentos, sin control de copia): cabecera corporativa, empresa y productor, tabla de cuotas (OC, Embarque, cuota con plazo y referencia, vence, monto cuota, solicitado, N° factura), total, datos del pago si está pagada, observaciones, firmas.

## Web
- Menú "Solicitud de Pago" habilitado. `/dashboard/productores/pagos` (listado con búsqueda y estado), `/nueva` y `/[id]`.
- Formulario: productor → lo despachado por OC × Embarque (encabezado con zarpe, pallets, cajas y monto; avisos de bloqueo; detalle de pallets desplegable con precio o motivo de pendiente) y sus cuotas (checkbox, vence, monto, ya solicitado, saldo, monto a solicitar editable, por defecto el saldo). Total y moneda; no mezcla monedas. Aviso y botón deshabilitado sin temporada. Crear abre la solicitud; Guardar cambios vuelve al listado.
- Detalle: estado, Ver PDF, Confirmar pago (con permiso; diálogo con fecha, concepto DEBE/AMBOS, N° transferencia y N° factura por cuota; no se cierra al pinchar fuera), Anular (Solicitada con TOTAL; Pagada con permiso de confirmar). Solicitudes pagadas/anuladas en solo lectura con su N° de factura.

## Verificación hecha por Claude
- tsc fas-api y fas-web OK; ESLint de los archivos nuevos OK; `prisma validate` OK.
- Migración aplicada en fas_test; consultas del módulo ejecutadas en runtime contra fas_test sin error.
- Cálculo puro probado con calce/no calce, % con redondeo y cuota por kilo.

## Ronda 2 — decisiones del usuario sobre QA ronda 1
- SPP-001 (Alta) — CORREGIR (aprobado): el mantenedor `conceptos-cta-cte` admite LECTURA también con `PROD_SOLICITUD_PAGO_CONFIRMAR` (`lecturaItemsAdicionales`), para que tesorería cargue los conceptos en "Confirmar pago".
- SPP-002 (Media) — ACEPTADO sin cambio (usuario: "déjalo como está"): montos como number redondeados a centavos, mismo contrato que Proforma/Factura/Cobranza; persistencia en Decimal.
- Temporada (pregunta de Codex) — DECISIÓN del usuario: "Solo de la temporada activa". Lo despachado se lista solo de OC de la temporada activa (nueva) o de la temporada de la solicitud (edición); el backend recalcula con ese `temporadaId` al crear/editar, por lo que una cuota de una OC de otra temporada se rechaza. En una solicitud nueva, cambiar la temporada activa descarta la selección.
