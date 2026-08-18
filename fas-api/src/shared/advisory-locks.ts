// Namespaces de pg_advisory_xact_lock(namespace, key) compartidos entre
// módulos. Un lock solo sirve para serializar dos flujos entre sí si AMBOS
// usan el mismo namespace numérico — por eso estos valores viven en un solo
// lugar en vez de constantes locales por archivo (que ya existen para los
// locks de generación de correlativo, que no necesitan coordinarse con nada
// más). Elegir números que no choquen con los ya definidos localmente:
// 490234 (NotaVenta correlativo), 490236 (OrdenCompra correlativo), 490237
// (Recepcion correlativo), 490238 (Recepcion proceso), 490239 (OrdenCompra
// proceso), 490240 (Documentos emitidos).

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
