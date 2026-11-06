# Plan — PDF Cierre Comercial v2 (formato corporativo "Sales Order") — nov-2026

Fecha: 2026-11-06 · Alcance QA: `cierre-pdf-v2-nov2026`
Referencia visual: imagen "SALES ORDER / INTERNATIONAL SALE" enviada por el usuario (1 hoja A4), misma línea
gráfica que la OC v3 (`QA/plan-oc-pdf-v3-nov2026.md`).

## Decisiones del usuario (2026-11-06)

- Bilingüe ES/EN (el motor ya entrega `opciones.idioma`; la v1 actual es solo español).
- **No perder la firma del usuario**: la firma PNG del responsable de venta se estampa sobre la línea de
  firma del vendedor (como en la v1).
- Bloque Embarque: **se quitan** Nave, Naviera, Fecha estimada de zarpe y Puerto de carga. Se mantienen
  Puerto de descarga y Destino final (del Cierre) + condiciones de venta.
- Recuadro **Reclamos / Claims**: texto **editable por empresa** (ES/EN), precargado para Agrosan.
- Datos sin origen: **Seguro** derivado de la Cláusula de Venta (`requiereSeguro` → "Incluido / Included",
  si no "No incluido / Not included"); **Forma de pago**: se agrega `formaPagoId` al Cierre (como la OC);
  **Versión**: se quita.
- Contenido: lo del modelo **más** bloque Notify / Consignatario **y** Calidad / Condición "hasta". Se
  vuelven a mostrar peso bruto por caja y pesos totales (neto y bruto) en la fila TOTAL, como el modelo
  (supersede la decisión del batch 2026-11-05 de quitarlos).

## Plantilla v2 (`templates/cierre-comercial/v2`)

`plantillaActual: 'v2'`; v1 se conserva para reimpresiones. Reutiliza la línea gráfica de la OC v3: se mueven
estilos base e íconos a un módulo compartido (`ui/corporativo/`) usado por OC v3 y Cierre v2 (sin cambio
visual en la OC).

1. Cabecera: logo + imagen de la especie (primera especie de las líneas); título "ORDEN DE VENTA / SALES
   ORDER"; subtítulo según `tipoVenta`: "VENTA INTERNACIONAL / INTERNATIONAL SALE" o "VENTA NACIONAL /
   DOMESTIC SALE"; recuadro "N° {folio}" + "Fecha de emisión"; etiqueta BORRADOR/COPIA (como OC v3, sin
   marca de agua).
2. **Vendedor / Exportador**: razón social, RUT, dirección completa (exportador del Cierre; si no tiene, la
   empresa); Contacto/Email/Teléfono = responsable de venta (nombre, email, whatsapp).
3. **Comprador / Cliente**: razón social, Código interno (`Entidad.codigo`), dirección (dirección del Cierre
   + detalle; si no, la por defecto del cliente), Contacto/Email/Teléfono = contacto comprador del Cierre.
4. **Condiciones comerciales**: Incoterm (Cláusula de Venta), Destino (puerto destino, país), Mercado,
   Moneda, **Calidad hasta / Condición hasta**.
5. **Condiciones de pago**: Forma de pago (nuevo campo), Condición de pago (descripción; sin cuotas).
6. **Notify / Consignatario**: razón social de cada uno (si no hay, "—").
7. **Detalle de productos**: #, especie, variedad, embalaje/artículo, etiqueta, categoría, calibre, pallets,
   cajas/pallet, total cajas, precio unit., monto total, peso neto/caja, peso bruto/caja. TOTAL: pallets,
   cajas, monto, peso neto total, peso bruto total.
8. **Embarque y condiciones de venta**: Puerto de descarga, Destino final (país) · Embalaje (tipos de pallet
   de las líneas), Flete (Tipo de Flete), Seguro (derivado), Tipo de venta (Modalidad de Venta). A la derecha
   el recuadro **Reclamos** (si la empresa tiene texto).
9. **Instrucciones adicionales** = observaciones.
10. Firmas: "{empresa} — Firma autorizada" con la **firma PNG del responsable de venta** + "Cliente — Firma
    autorizada". Pie "Página X de Y".

## Datos nuevos

- `NotaVenta.formaPagoId Int?` (FK compuesta a `FormaPago`, como `OrdenCompra`); en el form del Cierre
  (selector), en create/update/duplicar; validación de pertenencia a la empresa.
- `Empresa.reclamosCierreEs/En String?` (texto) y `Empresa.reclamosCierreRefEs/En String?` (línea de
  referencia, ej. "Protocolo de Reclamos Agrosan — Ver documento adjunto"). Editables en la pestaña
  "Términos OC" de Empresa, renombrada "Términos de documentos" (sección nueva "Reclamos — Cierre
  Comercial"). Endpoint: se extiende `PUT /api/config/empresas/:id/terminos-oc` → payload incluye
  `reclamosCierre { textoEs, textoEn, refEs, refEn }` (o endpoint hermano `PUT .../reclamos-cierre`).
- Migración: columnas nuevas + texto inicial de Reclamos para `AGROSAN` (EN del modelo, ES traducido).

## Riesgos

- Una hoja A4 con ~5 líneas; con más, el detalle continúa en la hoja siguiente.
- Mover estilos de OC v3 a módulo compartido: verificar que el PDF de la OC no cambie.
