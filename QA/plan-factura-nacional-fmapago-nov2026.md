# Plan — Factura Nacional: condición de pago + Proforma de Servicios sin cuotas (2026-11-11)

Decisiones del usuario (OK):
- (2) "En la proforma de servicios, al enviar a LibreDTE, no se deben mandar las cuotas. Solo aplica a estos casos, el resto de las facturas sigue igual." + "la fecha de vencimiento se mantiene como fecha única".
- (4) "En la factura nacional debe haber un apartado que diga condición de pago: Contado si la fecha de vencimiento es igual a la de emisión, sino Crédito" (OK a la regla propuesta).

## 1. Proforma de Servicios a Productor → Factura Nacional sin MntPagos
- `mapFacturaNacionalADte` acepta `omitirMntPagos`; con true NO emite `IdDoc.MntPagos`, pero SÍ `FchVenc` (vencimiento de la última cuota con fecha).
- `factura-nacional.service` (envío del borrador al SII) pasa `omitirMntPagos: factura.origenClase === 'PROFORMA_PRODUCTOR'`. Facturas desde Proforma de Materiales y Venta Nacional sin cambios. Las cuotas internas (cobranza) se siguen generando igual al firmar.

## 2. Condición de pago Contado / Crédito (todas las Facturas Nacionales 33/34)
- `condicionPagoSii(cuotas, fechaEmision)`: sin cuotas (sin condición de pago) → Contado; alguna cuota sin fecha (zarpe/arribo/envío desconocido) → Crédito; si la fecha de vencimiento (máxima de las cuotas) es el mismo día que la emisión → Contado; si no → Crédito.
- DTE: `IdDoc.FmaPago` = 1 (Contado) o 2 (Crédito) con las mismas cuotas que se informan (fecha de emisión = fecha del documento).
- Detalle web (`GET` de la factura): `condicionPagoSii { etiqueta, fechaVencimiento }`; la pantalla muestra "Condición de pago: Contado/Crédito · vence dd-mm-aaaa" (solo lectura, se recalcula con lo guardado).
- La Nota de Crédito 61 no cambia.

## Fuera de alcance (respuesta, no código)
- Razón social del emisor: sale de Configuración → Empresas (`Empresa.razonSocial`, cargada como "Frutera Agrosan SpA" por la migración inicial); el usuario la corrige en el mantenedor.
- Correo al cerrar la inspección: ya existía (asignados NOTIFICAR + ACUDIR + solicitante).

## Verificación hecha por Claude
- tsc fas-api y fas-web OK; ESLint del feature OK.

## Ronda 2 — correcciones aprobadas por el usuario ("Ok con las 2")
- FAS-FN-FMAPAGO-001: el detalle calcula la condición con `fechaDocumento` (misma fecha que el DTE); `fechaEmision` solo como respaldo de facturas antiguas sin fecha del documento.
- Pregunta de Codex (FchVenc): `FchVenc` = vencimiento MÁS TARDÍO de las cuotas con fecha (no la última del arreglo), mismo criterio que Contado/Crédito.
