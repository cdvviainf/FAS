# Plan — Validación previa (pre-vuelo) en Factura Nacional y Factura de Exportación — nov-2026

Fecha: 2026-11-07 · Alcance QA: `validacion-previa-dte-nov2026`

## Contexto / decisión del usuario

La Guía de despacho DTE 52 (Embarque) y el Generador DTE muestran, antes de ir a LibreDTE, los datos que irán
en el documento con los faltantes en rojo. El usuario pidió igualar:

1. **Factura Nacional** (DTE 33/34 desde Proforma de Materiales, Proforma a Productor y Embarque NACIONAL): no
   tenía panel; el backend validaba emisor/receptor recién al "Enviar borrador al SII".
2. **Factura de Exportación** (DTE 110): el panel mostraba Aduana + transporte + pesos, pero no el receptor;
   el backend no exigía razón social/TAXID/dirección del cliente (solo el largo del TAXID).

## Cambios

### Factura Nacional
- `factura-nacional.service.ts`: `construirValidacionFacturaNacional(factura, emisor)` → `{ emisor, receptor,
  faltantes }` con campos RUT, Razón social, Giro, Dirección, Comuna (dirección/comuna = dirección por defecto).
  `obtenerFactura` adjunta `validacion`. `enviarBorradorSiiInterno` bloquea con la MISMA lista (mismos mensajes
  de antes: "La Empresa emisora no tiene …" / "El cliente no tiene …").
- fas-web: `ValidacionContrapartesPanel` (emisor y receptor, faltantes en rojo, badge "Faltan N"/"Completo"),
  visible mientras la factura es editable (BORRADOR/RECHAZADA). "Enviar borrador al SII" deshabilitado con faltantes.

### Factura de Exportación
- `factura-exportacion.service.ts`: `receptorFactura(embarque)` → campos Razón social, TAXID (NumId = primer
  código del TAXID, fallback identificador; falta si vacío o > 20), Dirección (por defecto). El país
  (nacionalidad) ya se valida en el bloque Aduana. `construirValidacionFactura` agrega `receptor` y suma sus
  faltantes a `faltantes`. `enviarBorradorSii` llama `validarReceptorFactura` (misma lista) tras el guard de largo.
- fas-web `factura-editor.tsx`: tabla "Receptor (cliente)" en el panel "Datos para el SII"; "Enviar borrador al
  SII" deshabilitado (y `validarPrevio` bloquea) mientras haya faltantes.

## Riesgos
- Clientes extranjeros sin TAXID ni identificador o sin dirección por defecto ya no pueden enviarse al SII
  (antes salían sin esos datos).
- El panel se recalcula al recargar el detalle (no en vivo mientras se edita la Entidad en otra pestaña).

## QA ronda 1 (2026-11-07)
- FAS-DTE-PREFLIGHT-QA-001 (Media): TAXID vacío/espacios no caía a `identificador` → corregido con
  `numIdCliente` (TAXID resuelto ?? identificador resuelto), fuente única para panel, gate y payload DTE 110.
- Pregunta de dirección: **decisión del usuario** — se mantiene el criterio vigente (dirección `esPorDefecto`
  y, si ninguna lo es, la primera por código), igual que Guía de despacho, Generador DTE y PDFs. No es faltante.
