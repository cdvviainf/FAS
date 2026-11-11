# Plan — Eliminar / reabrir Recepción con fruta no comprometida (2026-11-11, URGENTE)

Caso real: una Recepción quedó mal; el usuario eliminó sus pallets desde Stock pero no podía volver a cargar: la Recepción VALIDADA no se podía eliminar ni editar (y `tienePallets` contaba incluso pallets eliminados), y la OC quedó RECEPCIONADA (una sola Recepción activa por OC).
Decisión del usuario: "una recepción con fruta no comprometida se debe poder eliminar o modificar" + OK a la propuesta.

## Regla
- Fruta comprometida = algún pallet de la Recepción (vigente o eliminado) con `embarqueId` (reservado/despachado/Solicitud de Pago) o con líneas en un Reclamo (`ReclamoPalletLinea`).
- Sin fruta comprometida, una Recepción VALIDADA puede:
  1. **Eliminarse** (`DELETE /compras/recepciones/:id`, TOTAL): borrado lógico de los pallets que queden vigentes y de la Recepción; la OC RECEPCIONADA vuelve a EMITIDA (puede recepcionarse de nuevo).
  2. **Reabrirse para recargar** (`POST /compras/recepciones/:id/reabrir`, TOTAL, solo VALIDADA): borrado lógico de los pallets vigentes, estado → CARGADA, se limpian las advertencias aceptadas, la OC vuelve a EMITIDA; la cabecera queda editable y se puede subir un Excel corregido.
- Con fruta comprometida: 400 con el detalle (pallet y Embarque/Reclamo, hasta 10).
- Concurrencia: lock de la Recepción (`LOCK_NAMESPACE_RECEPCION_PROCESO`, mismo que carga/edición) + `SELECT … FOR UPDATE` de sus pallets (serializa con una reserva concurrente en Embarque), todo en una transacción.
- CARGADA/RECHAZADA sin pallets vigentes: el DELETE sigue como antes.

## "Pallets" = solo vigentes
- `tienePallets`, `_count.pallets` (detalle/listado → `tienePallets`/`editable`), el re-chequeo dentro de la carga y `marcarRechazada` cuentan solo pallets con `eliminadoEn = null` (una Recepción reabierta conserva los eliminados como historial y debe poder recargarse).

## Web
- Listado de Recepciones (menú de acciones): en VALIDADA, "Reabrir para recargar" (confirmación; luego abre la Recepción) y "Eliminar" (confirmación con texto específico). El backend explica si la fruta está comprometida.
- Texto del aviso en el detalle actualizado.

## Verificación hecha por Claude
- tsc fas-api/fas-web OK; ESLint feature OK; consultas nuevas ejecutadas contra fas_test.
