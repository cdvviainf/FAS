// Namespaces de pg_advisory_xact_lock(namespace, key) compartidos entre
// módulos. Un lock solo sirve para serializar dos flujos entre sí si AMBOS
// usan el mismo namespace numérico — por eso estos valores viven en un solo
// lugar en vez de constantes locales por archivo (que ya existen para los
// locks de generación de correlativo, que no necesitan coordinarse con nada
// más). Elegir números que no choquen con los ya definidos localmente:
// 490234 (NotaVenta correlativo), 490236 (OrdenCompra correlativo), 490237
// (Recepcion correlativo), 490238 (Recepcion proceso), 490239 (OrdenCompra
// proceso), 490240 (Documentos emitidos), 490241 (NotaVentaDetalle cajas
// comprometidas), 490242 (Movimiento proceso).

// Serializa el motor de validación de Recepción (recepciones.repository.ts)
// contra cualquier mutación de la Orden de Compra que esté usando para
// comparar (ordenes-compra.repository.ts: header, líneas, soft delete) —
// QA-RCV-007. Clave: ordenCompraId.
export const LOCK_NAMESPACE_ORDEN_COMPRA_PROCESO = 490239

// Serializa la emisión idempotente de un documento (documentos.repository.ts,
// DOC-QA-003) contra sí misma — dos POST /emitir concurrentes para el mismo
// (tipo, documentoId) no deben insertar dos filas con el mismo hash de
// payload+plantilla. Clave: hashtext(tipo || ':' || documentoId), no solo
// documentoId — el namespace es compartido entre TODOS los tipos de
// documento (Orden de Compra, Instructivo, etc.), así que dos documentos de
// tipos distintos con el mismo id numérico no deben compartir lock.
export const LOCK_NAMESPACE_DOCUMENTOS_EMISION = 490240

// Serializa el chequeo "cajas disponibles" de una línea del Cierre Comercial
// (ordenes-compra.repository.ts addLinea/updateLinea) contra otra OC
// concurrente tomando cajas de la MISMA línea — sin esto, dos OC podrían
// pasar ambas el chequeo de disponible antes de que cualquiera confirme y
// juntas superar el total de la línea. Clave: notaVentaDetalleId.
export const LOCK_NAMESPACE_NOTA_VENTA_DETALLE = 490241

// Serializa el CRUD de líneas, la edición de cabecera y la confirmación de un
// Movimiento (materiales/movimientos.repository.ts) entre sí — sin esto, un
// "confirmar" concurrente con una edición de línea podría aplicar el motor de
// PMP/saldo sobre un detalle a medio escribir, o dos confirmaciones
// simultáneas del mismo movimiento podrían aplicar el efecto dos veces.
// Clave: movimientoId.
export const LOCK_NAMESPACE_MOVIMIENTO_PROCESO = 490242
