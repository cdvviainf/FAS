# QA — Orden de Compra

> Revisión Codex: 2026-07-24. Fuente funcional: `Docs/compras.md`.
> Alcance: migración, Prisma, API, frontend, permisos y pruebas locales.

## Resultado

**Aprobado para pruebas funcionales de usuario.** Las correcciones de estado,
bloqueo, modo lectura y campos opcionales fueron verificadas. Las 70 pruebas de
integración pasan contra PostgreSQL y ambos repos compilan. `OC-002` y `OC-006`
permanecen aceptados como decisiones/deudas conocidas, no como defectos abiertos
de esta versión.

## Hallazgos

| ID | Severidad | Estado | Hallazgo / evidencia |
|---|---|---|---|
| OC-001 | Alta | Corregido | No existía máquina de estados ni bloqueo posterior a recepción. `ordenCompraUpdateSchema` aceptaba cualquiera de los tres estados y `actualizarOrdenCompra`/`eliminarOrdenCompra` no revisaban el estado actual. |
| OC-002 | Media | Cerrado (2026-08-07, campo eliminado — ver batch calibre/tipo pallet) | `incotermId` forma parte del modelo y del contrato de creación, pero no se captura ni muestra en el formulario; el backend acepta cualquier entero positivo sin FK. |
| OC-003 | Media | Corregido | El modo lectura del frontend no era real: el listado mostraba “Ver detalle” pero abría el mismo formulario editable. |
| OC-004 | Baja | Corregido | Los campos opcionales `notaVentaId` y `facturarAId` no tenían opción para volver a “Sin Cierre”/“Sin definir”. |
| OC-005 | Alta | Corregido | Cobertura automatizada incompleta: faltaban pruebas HTTP, eliminación, transiciones/bloqueo por estado y referencias inexistentes. |
| OC-006 | Bloqueante para datos legacy | Aceptado para desarrollo | La migración elimina `OrdenCompra`, `OrdenCompraItem`, `PagoProductor` y `StockLote.ordenCompraId`. Se acepta únicamente bajo la confirmación previa de que todavía no existen datos transaccionales. Debe reevaluarse antes de aplicarla sobre otro ambiente con datos. |

## Resolución (Claude, 2026-07-24)

- **OC-001 — Corregido.** `ordenCompraUpdateSchema`: el campo `estado` ahora solo acepta `'BORRADOR' | 'EMITIDA'` — `RECEPCIONADA` queda reservado para el futuro flujo de Recepción de Stock (compras.md §4.4), no es una transición manual de este endpoint. `actualizarOrdenCompra`/`eliminarOrdenCompra` (service) ahora verifican el estado actual de la OC y rechazan (422) cualquier intento de editar o eliminar una OC ya `RECEPCIONADA`. En el frontend, el selector de Estado del formulario solo ofrece Borrador/Emitida, y el formulario completo queda de solo lectura (vía `<fieldset disabled>`) si la OC ya está recepcionada. Cubierto por el test "permite eliminar... pero bloquea edición y eliminación tras Recepcionada".
- **OC-002 — Aceptado (mismo patrón que Nota de Venta).** `incotermId` referencia el catálogo genérico `Parametro`, cuyo `TipoParametro` de Incoterms todavía no está dado de alta (mismo caso ya documentado para `clausulaVentaId`/`modalidadVentaId`/etc. en `ventas.md` — ver `notas-venta-instructivo-embalaje.md`). Se deja el campo en el modelo/API para cuando exista el mantenedor, pero se omite del formulario visual mientras no haya catálogo real que ofrecer — no es un olvido, es la misma decisión de diseño ya tomada y aceptada para todos los campos de este tipo en el proyecto.
- **OC-003 — Corregido.** `orden-compra-form.tsx`: se agregó `usePuedeEscribir('compras.ordenes')`; el formulario completo (encabezado, cuotas, líneas) se envuelve en `<fieldset disabled={soloLectura}>`, donde `soloLectura = !puedeEscribir || estado === 'RECEPCIONADA'`. El botón "Guardar cambios"/"Crear" se oculta por completo en modo lectura (no solo se deshabilita), y se muestra un badge indicando la razón ("Solo lectura — sin permiso de edición" o "Recepcionada — no editable"). El botón de volver/cancelar queda fuera del fieldset para que siempre funcione. Nota: `useItemAcceso` sigue leyendo `MOCK_ACCESOS` — es el estado general de todo el proyecto (sesión real vs mock), no un defecto específico de este módulo; queda fuera de alcance de esta corrección puntual.
- **OC-004 — Corregido.** Los selects de "Cierre Comercial (Nota de Venta)" y "Facturar a" ahora incluyen una opción explícita ("Sin Cierre — OC suelta" / "Sin definir", sentinel `__none__` mapeado a `null`) para poder limpiar la selección después de haber elegido un valor.
- **OC-005 — Corregido.** Se agregó `/api/compras/ordenes-compra` a la lista de rutas verificadas en `http.integration.test.ts` (401 anónimo). Se agregaron dos casos nuevos en `ventas-compras.integration.test.ts`: rechazo de `notaVentaId`/`facturarAId` inexistentes, y eliminación (soft delete) + bloqueo de edición/eliminación tras `RECEPCIONADA` (simulando ese estado directamente en BD, ya que no es alcanzable vía API — ver OC-001). Suite completa: `npm run test:integration` → 70/70 OK (antes 67/67).
- **OC-006 — sin cambios.** Ya aceptado en la revisión anterior; se mantiene la misma decisión (sin datos transaccionales confirmados en ningún ambiente compartido).

