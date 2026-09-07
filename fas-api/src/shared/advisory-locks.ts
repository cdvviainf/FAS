// Namespaces de pg_advisory_xact_lock(namespace, key) compartidos entre
// módulos. Un lock solo sirve para serializar dos flujos entre sí si AMBOS
// usan el mismo namespace numérico — por eso estos valores viven en un solo
// lugar en vez de constantes locales por archivo (que ya existen para los
// locks de generación de correlativo, que no necesitan coordinarse con nada
// más). Elegir números que no choquen con los ya definidos localmente:
// 490234 (NotaVenta correlativo), 490236 (OrdenCompra correlativo), 490237
// (Recepcion correlativo), 490238 (Recepcion proceso), 490239 (OrdenCompra
// proceso), 490240 (Documentos emitidos), 490241 (NotaVentaDetalle cajas
// comprometidas), 490242 (Movimiento proceso), 490243 (Embarque despacho),
// 490244 (OrdenCompraMaterial proceso), 490245 (OrdenCompraMaterial
// correlativo), 490246 (Embarque generar/solicitud de reserva), 490247
// (ProformaMaterial correlativo), 490248 (ProformaMaterial proceso).

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

// Serializa desvincular un pallet contra confirmar despacho (embarques.
// repository.ts) — EP-QA-002, QA ronda 2: un filtro de relación
// (`embarque: { despachadoEn: null }`) en el UPDATE de Pallet no bloquea la
// fila de Embarque, así que una confirmación de despacho concurrente podía
// colarse en la ventana antes de que el UPDATE del pallet commiteara. Ambas
// operaciones toman este lock por embarqueId antes de leer/escribir.
export const LOCK_NAMESPACE_EMBARQUE_DESPACHO = 490243

// Serializa el CRUD de cabecera/líneas de una OrdenCompraMaterial
// (materiales/ordenes-compra.repository.ts) contra la confirmación de un
// Movimiento que la referencia (materiales/movimientos.repository.ts R22) —
// mismo rol que LOCK_NAMESPACE_ORDEN_COMPRA_PROCESO para la OC de fruta.
// Clave: ordenCompraMaterialId.
export const LOCK_NAMESPACE_ORDEN_COMPRA_MATERIAL_PROCESO = 490244

// Serializa "Solicitar Reserva" (ventas.md §4.3, IMP-QA-R1-012, QA ronda 1):
// sin esto, dos intentos concurrentes para el mismo Cierre Comercial pasan
// ambos el pre-check de numeroInstructivo (ninguno creó nada todavía) y
// ambos llaman a AGL360, generando dos solicitudes externas aunque solo una
// gane la creación local después. Clave: notaVentaId (generarEmbarque) o
// embarqueId (solicitarReservaParaEmbarque, reintento manual) — mismo
// namespace, dos claves distintas según el punto de entrada, ninguna
// colisiona entre sí en la práctica (un notaVentaId y un embarqueId son
// ambos autoincrement de tablas distintas, pero aun si coincidieran
// numéricamente el efecto es solo serializar de más, nunca de menos).
//
// Nota: originalmente este namespace usaba 490245, el mismo valor que
// LOCK_NAMESPACE_ORDEN_COMPRA_MATERIAL_NUMERO (constante local en
// materiales/ordenes-compra.repository.ts) — colisión no detectada porque
// esa constante vive fuera de este archivo centralizado. Corregido a 490246
// antes del primer despliegue de esta feature (ningún advisory lock persiste
// en disco, así que renumerar es seguro en cualquier momento).
export const LOCK_NAMESPACE_EMBARQUE_SOLICITUD_RESERVA = 490246
