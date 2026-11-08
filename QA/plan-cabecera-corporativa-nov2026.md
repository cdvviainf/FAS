# Plan — Cabecera corporativa única para todos los documentos PDF — nov-2026

Fecha: 2026-11-08 · Alcance QA: `cabecera-corporativa-nov2026`

## Pedido del usuario
"Normaliza la cabecera de los reportes, se ven muy diferentes." La Orden de Venta (Cierre v2) y la OC se ven
distintas: debe **predominar el tipo de documento en grande y abajo el número de documento y la fecha de
emisión**; la **proporción de las imágenes** (logo y especie) debe ser **idéntica en todos los documentos**.
Referencia: cabecera de la OC v3. Decisión: sí agregar la imagen de la especie a los documentos que tienen especie.

## Cambios
1. `ui/corporativo/componentes.tsx` — `CabeceraCorporativa`: banda (logo izq. / especie der., mismo alto 22 mm,
   `object-fit: contain`), título grande (MAYÚSCULAS) + etiqueta Borrador/Copia a la derecha, línea
   "N° … | Fecha de emisión: …", subtítulo opcional debajo.
   `ui/corporativo/estilos.ts` — `cabeceraCorporativaCss` (extraído de `ocV3Css`, que lo incluye).
2. OC v3 → usa `CabeceraCorporativa` (markup idéntico al anterior; verificado comparando el HTML).
3. Cierre v2 → usa `CabeceraCorporativa` (N° y fecha bajo el título; subtítulo "Venta internacional/nacional";
   se elimina el recuadro gris de folio y el override de banda 15 mm). Espaciados internos del Cierre ajustados
   para seguir cabiendo en 1 hoja A4 (muestra 5 líneas: ES y EN 1 página).
4. `ui/Encabezado.tsx` (las 12 plantillas v1) → renderiza `CabeceraCorporativa`; props nuevas opcionales
   `especieImagenDataUri`, `etiquetaNumero` (def. "N°"), `etiquetaFecha` (def. "Fecha de emisión").
   `ui/print-css.ts` incluye `cabeceraCorporativaCss`; se elimina el CSS `.doc-estado*` (ya no usado).
5. Imagen de especie (primera línea) en payload + cabecera: Proforma / Factura Comercial, Instructivo de
   Embalaje, Instructivo de Embarque, Solicitud de Inspección (`especieImagenDataUri` opcional en sus schemas).
   Proforma/Factura Comercial: etiquetas "No. / Issue Date" en inglés.

## Riesgos
- Cabecera más alta en las plantillas v1: documentos que cabían justo en 1 hoja pueden pasar a 2.
- (Superseded ronda 1) Las reimpresiones de lo ya emitido conservan su cabecera: se versiona.
- Documentos sin especie (OC Materiales, Proformas Materiales/Productor, Movimiento, Guía, Ficha Productor,
  Generador DTE) muestran solo el logo en la banda.

## QA ronda 1 (2026-11-08) — CAB-CORP-001 (Alta): reimpresiones
**Decisión del usuario: versionar** (Etapa 4 §8 — las plantillas emitidas no se editan, la COPIA sale idéntica).
- `ui/Encabezado.tsx` y `ui/print-css.ts` **restaurados** (idénticos a main): las versiones existentes no cambian.
- Nueva `ui/EncabezadoCorporativo.tsx` (trae su propio `<style>` con `cabeceraCorporativaCss`, así el HTML v1 no
  cambia) y `ui/EncabezadoVersionado.tsx` (`corporativa` → corporativa; si no → `Encabezado` clásico con las mismas
  props) + `conCabeceraCorporativa(Plantilla)`.
- Las 11 plantillas v1 de cabecera simple reciben `cabecera?: 'clasica' | 'corporativa'` (default clásica) y usan
  `EncabezadoVersionado`. En el registro cada documento gana `v2 = conCabeceraCorporativa(V1)` y
  `plantillaActual: 'v2'`: ficha-productor, proforma-productor, proforma-material, documento-manual,
  instructivo-embalaje, solicitud-inspeccion, movimiento, movimiento-guia-despacho, orden-compra-material,
  instructivo-embarque, proforma y factura-exportacion (reusa ProformaV1).
- Cierre Comercial: **v2 restaurada** (idéntica a main); los cambios de cabecera/espaciados pasan a
  `templates/cierre-comercial/v3` y `plantillaActual: 'v3'`.
- OC v3: markup idéntico al anterior (solo cambia el CSS por comentarios y reglas que v3 no usa / títulos ya en
  mayúsculas) → visualmente igual, sin nueva versión.
- Plan corregido: las reimpresiones (COPIA) de lo ya emitido **conservan** su cabecera original.

## QA ronda 2 + arbitraje (2026-11-08) — CAB-CORP-001 PERSISTE → BUG_REAL
Corrección aprobada por el usuario (modelo Cierre v2→v3):
- Las **11 plantillas v1 restauradas** íntegras (idénticas a main). Cada una tiene su **v2 independiente**
  (`templates/<doc>/v2/index.tsx`, copia de v1 con `EncabezadoCorporativo` + imagen de especie), sin parámetros
  ni wrappers sobre la v1. Registro: `v1: XV1, v2: XV2`, `plantillaActual: 'v2'`; factura-exportacion usa `ProformaV2`.
- Eliminado `ui/EncabezadoVersionado.tsx`.
- OC v3 (`templates/orden-compra/v3`) y `ocV3Css` **restaurados** (idénticos a main): la cabecera corporativa
  vive en `cabeceraCorporativaCss` (nuevo, agregado al final de `estilos.ts`) y en `CabeceraCorporativa` (nuevo en
  `componentes.tsx`), cambios aditivos que no alteran OC v3 ni Cierre v2. Cierre v3 = `ocV3Css + cabeceraCorporativaCss`.
- Verificado: `git diff HEAD` vacío para `templates/*/v1`, `cierre-comercial/v2`, `orden-compra/v3`,
  `ui/Encabezado.tsx`, `ui/print-css.ts`. Cierre v3 (muestra 5 líneas) 1 hoja ES y EN.

## QA ronda 3 (2026-11-08) — CAB-CORP-002 (Media): Factura Comercial
**Decisión del usuario:** el título es solo el tipo de documento ("FACTURA COMERCIAL DE EXPORTACIÓN" /
"COMMERCIAL EXPORT INVOICE"). N° = **folio SII** si la factura está timbrada, con "Código interno FEX-…" como
subtítulo; sin folio (o en la Proforma), N° = código interno. Solo `templates/proforma/v2` (v1 intacta).