## Aspectos conformes

- Modelo multilínea con productor, Cierre Comercial opcional, moneda,
  condiciones comerciales, cuotas y auditoría.
- Correlativo `OC-{AAAA}-{NNNN}` protegido con advisory lock por año.
- Productor activo y con tipo `PRODUCTOR`.
- Moneda y maestros vigentes.
- Artículo activo y de tipo `EMBALAJE`.
- Variedad, categoría y calibres pertenecen a la especie.
- Rango de calibres validado por el orden del maestro.
- Cuotas opcionales; cuando existen deben sumar 100%.
- Autorización backend por `COMPRAS_OC`: LECTURA para GET y TOTAL para
  POST/PATCH/DELETE.
- Páginas de listado, alta y edición presentes y generadas por Next.

## Verificación ejecutada

| Verificación | Resultado |
|---|---|
| `npm run test:run` (`fas-api`) | 7/7 OK |
| `npm run test:integration` | 70/70 OK; 5 casos específicos de OC |
| `npx prisma validate` | OK |
| `npx prisma migrate status` | 26 migraciones al día |
| `npm run build` (`fas-api`) | OK |
| `npm run build` (`fas-web`) | OK, 78 páginas; incluye listado, nueva y `[id]` de OC |

## Re-test Codex (2026-07-24)

- **OC-001 verificado:** `RECEPCIONADA` no está disponible en el schema ni en el
  selector de transición manual; una OC en ese estado rechaza actualización y
  eliminación con 422.
- **OC-002 aceptado:** Incoterm queda diferido hasta disponer del catálogo
  genérico, siguiendo la decisión transversal indicada.
- **OC-003 verificado dentro del módulo:** el formulario queda deshabilitado y
  sin botón de guardado para solo lectura o estado Recepcionada. La fuente mock
  de permisos continúa como deuda transversal ya aceptada.
- **OC-004 verificado:** ambos selects opcionales permiten volver explícitamente
  a `null`.
- **OC-005 verificado:** existen los dos nuevos casos funcionales y la ruta está
  incluida en la prueba de protección anónima; suite total 70/70.
- **OC-006 aceptado:** sin cambios y condicionado a la inexistencia de datos
  transaccionales.

**Conclusión:** no quedan defectos abiertos de Orden de Compra para el alcance
acordado. Queda habilitada la prueba funcional manual con perfiles reales.

## Batch calibre/tipo pallet + limpieza de campos (Codex ronda QA 1, 2026-08-07)

Alcance: unificación del widget de calibre (Desde/Hasta + Agregar, igual a
Cierre Comercial) en OC, Instructivo de Embalaje y Solicitud de Inspección;
`tipoPalletId` + `cajas` en OC e Instructivo; eliminación de
`fechaEntregaDesde`/`fechaEntregaHasta`/`incotermId` de OC. Codex (ronda 1,
solo lectura) devolvió `NO_APROBADO` con 3 hallazgos:

- **FAS-PLAN-001 — Alta — `NUEVO` → `CORREGIDO` (vía spec, no vía código).**
  La migración elimina `fechaEntregaDesde`/`fechaEntregaHasta`/`incotermId`,
  contradiciendo el spec vigente y **supersede explícitamente `OC-002`** (que
  dejaba `incotermId` en el modelo "para cuando exista el catálogo"). Es una
  decisión de negocio explícita de Christian, no un descuido — `OC-002` queda
  **cerrado por eliminación del campo** en vez de "Aceptado". `compras.md`
  §4.2 se actualizó (2026-08-07) para reflejar la eliminación con nota de
  supersesión.
- **FAS-PLAN-002 — Alta — `NUEVO` → `CORREGIDO` (vía spec).** `cajas` se
  introdujo como total independiente y editable (no
  `cantidadPallets × cajasPorPallet`), sin que el spec lo reflejara. Decisión
  del usuario: opción **(b)** — `cajas` es la fuente de verdad (mismo patrón
  que `NotaVentaDetalle.cajas` en `ventas.md`); `cajasPorPallet` pasa a ser
  puramente referencial. `compras.md` §4.3 y §7.2 se actualizaron
  (2026-08-07) para que la futura validación de Recepción compare contra
  `cajas`, no contra el producto.
- **FAS-PLAN-003 — Media — abierto, diferido a propósito.** Falta cobertura
  de integración para `tipoPalletId` (válido/bloqueado/inexistente), `cajas`
  divergente de `cantidadPallets × cajasPorPallet`, cálculo de cuotas con el
  nuevo campo y backfill de la migración. **No se agrega en esta ronda** —
  Claude no escribe tests dentro del ciclo QA de este skill; queda como deuda
  de cobertura conocida, mismo tratamiento que `CCOM-QA-001`
  (`project-cierre-comercial`, memoria de sesión).

Los 3 errores de lint `react-hooks/set-state-in-effect` señalados por Codex
en esta ronda son preexistentes a este diff (mismo patrón ya rastreado en
`feedback-eslint-set-state-in-effect`, memoria de sesión) — no se registran
como hallazgo nuevo de este módulo.
