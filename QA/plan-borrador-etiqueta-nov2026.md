# Plan — Etiqueta BORRADOR en OC, Cierre, Proforma de Exportación y OC de Materiales — nov-2026

Fecha: 2026-11-07 · Alcance QA: `borrador-etiqueta-nov2026`

## Decisiones del usuario (2026-11-07)

- La etiqueta BORRADOR (celeste, como OC v3; no marca de agua) aplica a: OC de fruta, Cierre Comercial,
  Proforma de Exportación y OC de Materiales ("aplica lo mismo pero solo a OC").
- Proforma de Exportación: control de copia **como OC y Cierre** — vista previa/descarga con BORRADOR;
  "Emitir documento" genera el PDF oficial (sin etiqueta) y lo registra; reimpresiones COPIA con fecha.
- Movimiento y Guía de despacho del Movimiento: sin cambios (mantienen marca de agua).

## Cambios

1. `ui/Encabezado.tsx` (plantillas v1): prop opcional `marca { tipo, texto, fecha? }` → etiqueta bajo el folio.
   CSS `.doc-estado*` en `ui/print-css.ts` (mismos colores que `.oc3-estado`).
2. `templates/orden-compra-material/v1`: deja de pasar `marcaAgua` a `Documento`; pasa `marca` al Encabezado.
3. `templates/proforma/v1`: idem, con texto bilingüe (BORRADOR/COPIA · DRAFT/COPY según `d.idioma`). La
   variante FACTURA (`factura-exportacion`, `controlCopia: false`) nunca recibe marca.
4. `documentos.registry.ts`: `proforma.controlCopia: true` (habilita `POST /documentos/proforma/:id/emitir`
   con nivel TOTAL en `FACT_EXPORTACION`). `marcarEmitidaEnOrigen` es no-op para Proforma.
5. fas-web `proforma-detalle-view.tsx`: "Ver PDF" abre `DocumentoPreviewDialog` (tipo `proforma`,
   `puedeEmitir = puedeEscribir && estado EMITIDA`).
6. `Docs/cobranza.md`: nota de supersesión del `controlCopia: false` de la Proforma.

## Riesgos

- "Ver Proforma" desde la Factura sigue abriendo el PDF bajo demanda → sale con BORRADOR.
- Proformas existentes no tienen PDF oficial hasta emitirlo una vez.
- OC v3 y Cierre v2 no se tocan.
