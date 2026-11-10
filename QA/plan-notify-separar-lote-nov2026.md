# Plan — Notify del Instructivo + Separar cantidades + Incluir LOTE (2026-11-10)

Pedido del usuario (3 cambios). Decisiones: se aplican las recomendaciones de Claude (el usuario dijo "implementa el plan" sin responder las dudas): el cliente que actúa como Notify se lista primero como "el mismo cliente"; la separación tiene texto/valor general, ajustable por línea.
"Factura SII" = Factura de Exportación (DTE 110). Factura Nacional fuera de alcance.

## 1. Instructivo de Embarque: todos los Notify del Cliente
- Antes: el PDF mostraba solo el Notify del Cierre (`nv.notifyId`) si difería del cliente.
- Ahora (plantilla nueva **v3**; v1/v2 congeladas, `plantillaActual: 'v3'`): lista TODOS los Notify asociados al Cliente en su ficha (`EntidadRelacionCliente` rol NOTIFY, en `orden`, omitiendo entidades eliminadas), cada uno con datos completos (razón social, RUT, TaxId, dirección, teléfono, contacto). Si el propio cliente tiene TipoEntidad NOTIFY va primero como "{razón social} (el mismo cliente)" sin repetir datos. Títulos "Notify" (uno) o "Notify N" (varios). Grupos en filas de a dos junto al Consignatario.
- Consignatario sin cambios.
- Backend: `documentos.repository.getNotifiesCliente(clienteId)` (select compartido `entidadDocumentoSelect`); payload `clienteEsNotify?`, `notifies?` (opcionales, v1/v2 los ignoran).

## 2. Separar cantidades (Proforma de Exportación y Factura de Exportación)
- Casilla "Separar cantidades" junto a las de agrupación, con Texto (máx. 80 = NmbItem SII) y Valor unitario general.
- Cada línea de fruta lleva una sublínea (texto, misma cantidad de cajas, valor). El precio de la fruta baja en el valor separado: se conserva el precio total por caja → el total no cambia (ej. 18,00 → 17,50 + 0,50). Precio de fruta y valor separado editables por línea. Desmarcar devuelve el valor al precio de la fruta.
- Modelo: `ProformaLinea` y `FacturaExportacionLinea` + `separacionDescripcion TEXT?`, `separacionPrecioUnitario DECIMAL(14,4)?` (CHECK ambos null o ambos informados). Migración `20261110120000_separacion_cantidades_lineas_export`.
- `precioUnitario` = precio de la fruta; `montoLinea` = round2(cajas×precio) + round2(cajas×separado) (`montoLineaConSeparacion`), así montoTotal = Σ filas mostradas. Cuotas/flete/seguro/cobranza siguen sobre montoTotal.
- API: línea acepta `separacion: { descripcion (1..80), precioUnitario > 0 } | null` (emitir Proforma y actualizar borrador Factura). La Factura hereda la separación de la Proforma al crear el borrador.
- DTE 110: cada sublínea es un ítem aparte (NmbItem = texto, QtyItem = cajas, PrcItem a FOB con el mismo factor). TotItems = ítems emitidos. TotBultos/CantBultos cuentan solo las cajas de fruta (una vez por línea). NC parcial por reclamo sin cambios.
- PDF Proforma y Factura Comercial: el resolver emite la sublínea como fila propia debajo de su línea (sin plantilla nueva: la plantilla v2 solo itera filas; no suma cajas).
- Web: Proforma (emisión) y editor de Factura: control general + fila "↳ texto" con valor editable; al reagrupar (cambiar dimensiones) se reaplica la separación general. Validaciones en pantalla: texto y valor > 0; precio de fruta no negativo. Vistas de detalle muestran la sublínea.

## 3. Incluir LOTE (Proforma y Factura de Exportación)
- Casilla "Incluir LOTE (N°)" junto a Observaciones: agrega `LOTE: {N° de Instructivo del Embarque}` al texto (separado por " / "); desmarcar lo quita. El estado de la casilla se deriva del texto. Respeta 100 caracteres (si no cabe, se recorta el texto del usuario para conservar el LOTE). Deshabilitada si el Embarque no tiene N° de Instructivo.
- Solo frontend (`separacion-lote.ts`); la sugerencia de Proforma devuelve `numeroInstructivo`. La Factura hereda las observaciones de la Proforma.

## Verificación hecha por Claude
- tsc fas-api y fas-web OK; ESLint del feature OK.
- Migración aplicada en fas_test; consultas nuevas (selects) ejecutadas en runtime contra fas_test sin error.

## Ronda 2 — corrección aprobada
- FAS-NSL-R1-001 (Baja, aprobada por el usuario): "Incluir LOTE" opera sobre segmentos separados por " / ". La casilla está marcada solo si existe un segmento completo igual a `LOTE: {N°}`; desmarcar elimina solo ese segmento. Un "LOTE: X" escrito dentro de otra frase no se detecta ni se modifica.
