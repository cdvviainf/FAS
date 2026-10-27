# Módulo Compras — Ciclo de Compras (`compras.md`)

> **Proyecto:** FAS — Frutera Agrosan Sistema
> **Estado:** Definición cerrada a nivel de modelo · v0.1
> **Precede a:** implementación (Claude Code) · **QA:** Codex (read-only)
> **Depende de:** `calidad.md` (Solicitud/Informe de Inspección), `ventas.md` (Cierre de Negocio, Embarque, reserva de pallets), `mantenedores-generales.md` (Artículos, Especies, Variedades, Categorías, Calibres)

---

## 1. Propósito y Alcance

El módulo Compras cubre el ciclo completo de adquisición y recepción de fruta, desde la instrucción de embalaje hasta la incorporación de la fruta al stock disponible para embarque. Contempla dos vías de origen —**compra directa** (con Orden de Compra) y **proceso** (sin Orden de Compra)— que convergen en un único módulo de Recepción de Stock.

> **Supersesión 2026-10-01 (decisión de negocio):** la antigua tercera vía de **consignación** se eliminó. La recepción sin OC es siempre **Proceso**. El enum `OrigenRecepcion` pasa de `{ COMPRA, CONSIGNACION, PROCESO }` a `{ COMPRA, PROCESO }`. No había data histórica en `CONSIGNACION` (la migración aborta si la hubiera). El disparador de Liquidación a Productor por consignación queda **pendiente de redefinición** (§6.3).

**Dentro de alcance:** Instructivo de Embalaje, Orden de Compra (OC), Recepción de Stock (modos con/sin OC), motor de validación OC↔carga, generación de Stock y Pallets, **captura de documentos de compra (facturas y notas de crédito) desde fuente externa** y su cuadre contra las OC.

**Fuera de alcance (referenciado, no definido aquí):** Solicitud de Inspección de Calidad (`calidad.md`); reserva de pallets, Embarque, Instructivo de Embarque, Packing List y AGL (`ventas.md` / Operaciones); **pago de los documentos de compra y cuenta corriente del productor** (`productores.md`); Liquidación a Productor y Costos (Etapa 3 / Finanzas).

**Diferido explícitamente:** ligar a posteriori una OC suelta a un Cierre (flujo/UX de vinculación); lectura IA de PDF en Recepción y Packing List.

---

## 2. Actores y Roles

- **Marcos (Compras)** — emite Instructivo de Embalaje, genera y edita OC, ejecuta la Recepción de Stock.
- **Isella (Calidad)** — inspecciona la fruta embalada; su aprobación habilita la generación de la OC (proceso en `calidad.md`).
- **Giovanni (Ventas)** — reserva pallets del stock a un Cierre de Negocio / Embarque (proceso en `ventas.md`; se documenta aquí solo la interfaz con Stock).

---

## 3. Glosario y Nomenclatura

- **Cierre de Negocio (= Nota de Venta):** primer documento del ciclo de ventas, numeración propia. Es el mismo documento que la Nota de Venta; "Cierre de Negocio" es el término de negocio usado por Compras/Operaciones. **Reconciliación de nomenclatura (2026-07-24, hallazgo NV-IE-006):** el modelo Prisma se llama `NotaVenta` (definido en `ventas.md` §4.1); por lo tanto el FK en `OrdenCompra` es `notaVentaId → NotaVenta`, no `cierreNegocioId → CierreNegocio`. "Cierre de Negocio"/`CierreNegocio` queda como alias de negocio, no como nombre de modelo/campo. **`InstructivoEmbalaje` ya no tiene FK a `NotaVenta`** — ver supersesión 2026-08-12 en §4.1.
- **Instructivo de Embalaje:** documento que instruye **qué embalar** (tipo de embalaje, variedad, calibres, cantidades), construido con maestros del sistema, **anclado al productor** (no a una venta — ver §4.1). No confundir con el Instructivo de Embarque.
- **Instructivo de Embarque:** documento que instruye **cómo despachar** (fechas/horas de retiro por planta). Es la identidad del Embarque (padre) más sus hijos por planta. Definido en `ventas.md`.
- **Orden de Compra (OC):** especificación de lo que se va a comprar, **opcionalmente** asociada a un Cierre de Negocio. Multilínea.
- **Recepción de Stock:** carga de fruta real al inventario, con o sin OC.
- **Stock / Pallet:** el Pallet es la unidad mínima **indivisible** de inventario. El Stock es el conjunto de pallets recepcionados.

**Regla de nomenclatura crítica:** *Embalaje* (qué empacar) ≠ *Embarque* (cómo despachar). Los dos "Instructivos" son documentos distintos en momentos distintos del proceso; no tienen FK directa entre sí.

---

## 4. Modelo de Datos

Convención general del proyecto: PK `Int` autoincremental para toda entidad local; PK `String` solo para referencias a usuarios (Better Auth).

### 4.1 InstructivoEmbalaje
Instrucción de qué embalar. **Sin FK a OC** (la relación es inexistente; ver §6.1). Su valor es estandarizar usando maestros en vez de texto genérico.

> **⚠️ Supersesión (2026-08-21, Etapa 1A) — REVERTIDA (2026-09-02).** ~~El Instructivo ES la Inspección de Proceso. Deja de ser "sin estado propio": gana el ciclo de vida `estadoInspeccion` (`InspeccionProcesoEstado { PENDIENTE NOTIFICADA APROBADA RECHAZADA CERRADA }`) que gestiona Calidad (`CAL_SOLICITUDES`, ver calidad.md), más `comentarioInspeccion`, `inspeccionadoEn`/`inspeccionadoPor`, `notificadaEn` y la tabla hija de folios `InstructivoEmbalajeFolio`.~~ Decisión de negocio (Christian, 2026-09-02): el Instructivo de Embalaje **ya no pasa por ningún proceso de aprobación de Calidad**, y **no existe** ningún listado de folios aprobados/rechazados. Se eliminan del modelo `estadoInspeccion`, `InspeccionProcesoEstado`, `comentarioInspeccion`, `inspeccionadoEn`/`inspeccionadoPor`, `notificadaEn`, y el modelo `InstructivoEmbalajeFolio`/`EstadoFolioInspeccion` por completo. `CAL_SOLICITUDES` deja de tener cualquier rol sobre el Instructivo — vuelve a ser un documento simple bajo `COMPRAS_INSTRUCTIVO` (`TOTAL` para crear/editar/eliminar, lectura compartida con `COMPRAS_RECEPCION` para el selector de Recepción, ver §4.4). Ver `calidad.md` para el detalle completo de la reversión.

> **Editable/eliminable sin condición de estado (2026-09-02, revierte 2026-08-15/2026-08-21).** El Instructivo vuelve a ser un documento sin máquina de estados: `PATCH`/`DELETE` funcionan siempre (reemplazo atómico de encabezado y/o `detalle`; soft delete `eliminadoEn`/`eliminadoPor`, nunca DELETE físico — CLAUDE.md §12 regla 8), sin ningún veredicto que lo congele. El listado y el detalle filtran `eliminadoEn: null`.
>
> **Perfil recomendado para editar (2026-08-15, IE-EDIT-QA-003 — actualizado 2026-08-12).** El formulario de edición completa su selector de Artículo consultando el endpoint de Materiales, protegido por su propio ítem (`OPER_MATERIALES`) — no por `COMPRAS_INSTRUCTIVO`. El selector de Cierre Comercial que originaba este hallazgo **ya no existe** (supersedido por Productor, arriba); el mismo riesgo teórico ahora aplicaría al selector de Productor (`entidadesService`, ítem `CONFIG_ENTIDADES`) pero, igual que en `orden-compra-form.tsx` (que depende de `CONFIG_ENTIDADES` para su propio selector de Productor sin mitigación), no se agregó protección específica — es el mismo patrón ya aceptado en el resto del sistema. Un perfil con `COMPRAS_INSTRUCTIVO: TOTAL` pero sin `LECTURA` en `OPER_MATERIALES` puede editar las líneas ya existentes (el valor guardado se sigue mostrando por nombre, tomado del propio GET del instructivo), pero **no puede elegir** un Artículo nuevo que no pueda listar. Se recomienda que todo perfil con `COMPRAS_INSTRUCTIVO: TOTAL` incluya también `LECTURA` en `OPER_MATERIALES` y `CONFIG_ENTIDADES`.
>
> **Decisión de negocio — postergado (2026-08-15).** El árbitro de QA calificó esto como `BUG_REAL` bajo una lectura estricta de RP3 (`TOTAL` sobre un ítem debería bastar por sí solo, sin depender de `LECTURA` en ítems ajenos referenciados por FK). El usuario (Christian) decidió explícitamente **no** implementar ahora la corrección de raíz (exponer catálogos propios bajo `COMPRAS_INSTRUCTIVO`, o declarar y enforzar dependencias entre ítems de menú en el editor de perfiles) — es un cambio transversal a Compras/Ventas/Operaciones, fuera del alcance de esta edición del Instructivo. Se acepta la mitigación de arriba (perfil recomendado + fix de hidratación que evita la degradación visual) como suficiente para este ciclo. Mismo patrón de cierre que `CCOM-QA-001`/`NV-IE-010` (`Docs/Hallazgos/notas-venta-instructivo-embalaje.md`): gap de cobertura/diseño conocido y aceptado, no un defecto de código pendiente de arreglo.

> **Supersesión — ancla a Productor, no a NV (2026-08-12).** `notaVentaId` se **elimina** del modelo. El instructivo se emite **antes** de que exista un Cierre Comercial asociado — el flujo real (§5.1/§5.2) nunca lo condicionó a una NV, solo a la fruta que va a llegar de un productor. Se reemplaza por `entidadProductorId` (FK → Entidad tipo PRODUCTOR, obligatorio, mismo patrón que la OC) + `grupoMercadoId` (FK → GrupoMercado, obligatorio) + `fechaInicioPrograma` (fecha, obligatoria — la UI muestra la semana ISO calculada como label, no se persiste) + `observaciones` (texto libre, opcional). Migración destructiva (no hay forma de derivar un productor desde la NV existente; sistema en desarrollo, sin datos transaccionales reales).
>
> **Detalle — variedad rotulada y altura (2026-08-12).** Cada línea gana `variedadRotuladaId` (FK → Variedad, opcional, filtrada por la misma especie de la línea — una segunda variedad) y `alturaId` (FK → Altura, obligatoria — "altura de pallet"). La grilla de detalle muestra columnas separadas: Especie, Variedad, Variedad Rotulada, Artículo, Categoría, Calibre, Altura, Cantidad (antes "Especie / Variedad" iba combinado en una celda).
>
> **⚠️ Supersesión (2026-10-06) — Exportador en cabecera, Grupo de Mercado baja a línea, Marca/Observaciones por línea, duplicar línea.** Por decisión de Christian:
> - **`grupoMercadoId` deja de estar en la cabecera y pasa al detalle** (obligatorio por línea): una misma emisión puede destinar líneas a grupos de mercado distintos. El ancla del documento queda Productor + `fechaInicioPrograma` (el Grupo de Mercado ya no forma parte de la cabecera). Migración con backfill: cada línea existente hereda el `grupoMercadoId` que tenía su cabecera, antes de dropear la columna del encabezado.
>   - **⚠️ Supersesión (2026-10-14) — el detalle pide MERCADO, no Grupo de Mercado.** `InstructivoEmbalajeDetalle.grupoMercadoId` → **`mercadoId`** (FK a `Mercado`, requerido por línea). El selector del formulario y el PDF del Instructivo muestran **Mercado**. (OC usa `destinoMercadoId` y Cierre Comercial/Nota de Venta usa `mercadoId` — ambos **ya** eran Mercado, sin cambio.) Datos de prueba: la migración `20261014170000` limpia las líneas existentes del Instructivo (sin mapeo grupo→mercado) antes de cambiar la columna.
> - **Nuevo `exportadorId?` en cabecera** (FK → Entidad tipo `EXPORTADORA`, opcional; FK compuesta `(empresaId, exportadorId)`).
> - **Nuevo `etiquetaId?` por línea** (FK → Etiqueta, opcional): la "Marca" de la línea. Por defecto se sugiere la etiqueta del artículo, pero se puede sobrescribir por línea; en el PDF manda la de la línea y cae a la del artículo si no se fijó.
> - **Nuevo `observaciones?` por línea** (texto libre, opcional).
> - **Duplicar línea**: la UI permite clonar una línea del detalle como nueva (para ajustarla y agregarla). Extendido (2026-10-14) a los formularios de **Orden de Compra** y **Cierre Comercial/Nota de Venta** además del Instructivo: el botón "Duplicar" de cada fila **precarga el formulario de línea con los datos de esa fila SIN agregarla ni marcar edición** — al "Agregar" se crea una línea nueva; el usuario ajusta solo lo que necesita.
> - El selector de Embalaje se **filtra ESTRICTAMENTE por la especie de la línea** (⚠️ supersede 2026-10-14: ya **no** incluye los genéricos sin especie) — ver §4.3.
> - El PDF del Instructivo refleja estos cambios: Exportador en el bloque de Programa (cabecera), y columnas Mercado / Marca / Observaciones en el detalle (⚠️ Mercado desde 2026-10-14, antes Grupo Mercado).
> - **Presentación (2026-10-25):** el **selector de Exportador** del formulario muestra solo el **nombre** (`descripcion`), no `"descripción — razón social"`. El **PDF** del Instructivo muestra el **código** del artículo (no la descripción), igual que la tabla de detalle de la pantalla.

- `id` (PK)
- `numero` (correlativo propio)
- `entidadProductorId` (FK → Entidad tipo PRODUCTOR, obligatorio) **(supersede a `notaVentaId`, 2026-08-12 — ver nota arriba)**
- `exportadorId` (FK → Entidad tipo EXPORTADORA, opcional) **(nuevo, 2026-10-06)**
- ~~`grupoMercadoId` (FK → GrupoMercado, obligatorio)~~ **(movido al detalle, 2026-10-06 — ver nota arriba)**
- `fechaInicioPrograma` (fecha, obligatoria) **(nuevo, 2026-08-12)**
- `observaciones` (texto libre, opcional) **(nuevo, 2026-08-12)**
- Detalle (1..N líneas): `articuloId` (FK → Artículo/Embalaje, filtrado por especie de la línea), `mercadoId` (FK → **Mercado**, obligatorio) **(⚠️ 2026-10-14: antes `grupoMercadoId` → GrupoMercado; movido desde cabecera en 2026-10-06)**, `especieId`, `variedadId`, `variedadRotuladaId` (FK → Variedad, opcional, misma especie) **(nuevo, 2026-08-12)**, `categoriaId`, lista de calibres (`InstructivoEmbalajeDetalleCalibre`, multiselect — ver nota de supersesión en §4.3), `tipoPalletId` (FK → TipoPallet, **requerido** — 2026-10-13: la cantidad de cajas por pallet sale del mantenedor CajasPorPallet, sin tipo de pallet no hay cifra) **(nuevo, 2026-08-07)**, `alturaId` (FK → Altura, obligatorio) **(nuevo, 2026-08-12)**, `etiquetaId` (FK → Etiqueta/Marca, opcional) **(nuevo, 2026-10-06)**, `cantidadPallets`, `cajasPorPallet`, `cajas` **(nuevo, 2026-08-07 — ver nota en §4.3, mismo criterio)**, `observaciones` (texto libre, opcional) **(nuevo, 2026-10-06)**
- `createdAt`, `createdBy`

> El detalle usa **artículos maestros** (ej. `UV0001103 — CAJA MARCA AGROSAN ETIQUETA TAIWAN PLÁSTICO`), no descripciones libres.

### 4.2 OrdenCompra (OC)
Especificación de la compra.

> **Reconciliación (2026-07-24, implementación real vs. spec original):** el
> spec original condicionaba la OC al resultado de una inspección de Calidad
> aprobada (`informeCalidadId → InformeInspeccion`). Ese modelo de Calidad
> (`InspeccionCaja` y afines, calidad.md) todavía no está implementado — **el
> usuario confirmó que por ahora no se requiere Calidad aprobada para emitir
> una OC**; nace de un Cierre Comercial (Nota de Venta) o sin ninguna
> referencia. El campo `informeCalidadId`/`informeCalidadPdfUrl` se **omite**
> de esta primera implementación (se agregará cuando exista el modelo de
> Calidad real). Además, comparando contra un documento real de Agrosan (OC
> legacy en PDF) se detectó que el modelo original no tenía forma de
> identificar al productor ni las condiciones comerciales — se agregaron los
> campos abajo marcados **(nuevo)**.
>
> **Supersesión (2026-08-14):** decisión de negocio (Christian) — la OC
> **vuelve a exigir** trazabilidad con Calidad, ahora contra el modelo real
> implementado (`SolicitudInspeccion` v1, `calidad.md` / `Docs/Hallazgos/solicitud-inspeccion.md`)
> en vez del `InformeInspeccion` diferido. Se agrega `solicitudInspeccionId`
> (ver abajo).

- `id` (PK)
- `numero` (correlativo propio, formato `OC-{AAAA}-{NNNN}` por año — CLAUDE.md §7)
- `entidadProductorId` (FK → Entidad tipo PRODUCTOR) **(nuevo)** — obligatorio; el documento real siempre identifica al productor/proveedor de la compra
- `notaVentaId` (FK → NotaVenta, **nullable**) — origen de la OC: "Cierre Comercial" (con Nota de Venta) o "Manual" (sin ella, OC suelta permitida). *Ligar una OC suelta a un Cierre a posteriori: flujo/UX diferido (ver §10).*
- `solicitudInspeccionIds` (N:M vía `OrdenCompraSolicitudInspeccion`, tabla mapeada `oc_solicitudes_inspeccion` — nombre acortado por el límite de 63 bytes de Postgres para constraints) **(rediseño 2026-08-22, Etapa 2 — supersede el `solicitudInspeccionId` singular de 2026-08-14/2026-08-21)**: una OC puede tener **varias** Solicitudes de Inspección; cada Solicitud pertenece como máximo a una OC (`@@unique(empresaId, solicitudInspeccionId)` en la tabla puente — impide vincularla a una segunda). Requerido **a nivel de aplicación** al crear una OC (≥1 elemento, no de columna): **todas** las solicitudes vinculadas deben tener el **mismo `entidadProductorId`** que la OC (se rechaza 422 si alguna no corresponde), y **al menos una** debe tener `estado = APROBADA` (ver calidad.md) para habilitar la OC — las demás pueden estar en cualquier estado sin bloquear (decisión de negocio, Christian, 2026-08-22: ya no exige que *todas* estén Aprobadas, a diferencia del vínculo singular anterior). Vincular una solicitud ya usada por otra OC se rechaza (422) con mensaje explícito antes de chocar con el constraint — incluida la colisión por carga simultánea (`P2002` de la propia BD, traducido al mismo 422). En edición, reenviar el arreglo reemplaza el conjunto completo (mismo patrón que `calibreIds` en `OrdenCompraLinea`); no se puede vaciar a 0 (validado tanto en el schema como en el formulario). **Eliminar (soft delete) una OC libera sus Solicitudes vinculadas** (decisión de negocio, Christian, 2026-08-22): se borran las filas de la tabla puente de esa OC, no la propia Solicitud ni la OC (que sigue existiendo vía `eliminadoEn`) — así una OC eliminada no bloquea su Solicitud para siempre.
> **Gestión de la Solicitud (2026-08-10, supersesión):** la Solicitud de Inspección de tipo Compra ya no se gestiona (ingresar/editar/notificar) desde Calidad — se ingresa/edita desde `/dashboard/compras/solicitudes` (ítem `COMPRAS_SOLICITUDES`). Calidad conserva solo ver + cerrar. Detalle completo en `Docs/Hallazgos/solicitud-inspeccion.md` §7.
- ~~`fechaEntregaDesde` / `fechaEntregaHasta`~~ **(eliminado 2026-08-07)** — decisión de negocio (Christian): la ventana de entrega no se usa en la operación real de compras; se quita del formulario, del contrato API y del modelo. Si se retoma, debe reintroducirse explícitamente aquí primero.
- `responsableId` (FK → Usuario, nullable) **(nuevo, 2026-07-26)** — solo usuarios marcados `esResponsableVenta` en su ficha
- `destinoMercadoId` (FK → Mercado, nullable) **(nuevo, 2026-07-26)** — "Destino" de la OC
- `formaPagoId` (FK → FormaPago, nullable) **(nuevo, 2026-07-26)** — mantenedor propio (`Docs/mantenedores-generales.md`); reemplaza el texto libre original
- `condicionPagoId` (FK → CondicionPago, nullable) **(nuevo, 2026-07-26)** — reemplaza `condicionPagoTexto`; ver §4.2.1
- `monedaId` (FK → Moneda) **(nuevo)**
- `incotermId` (FK → `ClausulaVenta`, nullable) **(reintroducido 2026-08-12, supersedido 2026-09-30)** — supersede el `~~incotermId~~` **eliminado 2026-08-07** por falta de catálogo (`OC-002`, `Docs/Hallazgos/orden-de-compra.md`). Originalmente reutilizaba el catálogo genérico `Parametro`/`INCOTERM` (mismo mecanismo que `NotaVenta.clausulaVentaId`); **⚠️ Supersesión (2026-09-30):** por decisión de Christian, pasa a apuntar al mantenedor dedicado `ClausulaVenta` (`config/clausulas-venta`) — el catch-all `Parametro` no exponía `requiereFlete`/`requiereSeguro` en su listado. Migración `clausula_venta_dedicada` preserva los `id` originales, sin reescribir esta FK.
- ~~`facturarAId`~~ **(eliminado 2026-07-26)** — decisión de negocio: la OC no factura a una entidad distinta del productor
- `observaciones` **(nuevo)**
- `modalidad` (enum `ModalidadCompra { CAJAS | GRANEL }`, default `CAJAS`) **(nuevo, 2026-10-23)** — define si la OC compra fruta **embalada** (CAJAS, producto terminado, comportamiento actual) o fruta **a granel por kilos** (GRANEL). Editable **solo en `BORRADOR` y solo si la OC no tiene líneas** — cambiarla con líneas ya cargadas se rechaza (422), porque el contrato de la línea depende de la modalidad (§4.3). Ver detalle de cada modalidad en §4.3.
  > **GRANEL (2026-10-23).** (a) Artículo de la línea tipo `GRANEL` (`materiales.md`); la línea exige especie + variedad + artículo + `cantidadKilos` + `precioUsdKilo` (ver §4.3). (b) Las cuotas `MONTO_UNITARIO` (§4.2.1) usan `cantidadKilos` como cantidad real y **deben** estar en unidad `KG` — se rechaza cualquier otra unidad. (c) Una OC granel **NO** puede tomar líneas de un Cierre Comercial (`notaVentaDetalleId`): el Cierre es de fruta embalada. (d) La **Recepción** de una OC granel está **BLOQUEADA** en esta etapa (mensaje "estará disponible en una etapa futura") — por ahora solo se puede crear/emitir la OC granel. (e) El **PDF** de la OC granel muestra columnas Kilos / Precio <moneda>-Kg / Total en vez de cajas/calibre/pallets.
  > **Condiciones comerciales de granel (2026-10-27).** Cuatro campos **a nivel cabecera**, **todos opcionales**, que aplican **solo a modalidad GRANEL** (en CAJAS se guardan `NULL`; el service y el repo bajo lock los nulifican contra la modalidad autoritativa — OC-GRANEL-A-001): `porcentajeMinExportacion` (Decimal 0–100, % mínimo de exportación), `modalidadEntregaGranel` (enum `ModalidadEntregaGranel { PUESTA_EN_CAMPO | ENTREGADA_EN_PLANTA }`), `envasesProporcionadosPor` y `encargadoDescartePor` (enum `ResponsableProductorExportadora { PRODUCTOR | EXPORTADORA }`). Listas cerradas. Se muestran en el form (selectores con "— Sin definir —") y en el PDF v2 (grupo "Condiciones de granel"), solo en granel.
  > **Moneda de los importes (2026-10-27).** Los precios/totales de la OC (por caja y por kilo) se expresan en la **moneda de la cabecera** (`monedaId`), no fijo USD: las etiquetas del form y del PDF v2 muestran el código de moneda elegido (ej. `Precio CLP/Kg`, `Total Neto CLP`). Los nombres de columna `precioUsdCaja`/`precioUsdKilo` del modelo se conservan por compatibilidad histórica, pero representan el valor en la moneda de la OC.
- `estado` (ver §8)
- `creadoEn`, `creadoPor`

#### 4.2.1 CondicionPago **(nuevo, 2026-07-26 — reemplaza `condicionPagoTexto`)**
Maestro propio (cabecera + cuotas, mismo patrón que `ConceptoLiquidacion`), `Docs/mantenedores-generales.md`. **Determina automáticamente** las cuotas de pago de la OC: no se cargan manualmente por orden.
- `id`, `codigo`, `descripcion`, `bloqueado`, auditoría/softdelete
- `cuotas` — 1..N `CondicionPagoCuota { fechaReferencia (FACTURA/ZARPE/ENVIO_DOCUMENTOS, default FACTURA), plazoDias (Int), tipoValor (PORCENTAJE/MONTO_UNITARIO, default PORCENTAJE), porcentaje (Decimal, requerido si tipoValor=PORCENTAJE), valorUnitario/monedaId/unidadId (requeridos si tipoValor=MONTO_UNITARIO), descripcion? }`
- **Regla de cuotas (2026-07-28):** las cuotas `PORCENTAJE` son **siempre obligatorias** y deben sumar exactamente 100% entre sí, exista o no además una cuota `MONTO_UNITARIO`. A lo sumo **una** cuota puede ser `MONTO_UNITARIO`, y debe ser la primera (índice 0) de la lista — representa un **cargo adicional** (ej. USD/caja o USD/kilo según cantidad real embarcada/despachada), nunca un reemplazo del 100%. `unidadId` en una cuota `MONTO_UNITARIO` solo admite las unidades `CAJA` o `KG` (`Docs/mantenedores-generales.md`); si es `KG`, el cálculo de cantidad real exige que cada `Articulo` involucrado tenga `kgNetoEnvase` válido (rechaza con error de negocio si falta).

#### 4.2.2 OrdenCompraCuotaPago
Snapshot inmutable de las cuotas al momento de crear/editar la OC (se copian desde `CondicionPago.cuotas` en el instante en que se fija `condicionPagoId`; si la plantilla cambia después, **no** afecta OCs ya creadas). Vacío si la OC no tiene condición de pago.
- `ordenCompraId` (FK → OrdenCompra)
- `fechaReferencia`, `plazoDias` (Int), `tipoValor`, `porcentaje` (Decimal, nullable), `valorUnitario`/`monedaId`/`unidadId` (nullable, solo cuota `MONTO_UNITARIO`), `descripcion` (texto libre, opcional)
- `montoCalculado` (Decimal, solo cuota `MONTO_UNITARIO`) — `valorUnitario × cantidad real` (cajas o kilos embarcados según `unidadId`, calculado desde las líneas de la OC). Se **recalcula automáticamente** cada vez que cambian las líneas de la OC (no solo cuando cambia `condicionPagoId`).

### 4.3 OrdenCompraLinea
La OC es **multilínea**. Cada línea es una combinación completa de características + lista de calibres + cantidades + precio.

> **Modalidad CAJAS vs GRANEL (nuevo, 2026-10-23).** El contrato de la línea depende de `OrdenCompra.modalidad` (§4.2):
> - **CAJAS** (default) — comportamiento actual: fruta embalada, producto terminado. Artículo tipo `EMBALAJE`; la línea usa categoría / etiqueta / lista de calibres / tipo de pallet / `cantidadPallets` / `cajasPorPallet` / `cajas` / `precioUsdCaja` (todos los campos descritos abajo).
> - **GRANEL** — fruta por kilos. Artículo tipo `GRANEL` (`materiales.md`); la línea **exige** `especieId` + `variedadId` + `articuloId` + `cantidadKilos` (`Decimal(14,2)`) + `precioUsdKilo` (`Decimal(14,4)`). **NO aplican** categoría / etiqueta / lista de calibres / tipo de pallet / `cantidadPallets` / `cajasPorPallet` / `cajas` / `precioUsdCaja` — quedan `null`. Por eso esas columnas pasaron a **nullable** en `OrdenCompraLinea` (migración aditiva). La línea granel tampoco puede provenir de un Cierre (`notaVentaDetalleId` siempre null; ver §4.2 nota GRANEL).

- `id` (PK)
- `ordenCompraId` (FK → OrdenCompra)
- `especieId`, `variedadId`, `categoriaId`, `articuloId` (embalaje)
  > **Embalaje filtrado por especie — ESTRICTO (⚠️ supersesión 2026-10-14, reemplaza la regla "+ genéricos" de 2026-10-06).** El selector de Embalaje de la línea muestra **solo** los artículos `EMBALAJE` activos **de la `especieId` de la línea**: los embalajes **sin especie asignada (genéricos) NO aparecen nunca**, y sin especie elegida el selector queda **vacío** (decisión de negocio del usuario). Se aplica como filtro **client-side** en los tres formularios (OC, Cierre Comercial/Nota de Venta, Instructivo). El backend de `GET /api/materiales/articulos` sigue aceptando `especieId` (y `Articulo.especieId` sigue siendo opcional a nivel de modelo — ver `materiales.md`); la restricción es del selector (no validación dura en los servicios), así que una línea histórica con un embalaje genérico conserva su valor hasta que se cambie. Cambiar la especie de la línea limpia el embalaje elegido. Para que un embalaje sea seleccionable debe tener su especie asignada en el mantenedor de Artículos.
- `calibres` (`OrdenCompraLineaCalibre`, N:M contra Calibre) — **lista** de calibres puntuales, no un rango. **(Supersesión, 2026-08-15)**: reemplaza los antiguos `calibreMinId`/`calibreMaxId` (FK → Calibre). Motivo: la UI debía mostrar/quitar cada calibre individualmente (igual que `NotaVentaDetalleCalibre`, `ventas.md`) en vez de un rango colapsado; el formulario sigue ofreciendo Desde/Hasta como atajo de captura (usa `Calibre.orden` de la especie para expandir el rango en el momento de agregar), pero lo que persiste es la lista resultante, editable calibre a calibre. Mismo patrón replicado en `InstructivoEmbalajeDetalle` (§4.1). Impacta la validación de Recepción: ver nota en §7.2.
- `tipoPalletId` (FK → TipoPallet, **requerido** — 2026-10-13: la cantidad de cajas por pallet sale del mantenedor CajasPorPallet, sin tipo de pallet no hay cifra) **(nuevo, 2026-08-07)**
- `cantidadPallets` (Int)
- `cajasPorPallet` (Int) **(2026-10-13)** — cifra teórica del mantenedor **CajasPorPallet** (embalaje + tipo de pallet). Ya **no** hay default 108: si la combinación no tiene cantidad configurada, la UI muestra un error "no hay cantidades" y ofrece darla de alta inline (permiso `CONFIG_CAJAS_POR_PALLET`). El backend exige `> 0`. **No** es la fuente de verdad del total ni una restricción por pallet individual.
- `cajas` (Int) **(nuevo, 2026-08-07)** — **total de cajas de la línea, campo independiente y editable** (mismo patrón que `NotaVentaDetalle.cajas` en `ventas.md`). Se precalcula como `cantidadPallets × cajasPorPallet` (cifra del mantenedor) al cambiar `cantidadPallets`, pero el usuario puede sobrescribirlo (ej. último pallet parcial). Es la cantidad que alimenta el cálculo de cuotas `MONTO_UNITARIO` (§4.2.1) y, a futuro, la validación de Recepción (§7.2) — **no** se recalcula ni se fuerza a coincidir con `cantidadPallets × cajasPorPallet`.
- `precioUsdCaja` (Decimal) — **precio de compra** (lo que paga Agrosan). Alimenta Costos (ver §10)
- `notaVentaDetalleId` (FK → `NotaVentaDetalle`, nullable, sin unicidad) **(nuevo, 2026-08-23)** — línea tomada (completa o parcial) de una línea del Cierre Comercial de la propia OC, para no recapturar especie/variedad/categoría/artículo a mano. Al agregar/editar una línea con este campo: `especieId`/`variedadId`/`categoriaId`/`articuloId`/`tipoPalletId` se **copian server-side** desde la línea del Cierre (no se confía en el cliente); `calibreIds` debe ser **subconjunto** de los calibres de esa línea (puede ser menos, nunca uno fuera de la lista); `cajas` no puede superar el **disponible** = `NotaVentaDetalle.cajas` menos la suma de `cajas` de todas las `OrdenCompraLinea` vigentes (de OC no eliminadas) con el mismo `notaVentaDetalleId` — chequeo con lock (`LOCK_NAMESPACE_NOTA_VENTA_DETALLE`) para que dos OC concurrentes no superen el cupo. Una línea del Cierre puede repartirse entre **varias** `OrdenCompraLinea`, incluso de la misma OC (decisión de negocio, Christian). Inmutable tras crear la línea — para cambiar el origen, se elimina y se vuelve a agregar. La línea manual (sin este campo) sigue funcionando igual que siempre; ambas conviven en la misma OC. `GET /api/compras/ordenes-compra/notas-venta/:notaVentaId/disponibilidad` expone las líneas del Cierre con su disponible ya calculado, para la grilla de selección del formulario de OC. Eliminar o reducir cajas por debajo del comprometido en la línea del Cierre está bloqueado del lado de Ventas mientras tenga compromiso — ver `ventas.md`.

> **Etiqueta y peso del envase (2026-07-24):** un documento real de Agrosan
> muestra "Etiqueta" y "Kg Neto/Bruto Envase" por línea. Se confirmó con el
> usuario que son **atributos del Artículo** (materiales.md), no de la línea
> de OC — la línea los hereda del artículo elegido, sin duplicarlos.
> `Articulo` gana los campos `etiqueta`, `kgNetoEnvase`, `kgBrutoEnvase`
> (opcionales, aplican a artículos tipo EMBALAJE).
>
> **Supersesión (2026-08-13):** `Articulo.etiqueta` deja de ser texto libre y
> pasa a `etiquetaId` (FK al nuevo mantenedor `Etiqueta`,
> `mantenedores-generales.md` §4.3) — elegible desde un selector en el
> maestro de Artículos, con creación rápida inline (mismo patrón que
> `unidadId`). Pasa a ser **requerido** (antes era opcional) cuando
> `tipo = EMBALAJE`, validado en `articulos.service.ts`, no a nivel de
> columna. Migración destructiva: los valores de texto libre existentes no
> se preservan (decisión aceptada, sistema en desarrollo).
>
> **Supersesión (2026-10-17) — Etiqueta POR LÍNEA de OC:** la etiqueta pasa a
> persistirse en la **línea de la OC** (`OrdenCompraLinea.etiquetaId`, FK →
> `Etiqueta`, nullable por OCs históricas), **superando** la regla anterior de
> "solo atributo del artículo". Motivación: un artículo de embalaje puede tener
> etiqueta **dinámica** (varias permitidas), y la compra debe fijar cuál. Reglas:
> - **Una sola** etiqueta por línea, dentro del **set permitido del artículo**
>   (`Articulo.etiquetaId` principal ∪ `ArticuloEtiqueta` adicionales).
> - Artículo **FIJO** (1 permitida): se autocompleta y queda de solo lectura.
>   Artículo **DINÁMICO** (>1): obligatorio elegirla. El backend resuelve la fija
>   aunque el request venga sin etiqueta (`ordenes-compra.service.ts`).
> - **Instructivo de Embalaje (2026-10-21):** la línea del Instructivo
>   (`InstructivoEmbalajeDetalle.etiquetaId`) usa **la misma regla** — set permitido
>   del artículo (principal ∪ adicionales), FIJA autocompleta / DINÁMICA obligatoria,
>   validada y resuelta también en el backend (`instructivo-embalaje.service.ts`),
>   no solo en la UI.
> - **Calidades permitidas (2026-10-22):** el Instructivo de Embalaje gana
>   `calidadesPermitidas` = lista de **pares** `(NotaCalidad, NotaCondicion)`
>   (`InstructivoEmbalajeCalidadPermitida`) — combinaciones específicas admitidas
>   (ej. A1/A2/B1, sin B2), mismo componente/concepto que el Cierre Comercial y la
>   Solicitud de Inspección (ver `ventas.md`). En el Instructivo es **definición
>   documental** (el gate de bloqueo real vive en la selección de pallets del
>   Embarque, contra los pares del Cierre).
> - **Carga de Recepción (modo COMPRA):** la etiqueta del pallet debe coincidir
>   con la de la línea de OC que matchea; la clave de match incluye la etiqueta
>   (combo + etiqueta), de modo que dos líneas de igual combo y distinta etiqueta
>   se distinguen. Líneas históricas sin etiqueta (`etiquetaId = null`) mantienen
>   el match por combo. La asignación es **no superpuesta** y se compara por
>   **totales agregados**: las líneas se agrupan por combo+etiqueta (las
>   históricas toman el remanente del combo) y se compara la suma de pallets/
>   cajas y la unión de calibres del grupo contra sus filas — así líneas
>   indistinguibles (mismo combo+etiqueta, permitido al repartir una línea del
>   Cierre) no se rechazan por el orden en que aparecen. El formato
>   base precarga la columna Etiqueta desde la línea de OC.
> - Migración aditiva `20261015140000_oc_linea_etiqueta` (columna nullable, sin
>   backfill — las OCs previas quedan con etiqueta heredada del artículo).

### 4.4 Recepcion
Módulo único, dos modos según origen. Una Recepción se valida contra **una** OC, contra **el/los Instructivo(s) de Embalaje seleccionados**, o contra **nada** (nunca varias fuentes a la vez).

- `id` (PK)
- `ordenCompraId` (FK → OrdenCompra, **nullable**) — presente = modo compra; null = modo proceso
- `origen` (`OrigenRecepcion { COMPRA PROCESO }`) — fijado **al crear** y persistido (no derivado en cada lectura): `COMPRA` si hay OC; `PROCESO` si no hay OC *(2026-10-01: se eliminó `CONSIGNACION`; sin OC el origen es siempre `PROCESO`)*
- `instructivos` (`RecepcionInstructivoEmbalaje`, N:M → InstructivoEmbalaje, **2026-09-01**) — solo en modo `PROCESO`; uno o más Instructivos que respaldan esta Recepción, fijados al crear (sin condición de estado — el Instructivo ya no tiene veredicto, ver §4.1 y supersesión abajo)
- `advertenciasAceptadas` (Boolean, default `false`), `advertenciasDetalle` (Json?, snapshot de las diferencias), `advertenciasAceptadasEn` (DateTime?), `advertenciasAceptadasPor` (String?) — auditoría de la confirmación con advertencias en modo `PROCESO` (**nuevo, 2026-09-02**, ver supersesión abajo)
- `plantaOrigenId` / mantenedor de formato aplicado (ver §9.2)
- `documentoOrigenUrl` (Excel u otro cargado)
- `estado` (ver §8)
- `createdAt`, `createdBy`

> El flag **con/sin OC no es solo un modo de validación**: determina el destino de liquidación de la fruta (ver §6.3). Como la Recepción es homogénea (1 OC, Instructivo(s) de Proceso, o ninguno), el flag se propaga a todos sus pallets.
>
> **⚠️ Supersesión (2026-09-02) — modo Proceso, advertencia en vez de bloqueo.** Reemplaza por completo la mecánica de folios de Calidad (2026-08-23/2026-09-01, ver `calidad.md`): Calidad ya no aprueba folios ni emite veredicto sobre el Instructivo, así que no existe ningún listado de folios contra el cual validar existencia. La selección de uno o más Instructivos (`RecepcionInstructivoEmbalaje`) **se mantiene igual** (N:M, fijada al crear — no editable después; ahora sin restricción de estado, cualquier Instructivo no eliminado es seleccionable). Lo que cambia es la validación: cada N° de Pallet del Excel se compara directamente contra el detalle combinado (`InstructivoEmbalajeDetalle`) de los Instructivos seleccionados — sus características (especie/variedad/categoría/artículo/calibre) deben coincidir con **alguna línea** de alguno de ellos (no exhaustivo línea a línea, basta con que exista una línea compatible; tampoco hay "saldo"/cupo por línea — `cantidadPallets`/`cajas` de la línea siguen siendo solo informativas). Si hay diferencias, la carga **no se bloquea de forma dura**: se devuelven como **advertencia** (`{advertencias, adjuntoId}`) y el usuario decide si acepta cargar de todas formas — **todo o nada**, no se puede aceptar solo algunas. Si acepta, se reprocesa el mismo adjunto ya guardado (`POST …/adjuntos/:adjuntoId/confirmar`, sin volver a subir el archivo) y la Recepción queda con `advertenciasAceptadas = true` + el detalle de qué no calzaba, para trazabilidad. Sin folio, ya no hay recurso escaso que reclamar atómicamente entre Recepciones concurrentes (el reclamo de Etapa 1A queda sin efecto). Como sí valida (a diferencia de Consignación), el estado final es `VALIDADA`, igual que modo Compra.

### 4.5 Pallet
Unidad mínima **indivisible** de inventario. Generado por la Recepción. Compuesto por múltiples líneas (separando productor, embalaje, calibre, categoría, etc.).

- `id` (PK)
- `recepcionId` (FK → Recepcion)
- `numeroPallet` (identificador del pallet según origen; usado en la reconciliación con Packing List)
- `origen` (`COMPRA` | `PROCESO`, heredado de la Recepción)
- `embarqueId` (FK → Embarque, **nullable**) — se puebla al reservar el pallet a un embarque (Ventas); un pallet pertenece a **un solo** Embarque a la vez
- `productorId` (FK → Productor)
- `notaCalidadId` (FK → NotaCalidad, **nullable**), `notaCondicionId` (FK → NotaCondicion, **nullable**), `completo` (Boolean, default `false`) **(nuevo, 2026-09-02 — ver §4.8)**
- `numeroGuiaDespacho` (String, **nullable**), `emisorGuiaId` (FK → Entidad, **nullable**, relación `"PalletEmisorGuia"`) **(nuevo, 2026-10-23)** — N° y emisor de la guía de despacho del pallet, declarados por el Packing List y persistidos en la reconciliación. El emisor es una Entidad tipo `PRODUCTOR` o `PLANTA`, **acotada** a las asociadas al Embarque del pallet (productores vía `Pallet.productorId`; plantas vía `Pallet.recepcion.plantaId`); un emisor fuera de ese conjunto genera discrepancia. Ver §9.3.
- `createdAt`

### 4.6 PalletLinea
- `id` (PK)
- `palletId` (FK → Pallet)
- `especieId`, `variedadId`, `categoriaId`, `articuloId` (embalaje), `calibreId`
- `cajas` (Int)
- `fechaEmbalaje` (DateTime), `etiquetaId` (FK → Etiqueta), `packingId` (FK → Entidad tipo PACKING) **(nuevo, 2026-09-21 — ver §4.10)**

### 4.7 Relaciones y cardinalidades

- NotaVenta (= CierreNegocio) `1 — 0..N` OrdenCompra *(el FK `notaVentaId` es nullable: una OC puede existir sin Cierre)*
- Entidad (tipo PRODUCTOR) `1 — N` InstructivoEmbalaje **(supersede a NotaVenta `1 — N` InstructivoEmbalaje, 2026-08-12 — ver §4.1)**
- InstructivoEmbalaje `— (sin FK) —` OrdenCompra *(relación inexistente por diseño)*
- InstructivoEmbalaje `— (sin FK) —` NotaVenta *(relación eliminada, 2026-08-12)*
- OrdenCompra `1 — N` OrdenCompraLinea
- OrdenCompra `1 — 0..1` Recepcion *(una recepción valida contra una OC; una OC se recepciona a lo más una vez en v0.1)*
- Recepcion `1 — N` Pallet
- Pallet `1 — N` PalletLinea
- Pallet `N — 0..1` Embarque *(reserva; nullable hasta reservar, desvinculable hasta confirmar despacho)*
- Pallet `N — 0..1` NotaCalidad, Pallet `N — 0..1` NotaCondicion **(nuevo, 2026-09-02 — ver §4.8)**
- Pallet `N — 0..1` Entidad (emisor de guía, relación `"PalletEmisorGuia"`) **(nuevo, 2026-10-23 — ver §4.5/§9.3)**
- PalletLinea `N — 1` Etiqueta, PalletLinea `N — 1` Entidad (tipo PACKING) **(nuevo, 2026-09-21 — ver §4.10, ambos obligatorios)**


### 4.8 Notas de Calidad/Condición y Completo/Incompleto del Pallet (2026-09-02)

> **Reutilizado por `SolicitudInspeccion` (2026-09-02, `calidad.md`).** `NotaCalidad`/`NotaCondicion` no son exclusivos del Pallet — retiraron y reemplazaron al mantenedor `Calificacion` en Solicitud de Inspección (`notaCalidadId?`/`notaCondicionId?`, restringidos por la `especieId` de la solicitud). Ver la supersesión correspondiente en `calidad.md` para el detalle de ese lado.

El Instructivo de Embalaje dejó de tener veredicto de Calidad (`calidad.md`, supersesión 2026-09-02) — como reemplazo informativo a nivel de Stock, el Pallet gana dos catálogos configurables y un flag de completitud, capturados en la Recepción de fruta:

- **`NotaCalidad`** y **`NotaCondicion`**: mantenedores "+ base" (`codigo`, `descripcion`, `descripcionExtranjera?`, `bloqueado`) — ej. Nota Calidad `A/B/C/D`, Nota Condición `1/2/3/4`. Cada uno tiene una tabla puente (`NotaCalidadEspecie`/`NotaCondicionEspecie`, `@@unique([notaId, especieId])`) que define para qué Especies es válida esa nota — mismo patrón catálogo-maestro + validez-por-especie que `ConceptoLiquidacion`/`ConceptoLiquidacionEspecie` (`productores.md`). Gestionados en Configuración → Calidad (`CONFIG_MANTENEDORES`).
- **`Pallet.notaCalidadId` / `Pallet.notaCondicionId`**: ambos opcionales, a nivel de **Pallet completo** (no de línea) — decisión de negocio: un pallet siempre tiene una única especie en la práctica (todas sus líneas comparten especie), así que el selector se restringe por la especie de la primera línea. Sin validación dura en backend contra la tabla de validez — solo restringe las opciones del selector en el frontend. FK **compuesta** `(empresaId, nota...Id) -> NotaCalidad/NotaCondicion(empresaId, id)` — mismo patrón que `recepcionId`/`embarqueId`/`productorId` en el propio Pallet (aislamiento multiempresa a nivel de BD, no solo de aplicación).
- **`Pallet.completo`** (Boolean, default `false`): indica si el pallet está completo o incompleto. Puramente informativo salvo por una regla dura: **solo pallets `completo = true` son elegibles para reservarse a un Embarque** (`ventas.md` — Embarque, paso "Seleccionar Pallets"); los incompletos siguen siendo stock disponible (visibles y filtrables en el reporte de Stock), simplemente no despachables.
  > **Supersesión (2026-09-28, decisión de negocio Christian) — "calificado".** La elegibilidad para Embarque pasa de "solo `completo = true`" a **`completo = true` + Nota de Calidad + Nota de Condición** (las tres, "calificado"). Además, "Seleccionar Pallets" ya NO oculta los no elegibles: los muestra deshabilitados (no seleccionables). Ver `ventas.md` (nota de "Seleccionar Pallets"). Las Notas de Calidad/Condición dejan de ser puramente informativas para el flujo de Embarque.

**Captura — Excel de Recepción (ambos orígenes, COMPRA y PROCESO).** El Template de Carga gana 3 columnas nuevas, opcionales de mapear (`CAMPOS_OPCIONALES_POR_TIPO`, no rompe Templates ya existentes que no las contemplan): `NOTA_CALIDAD`, `NOTA_CONDICION`, `COMPLETO`. Reglas del motor (`recepciones.motor.ts`):
- Celda vacía es válida (queda `null`/sin definir) — no es un dato obligatorio por fila.
- Si trae texto, se resuelve contra el catálogo respectivo por `codigo`/`descripcion` (mismo matching que especie/variedad/etc.) — texto que no matchea ningún registro es error de Etapa 3.
- `COMPLETO` acepta `SI/SÍ/COMPLETO/TRUE/1` → `true`, `NO/INCOMPLETO/FALSE/0` → `false` (case-insensitive, sin usar `z.coerce.boolean()` — bug sistémico ya detectado en Materiales/Productores), vacío → `null`. Cualquier otro texto es error.
- **Consistencia por N° de Pallet**: como estos 3 campos son a nivel de Pallet, si dos filas Excel del mismo N° de Pallet traen valores **no vacíos y distintos** para Nota Calidad, Nota Condición o Completo, la carga se **rechaza con error duro** (no advertencia) — decisión de negocio. Una celda vacía nunca cuenta como "distinta" de un valor presente en otra fila del mismo pallet.
- Si todas las filas del pallet traen la celda vacía: `notaCalidadId`/`notaCondicionId` quedan `null`, `completo` queda `false` (default conservador — no despachable hasta confirmarlo explícitamente).

**Edición posterior — Gestión de Pallets.** Nueva pantalla `OPERACIONES_GESTION_PALLETS` (sección Operaciones, niveles LECTURA/TOTAL), simétrica al reporte de Stock de Fruta (§11) en filtros y grilla de detalle, pero con estos 3 campos editables (selector + selector + switch) vía `PATCH /api/operaciones/stock/pallets/:id`. Existe porque el Excel puede traer estos campos vacíos y alguien necesita poder completarlos/corregirlos después sin volver a cargar el archivo.

### 4.9 DocumentoCompra (facturas y notas de crédito de proveedor)

Documentos tributarios de compra **capturados desde una base de datos / API externa** (no se emiten en FAS). La captura trae tanto **facturas** como **notas de crédito**; la NC llega **ya aplicada y conciliada** a su factura de origen.

```prisma
enum TipoDocumentoCompra {
  FACTURA
  NOTA_CREDITO
}

model DocumentoCompra {
  id                  Int                 @id @default(autoincrement())
  tipo                TipoDocumentoCompra
  folio               String                                    // folio del documento en la fuente externa
  rutProveedor        String
  entidadId           Int                                       // Entidad (PRODUCTOR / PROVEEDOR)
  fechaEmision        DateTime
  moneda              String
  montoNeto           Decimal             @db.Decimal(14, 2)
  montoTotal          Decimal             @db.Decimal(14, 2)

  // NC: referencia a la factura que rebaja (llega ya conciliada desde la fuente — NC-1)
  documentoAfectadoId Int?
  documentoAfectado   DocumentoCompra?    @relation("NcSobreFactura", fields: [documentoAfectadoId], references: [id])
  notasCredito        DocumentoCompra[]   @relation("NcSobreFactura")

  ordenesCompra       DocumentoCompraOc[]
  cuotas              CuotaDocumentoCompra[]

  origenExternoId     String                                    // id del documento en la fuente externa (idempotencia)
  capturadoEn         DateTime            @default(now())

  @@unique([origenExternoId])
  @@index([entidadId])
  @@index([documentoAfectadoId])
}

// Una factura puede abarcar 1..N OC (CO1)
model DocumentoCompraOc {
  id                Int             @id @default(autoincrement())
  documentoCompraId Int
  documentoCompra   DocumentoCompra @relation(fields: [documentoCompraId], references: [id], onDelete: Cascade)
  ordenCompraId     Int
  montoImputado     Decimal         @db.Decimal(14, 2)          // parte del documento imputada a esa OC

  @@unique([documentoCompraId, ordenCompraId])
  @@index([ordenCompraId])
}

// Vencimientos de la factura — provienen de la fuente externa (CO3), no se digitan
model CuotaDocumentoCompra {
  id                Int             @id @default(autoincrement())
  documentoCompraId Int
  documentoCompra   DocumentoCompra @relation(fields: [documentoCompraId], references: [id], onDelete: Cascade)
  numero            Int
  fechaVencimiento  DateTime
  monto             Decimal         @db.Decimal(14, 2)
  saldoPendiente    Decimal         @db.Decimal(14, 2)          // monto − NC aplicadas − pagos (CO5)

  @@unique([documentoCompraId, numero])
  @@index([fechaVencimiento])
}
```

> El **pago** de estos documentos y su imputación a la cuenta corriente del productor viven en `productores.md` (módulo Solicitud de Pago). Compras solo captura y cuadra.

### 4.10 Fecha de Embalaje, Etiqueta y Packing del PalletLinea (2026-09-21)

A diferencia de Nota de Calidad/Condición/Completo (§4.8, a nivel de **Pallet completo**), estos 3 campos van a nivel de **PalletLinea** — un mismo pallet puede mezclar cajas embaladas en fechas o packings distintos entre sus líneas.

- **`PalletLinea.fechaEmbalaje`** (DateTime): fecha en que se embaló esa línea.
- **`PalletLinea.etiquetaId`** (FK → `Etiqueta`): reutiliza el mismo mantenedor `Etiqueta` que ya usa `Articulo.etiquetaId` (materiales.md) — acá registra cuál Etiqueta se usó **realmente** en esta línea, independiente de la etiqueta por defecto del Artículo/embalaje elegido.
- **`PalletLinea.packingId`** (FK → `Entidad` tipo `PACKING`): instalación donde se embaló. `PACKING` es un tipo de `Entidad` nuevo (`entidades.md`), sin mantenedor propio — mismo patrón que `PLANTA`.

> **Obligatorios en la carga, nullable en la columna (IMP-QA-R1-032, QA ronda 1).** Los 3 campos son obligatorios en el flujo de carga por Excel (Etapa 2 del motor los rechaza si vienen vacíos), pero las columnas en sí son `nullable` a nivel de base de datos — un `NOT NULL` duro habría roto la migración sobre cualquier `PalletLinea` histórica ya existente, sin un backfill real posible (no hay forma de reconstruir con qué Packing/Etiqueta/fecha se embaló una carga pasada). Toda `PalletLinea` creada a partir de esta fecha vía el motor de carga sí trae los 3 valores siempre.

**Captura — Excel de Recepción (ambos orígenes: COMPRA y PROCESO — el motor no distingue origen para estos 3 campos).** El Template de Carga gana 3 columnas nuevas **obligatorias** de mapear (no entran en `CAMPOS_OPCIONALES_POR_TIPO` — a diferencia de §4.8, un Template de Carga existente que no las mapee queda inválido y debe editarse antes de poder procesar un nuevo Excel): `FECHA_EMBALAJE`, `ETIQUETA`, `PACKING`. Reglas del motor (`recepciones.motor.ts`):
- Celda vacía en cualquiera de las 3 es error de Etapa 2 (falta el dato), igual que Especie/Variedad/Cajas/Productor — no hay caso "vacío = sin definir" acá.
- `FECHA_EMBALAJE` acepta ISO (una celda Excel con formato Fecha real) o texto `dd-mm-aaaa`/`dd/mm/aaaa` — cualquier otro formato es error de Etapa 3.
- `ETIQUETA` y `PACKING` se resuelven contra sus maestros por `codigo`/`descripcion` (Etiqueta) o `codigo`/`descripcion`/`razonSocial` (Packing, vía Entidad tipo `PACKING`) — mismo matching que Especie/Productor. Texto que no matchea ningún registro es error de Etapa 3.
- **Sin colapso por Pallet**: a diferencia de §4.8, no hay chequeo de consistencia entre filas del mismo N° de Pallet — cada línea guarda su propio valor tal cual, porque es válido que difieran dentro de un mismo pallet.

**Sin edición posterior en esta fase**: a diferencia de §4.8 (editable en Operaciones → Gestión de Pallets), estos 3 campos solo se capturan en la carga — no hay UI de edición posterior todavía.

> **Supersesión (2026-09-28, decisión de negocio Christian) — Edición de Stock.** Estos 3 campos (Fecha de Embalaje, Etiqueta, Packing) **sí** son editables después, junto con el resto del lote (especie/variedad/categoría/artículo/calibre/cajas, agregar y eliminar líneas, y datos del pallet), desde la consulta de Stock (Reportes → Stock de Fruta) con el permiso especial `OPER_STOCK_EDICION`. Solo aplica a pallets **libres** (no reservados a un Embarque ni despachados). Backend valida referencias/coherencia y reclama el pallet atómicamente contra reservas concurrentes.

**Consecuencia operativa**: cualquier `TemplateCarga` de tipo `RECEPCION` creado antes de esta fecha debe editarse en Configuración → Templates de Carga para mapear las 3 columnas nuevas antes de procesar el próximo Excel de Recepción — sin eso, la carga se rechaza con "falta Fecha de Embalaje/Etiqueta/Packing" en cada fila.

---

## 5. Flujos de Proceso

### 5.1 Vía 1 — Compra directa

1. Se emite el **Instructivo de Embalaje** (qué embalar), usando maestros del sistema.
2. La planta embala según el instructivo.
3. **Calidad** inspecciona la fruta ya embalada (`calidad.md`).
   - **Rechazada** → el proceso termina (no hay compra).
   - **Aprobada** → continúa.
4. Se genera la **OC** de lo efectivamente embalado y aprobado (opcionalmente asociada a un Cierre de Negocio), con el informe de calidad adjunto (PDF + `informeCalidadId`).
5. La fruta se **recepciona con OC** → validación (§7) → si cuadra, entra a Stock como `COMPRA`.

### 5.2 Vía 2 — Proceso (sin OC)

> *(2026-10-01: antes "Consignación". La vía de consignación se eliminó; la recepción sin OC es siempre **Proceso**.)*

1. Se confecciona el **Instructivo de Embalaje**.
2. **No se genera OC.**
3. La fruta se **recepciona sin OC** (carga libre) a partir del reporte de stock de la planta → entra a Stock como `PROCESO`.

### 5.3 Proceso unificado (converge desde ambas vías)

1. **Recepción de Stock** genera los Pallets (con su detalle de líneas).
2. **Ventas reserva pallets** del Stock a un Cierre de Negocio / Embarque (interfaz en `ventas.md`). La reserva es directa contra Stock, independiente de la Recepción de origen.
3. Al **generar el Embarque**, la agrupación de los pallets reservados **por planta de retiro** deriva los Instructivos de Embarque hijos (`ventas.md`).
4. **AGL** provee los datos de la reserva del contenedor (solo lectura, consulta por número de embarque; ver §9.1).
5. **Packing List**: reconciliación a nivel de pallet (§9.3). Si no cuadra → el despacho no puede avanzar ni facturarse hasta cuadrar.

---

## 6. Reglas de Negocio

### 6.1 Instructivo de Embalaje ↔ OC: sin relación directa
La OC **no** se genera desde el Instructivo de Embalaje. El instructivo instruye qué embalar; Calidad verifica lo embalado; la OC nace de lo que efectivamente se embaló y fue aprobado. Los dos documentos no se referencian entre sí. La trazabilidad Compras↔Calidad corre por el **informe de inspección** (`informeCalidadId` en la OC), no por el instructivo.

### 6.2 OC editable hasta la recepción
La OC debe poder editarse hasta la Recepción. Desde 2026-10-26 (§7.2/§7.3) las diferencias de **cantidad** ya no bloquean (son advertencias aceptables), pero las **estructurales** (calibre/fruta fuera de la OC) sí — para esas, la reconciliación OC↔carga es manual: se ajusta la OC o la carga hasta que coincidan.

### 6.3 Destino de liquidación según origen
- **Fruta `COMPRA` (con OC):** precio fijo pactado en la línea de OC → es **costo de compra** → alimenta **Costos**. **No aplica Liquidación a Productor.**
- **Fruta `PROCESO` (sin OC):** *(2026-10-01)* con la eliminación de la vía de consignación, el disparador de **Liquidación a Productor** por origen de recepción queda **pendiente de redefinición**. La Liquidación a Productor como flujo aún no está implementada (existen los mantenedores `ConceptoLiquidacion` y los movimientos de Cuenta Corriente); su modelo de disparo se definirá en el spec de Liquidaciones.

### 6.4 Pallet indivisible y exclusivo
El pallet es la unidad mínima; no se divide. Pertenece a **un solo** Embarque a la vez. Debe existir la función de **desvincular/eliminar** el pallet de un embarque **mientras el despacho no esté confirmado**; una vez confirmado, se bloquea.

### 6.5 Maestro de Calibres ordenado, por especie
El maestro de Calibres tiene un campo de **orden/secuencia**, definido **por especie** (uva ≠ cereza). **(Supersesión, 2026-08-15)**: la OC y el Instructivo de Embalaje ya no persisten un rango `[calibreMin, calibreMax]` — persisten una **lista** de calibres puntuales (§4.3). El orden por especie se sigue usando solo como **atajo de captura** en el formulario (Desde/Hasta → expande y agrega todos los calibres del tramo a la lista); no es una restricción de la validación de Recepción, que ahora evalúa pertenencia a la lista (§7.2).

### 6.6 Documentos de compra (captura externa)

- **CO1 — Factura ↔ OC (N:M).** Una factura puede corresponder a una OC o abarcar **varias**. El cuadre es **por montos**: Σ `montoImputado` de la factura = `montoTotal` de la factura, y la suma imputada a cada OC no puede superar el valor de esa OC.
- **CO2 — Nota de Crédito.** Llega **ya aplicada y conciliada** a su factura desde la fuente externa → `documentoAfectadoId` es **obligatorio** cuando `tipo = NOTA_CREDITO`. Rebaja el compromiso de pago de esa factura.
- **CO3 — Vencimientos.** Las cuotas/vencimientos **provienen de la fuente externa**, no se digitan en FAS.
- **CO4 — Idempotencia.** `origenExternoId` es único: recapturar un documento ya existente no lo duplica ni lo re-imputa.
- **CO5 — Saldo de la cuota.** `saldoPendiente` = `monto` − NC aplicadas − pagos confirmados. **Se paga la factura menos la NC aplicada** (NC-2); la Solicitud de Pago (`productores.md`) opera sobre el neto.
- **CO6 — Impacto en cuenta corriente.** Al capturarse, el documento impacta **de inmediato** la cuenta corriente del productor (`productores.md`): la **factura** genera `HABER`, la **nota de crédito** genera `DEBE` (inverso). El **pago** confirmado genera `DEBE`.
---

## 7. Motor de Validación de Recepción (con OC)

Aplica **solo en modo compra** (Recepción con OC). En modo proceso (sin OC) no hay validación contra documento previo (carga libre).

**Principio:** validación **por totales de cada línea de OC** (por combinación completa), **no** por pallet ni por característica marginal. La distribución de calibres/características dentro de cada pallet es irrelevante. **Todo o nada.**

### 7.1 Agrupación
Agrupar las líneas del Excel por la combinación **especie + variedad + categoría + embalaje (artículo)** — la misma combinación que identifica una línea de OC. La combinación importa: *RedGlobe debe ser CAT1*; no basta con que los marginales (variedad por un lado, categoría por otro) cuadren por separado.

### 7.2 Validaciones por línea de OC
Para cada línea de OC, contra el grupo correspondiente del Excel:

> **⚠️ Supersesión (2026-10-26) — cantidades distintas se permiten (avisando).** Las diferencias de **cantidad** (N° de pallets y cajas, de más o de menos) dejan de ser un error que bloquea: pasan a ser **ADVERTENCIAS aceptables** — "recepcionar cantidades distintas a la OC". El backend las devuelve en `advertencias` (+ `adjuntoId`), el frontend las muestra y el usuario puede **recepcionar de todas formas**; se audita en `Recepcion.advertenciasAceptadas`/`advertenciasDetalle` (mismo flujo que las advertencias de PROCESO contra el Instructivo). Los pallets se generan desde el **Excel** (lo realmente recibido); la OC **no** se modifica. Las validaciones **estructurales** (puntos 3 y 4) siguen bloqueando: la fruta que no corresponde a la OC no es una diferencia de cantidad.

1. **N° de pallets:** diferencia OC vs Excel → **advertencia** (se puede recepcionar igual).
2. **Cajas** (**campo `cajas` de la línea**, no `cantidadPallets × cajasPorPallet` — ver nota en §4.3, 2026-08-07): diferencia OC vs Excel → **advertencia** (se puede recepcionar igual).
3. **Calibre (pertenencia a la lista):** **(Supersesión, 2026-08-15 — reemplaza la validación por rango)** **ningún** calibre del Excel puede quedar fuera de la **lista** de calibres de la línea (`OrdenCompraLineaCalibre`, §4.3). Ej.: OC permite calibres {3, 5, 7, 8} → si aparece 1, 2, 4 o 6 en el Excel, **rechazo** (error que bloquea). La distribución entre pallets no bloquea; lo que bloquea es un calibre no listado.
4. **Cobertura:** cualquier combinación/característica del Excel que **no** corresponda a ninguna línea de OC → **error que bloquea** (la fruta no está en la OC).

### 7.3 Resultado
- **Todo cuadra** (o solo hay diferencias de cantidad aceptadas) → se cargan los pallets a Stock (con `origen = COMPRA`), con las cantidades **del Excel** (lo realmente recibido).
- **Diferencia de cantidad** (N° de pallets / cajas) → **advertencia** (⚠️ supersesión 2026-10-26): no bloquea. El backend responde con `advertencias` + `adjuntoId`; el usuario puede **recepcionar de todas formas** (se audita `advertenciasAceptadas`/`advertenciasDetalle`). Ej.: *"Suma de cajas: hay `X` cajas de más del calibre/línea `AB` respecto de la OC."*
- **Error estructural** (la fruta no corresponde a la OC) → **rechazo total** de la carga. Mensaje: *"No coincide la OC con la carga"* + lista de diferencias:
  - *Embalaje / categoría / variedad `XXXX` de las líneas `w,x,y,z` del Excel no está en la OC.*
  - *Calibre `N` de las líneas `a,b,c` del Excel no está en la lista de calibres de la OC.*

> El detalle de diferencias existe para que la planta corrija y reenvíe el archivo.

---

## 8. Estados y Bloqueos

- **InstructivoEmbalaje:** sin máquina de estados (documento emitido).
- **OrdenCompra:** `Borrador → Emitida → Recepcionada` (editable hasta recepcionar; ver §6.2). *(Detalle fino de estados a afinar en implementación.)*
  > **Disparador de `Emitida` (2026-10-06).** La transición `Borrador → Emitida` la dispara **emitir el documento oficial de la OC** (motor de Documentos, `POST /api/documentos/orden-compra/:id/emitir`): al congelar el PDF oficial, el estado pasa a `EMITIDA`. Es idempotente (compare-and-swap `estado=BORRADOR` en el `where`): reemitir no la "re-emite", y una OC ya `EMITIDA`/`RECEPCIONADA` no se toca. El snapshot del documento y la transición de estado **no comparten transacción**, pero la idempotencia lo cubre: si la transición no alcanzara a aplicarse, reemitir (operación idempotente del motor) la corrige. El `<Select>` manual de estado en el formulario se conserva como vía alternativa.
- **Recepcion:** `Cargada → Validada` (modo OC) · `Cargada → Validada` (modo proceso — valida contra Instructivos, §4.4/§5.2). Carga es todo-o-nada; una carga rechazada no genera pallets.
- **"Standby" de despacho (Packing List):** no es un estado formal nuevo; es la condición de **no poder avanzar los pasos siguientes ni facturar** mientras haya discrepancia PL↔reserva. Se modela como bloqueo sobre el Embarque/Despacho (`ventas.md`), no como un estado propio de Compras.

---

## 9. Integraciones y Dependencias

### 9.1 AGL360 (sistema propio, en desarrollo) — escritura + confirmación por webhook

> **Supersesión (2026-09-05):** este párrafo describía una integración de **solo lectura** ("Agrosan solicita... FAS consulta por número de embarque y AGL devuelve la información. Sin escritura ni sincronización bidireccional") que nunca se implementó. Lo que se construyó es distinto y más rico — ver `ventas.md` §4.3 para el modelo/flujo completo.

AGL360 es un sistema propio de Agrosan (no una `Entidad` del mantenedor, todavía en desarrollo) que gestiona la **reserva del contenedor**. FAS **escribe** la solicitud (al generar el Embarque, `POST` saliente con cliente/destino/cajas totales) y AGL360 **confirma de vuelta** por webhook (`POST /api/ventas/embarques/webhooks/agl360-confirmacion`, autenticado por API key compartida, sin sesión de usuario) con el detalle: número de contenedor, número de booking, naviera, nave, fechas de retiro por planta, etc. — ver `Embarque.estadoReserva` (`PENDIENTE → SOLICITADA → CONFIRMADA`) y modelo `SolicitudReserva`.

Si la llamada saliente a AGL360 falla (el sistema todavía no existe o está caído), el usuario decide si generar el Embarque igual sin reserva (`PENDIENTE`, reintentable después) — no bloquea el flujo de Ventas. Adapter mockeable (`AGL_PROVIDER=mock|agl360`, mismo patrón que el proveedor DTE) mientras AGL360 no tenga un ambiente real.

### 9.2 Mantenedor de formatos de carga (columnas por planta/origen)
Patrón único reutilizado tanto para el **reporte de stock de la planta** (recepción en modo proceso) como para el **Packing List**: un mantenedor que mapea, por planta/origen, cada dato requerido por la aplicación a su **columna del Excel** y **fila de inicio**. Si más adelante alguna planta envía PDF, se amplía con lectura IA (§10).

> **Formato de archivo aceptado (decisión, 2026-08-17 — QA-RCV-001):** el lector de Recepción solo admite `.xlsx` (OOXML) — ExcelJS no soporta el formato binario legado BIFF (`.xls`). El enunciado de este párrafo y de §4.4 ("Excel u otro cargado") es genérico, pero la implementación v0.1 exige `.xlsx`; si una planta entrega `.xls`, debe convertirse a `.xlsx` antes de subirlo. Soporte nativo de `.xls` queda diferido — ver §10.

> **Códigos alternativos de maestros en la carga (2026-10-14).** Especie, Variedad, Categoría y Calibre ganan una lista de **códigos alternativos** (`<maestro>_codigos_equivalentes`: `codigo` + `descripcion?` de a qué corresponde — cliente/proveedor/legacy), igual que `ArticuloCodigoEquivalente`. La carga de stock (`findXByTexto` en `recepciones.repository.ts`) matchea cada campo **además** por estos códigos, con **precedencia**: primero resuelve por código/descripción principal y solo si no hay match cae a los códigos alternativos (así un código principal gana sobre el alias de otro registro — determinista). Si un alias es compartido por más de un registro, **no se elige arbitrariamente**: queda sin resolver (fila reportada como no encontrada), nunca una asignación incorrecta silenciosa. Aplica tanto a **Recepción como a Packing List** (comparten el loader), y se cableó también el match de **Artículo** con sus códigos equivalentes ya existentes (antes no se usaban). Editables en el mantenedor de cada maestro; el CRUD genérico (`config`) los sincroniza (reemplaza toda la lista) y los expone vía `includeMap`. Variedad/Categoría/Calibre se matchean scoped por especie (igual que código/descripción).

> **Formato base guiado por la OC (2026-10-14).** En modo COMPRA, al descargar el formato base desde una Recepción con Orden de Compra, el Excel viene **precargado y validado con los datos de la OC**: la descarga pide la **cantidad de registros/filas** (sugerida = total de pallets de la OC, editable) y por cada campo que la OC restringe —`ESPECIE`, `VARIEDAD`, `CATEGORIA`, `ARTICULO`, `CALIBRE`, `ETIQUETA`, `PRODUCTOR`— calcula los valores distintos de sus líneas: **un solo valor → se precarga** en todas las filas; **varios valores → dropdown** (data validation `list`) restringido a esos valores. Los dropdowns son **por campo independiente** (no en cascada): si la OC tiene combos distintos, Excel deja elegir combinaciones inválidas, pero la **validación dura al cargar** (`compararLineasOcConExcel`) las rechaza igual — el dropdown es una ayuda, no la barrera. El texto precargado es la **descripción** del maestro (el cargador `findXByTexto` acepta código o descripción). Endpoint `GET /compras/recepciones/formato-base-oc?templateCargaId&ordenCompraId&filas`; el generador extendido es `templates-carga.excel.ts → generarFormatoBase(t, { filas, guia })`. Tipo de pallet no se guía (no es columna del Template de Carga). La descarga sin OC (modo PROCESO o sin OC) sigue entregando el Excel en blanco de siempre.
>
> **Refinamientos (2026-10-14):** (1) los campos de **valor único** además de precargarse quedan **validados** (dropdown de 1 opción, no editable a algo inválido); (2) **Artículo** se precarga/valida por su **código** (no descripción); (3) **Productor** se precarga con `"{codigoCsg} - {nombreCsg}"` de los **Predios** del productor de la OC (varios predios → dropdown); el match de carga es por el **código CSG** (`findProductorByTexto` toma la parte antes de `" - "` y busca el Predio por `codigoCsg`), con el fallback histórico a la Entidad (código/descripción/razón social) para los Packing List reales que traen el código de la Entidad; (4) **Nota de Calidad/Condición** son dropdowns con la lista **del maestro** (todas las activas), no de la OC; (5) la columna **Completo** trae dropdown **SI/NO**; (6) **Fecha de Embalaje** queda con **formato de celda fecha** (`dd-mm-yyyy`); (7) **Packing**: si la **Planta** de la Recepción también es tipo `PACKING`, se precarga `"{csp} - {nombre}"` (match por CSP, `findPackingByTexto`); si no, en blanco. El endpoint gana `plantaId`; el generador soporta `precarga`/`opciones`/`formatoFecha` por campo.

### 9.3 Packing List — reconciliación (interfaz con `ventas.md`)
Comparación a **nivel de pallet**, en dos pasos:
1. Los **números de pallet** del PL = los números de pallet **reservados** al embarque.
2. El **detalle de cada pallet** del PL = el detalle del pallet en Stock.

Discrepancia → se informan las diferencias y el despacho queda bloqueado (no facturable) hasta cuadrar.

**Formato de carga (2026-09-21).** El Template de Carga tipo `PACKING_LIST` (§9.2) tiene columnas definidas — todas obligatorias (`CAMPOS_POR_TIPO.PACKING_LIST`, `templates-carga.types.ts`): `NUMERO_PALLET`, `ESPECIE`, `VARIEDAD`, `CATEGORIA`, `CALIBRE`, `ARTICULO`, `CAJAS`, `PRODUCTOR`, `ETIQUETA`, `FECHA_EMBALAJE` — mismos campos que Recepción salvo Nota Calidad/Condición/Completo y Packing, que no aplican acá. **(2026-10-23)** Se suman dos columnas **opcionales** `NUMERO_GUIA` y `EMISOR_GUIA` (ver nota "Columnas Guía de Despacho por pallet" más abajo).

> **Implementado (2026-09-22) — cierra EP-QA-003.** Motor de reconciliación construido en `fas-api` (`ventas/embarques/embarques.packing-list.motor.ts` + `embarques.comparacion.ts`): mismas 4 etapas que el motor de Recepción (Template → Filas → Maestros → Comparación), reusando los lookups texto→ID de `recepciones.repository.ts`. A diferencia de Recepción, no inserta nada — los pallets ya existen en Stock; solo compara y persiste el resultado en `EmbarquePackingList` (a lo más una fila vigente por Embarque, cada subida reemplaza la anterior). Errores de formato/mapeo/maestros abortan la subida (nada se guarda, mismo criterio que Recepción); las discrepancias de negocio (Paso 1/2 de arriba) SÍ se guardan como estado `DISCREPANCIA` para que el usuario vea qué corregir y reintente. `Embarque.confirmarDespacho()` exige `EmbarquePackingList.estado = OK` — sin Packing List reconciliado, o con discrepancias, el despacho queda bloqueado. Endpoint `POST /embarques/:id/packing-list` (multipart + `templateCargaId` en query) y `GET /embarques/:id/packing-list/descarga`; pestaña "Despachar" del Embarque en `fas-web`. El **detalle comparado** en el Paso 2 es especie/variedad/categoría/artículo/calibre/cajas (agregado por combo) + productor — Etiqueta/Fecha de Embalaje del Excel se resuelven contra los maestros (validación de calidad de dato) pero no participan de la comparación.

> **Supersesión (2026-09-28, decisión de negocio Christian) — Packing List parcializado.** Pasa de "a lo más una fila vigente por Embarque, cada subida reemplaza la anterior" a **N archivos que se ACUMULAN**, cada uno cubriendo un **subconjunto** de los pallets reservados. Cambios: (1) cada archivo se reconcilia solo contra el subconjunto de pallets que declara (se rechazan los "ajenos" no reservados; el detalle se compara solo contra ese subconjunto, ya no se exige que estén todos); se guarda `numerosPallet` (los N° que cubre). (2) Al subir se rechaza el **solape** con pallets ya cubiertos por otro archivo activo (bajo el mismo advisory lock). (3) El despacho se habilita solo cuando la **unión** de los archivos OK cubre **exactamente** los pallets reservados (todo o nada) — nuevo resultado `PACKING_LIST_INCOMPLETO` si faltan. (4) Se puede **eliminar** un archivo (`DELETE /embarques/:id/packing-list/:packingListId`) para corregir; la descarga admite `?packingListId=`. `EmbarquePackingList` gana la columna `numerosPallet Json`. Migración con backfill: los Packing List OK existentes (que bajo la semántica vieja cubrían todos los reservados) se rellenan con los N° de pallet reservados de su Embarque.

> **Columnas Guía de Despacho por pallet (nuevo, 2026-10-23).** El template `PACKING_LIST` (§9.2) gana dos columnas **OPCIONALES** (no obligatorias, a diferencia del resto de `CAMPOS_POR_TIPO.PACKING_LIST`): `NUMERO_GUIA` ("N° Guía de Despacho") y `EMISOR_GUIA` ("Emisor de la Guía"). Se persisten **por pallet** en `Pallet.numeroGuiaDespacho` / `Pallet.emisorGuiaId` (§4.5). Reglas del motor:
> - **Emisor acotado server-side:** el `EMISOR_GUIA` debe resolver a una Entidad tipo `PRODUCTOR` o `PLANTA` **asociada al Embarque** — productores vía `Pallet.productorId`, plantas vía `Pallet.recepcion.plantaId`. Un emisor fuera de ese conjunto genera **discrepancia** en la reconciliación (no se persiste ese pallet).
> - **Consistencia por pallet:** si distintas filas del mismo pallet traen `NUMERO_GUIA` o `EMISOR_GUIA` **distintos** entre sí → discrepancia (ese pallet no se persiste). **Celda vacía = no se declara**: ese campo queda `undefined` y **no se toca** el valor existente del pallet (no se escribe `null` implícito).
> - **Solo se consolida en estado OK (decisión 2026-10-23):** la guía se persiste en los pallets **solo si la reconciliación del archivo quedó `OK`**. Si el Packing List queda en `DISCREPANCIA` global, **no** se persiste ninguna guía (ni la de los pallets individualmente consistentes). El PL es parcializado/acumulativo, así que un archivo solo toca sus propios pallets. Persistencia **dentro de la misma transacción** de `guardarPackingList`, bajo el lock del despacho.
>
> **⚠️ Supersesión (2026-10-27, decisión de negocio Christian) — `NUMERO_GUIA` y `EMISOR_GUIA` pasan a OBLIGATORIOS.** Ya **no** son opcionales: (a) deben **mapearse** al crear/editar un Template `PACKING_LIST` (salen de `CAMPOS_OPCIONALES_POR_TIPO.PACKING_LIST` en back y front — solo `TERMOGRAFO`/`TEMPERATURA` siguen opcionales); (b) el motor exige **valor por fila** (`validarFilasCompletas`, Etapa 2): una fila sin N° de Guía o sin Emisor es **error de formato y aborta la carga** (nada se guarda), igual que el resto de las columnas obligatorias — ya no aplica "celda vacía = no se declara" para estos dos campos. Los Templates `PACKING_LIST` **históricos** sin esas columnas deben **actualizarse** (mapearlas) para volver a usarse. `TERMOGRAFO`/`TEMPERATURA` conservan la semántica "celda vacía = no se declara".
> - **Se limpia al eliminar el PL (decisión 2026-10-23):** eliminar (soft delete) un archivo de Packing List **limpia** `numeroGuiaDespacho`/`emisorGuiaId` (`null`) de los pallets que ese archivo cubría — la guía se considera originada por el PL; sin él, se revierte.
> - **Pendiente opcional:** el **dropdown acotado** del emisor en el Excel generado NO se implementó — la acotación al conjunto del Embarque es **solo server-side** por ahora. *Pendiente opcional.*

> **Temperatura y termógrafo por pallet (nuevo, 2026-10-25).** El template `PACKING_LIST` gana una columna **OPCIONAL** `TEMPERATURA` ("Temperatura (°C)") y el `TERMOGRAFO` pasa a **asociarse por pallet** (antes solo se guardaba la lista `EmbarquePackingList.termografos`, que se mantiene por compatibilidad). Ambos se persisten por pallet en `Pallet.temperatura` (`Decimal?`) / `Pallet.termografo` (`String?`), con las **mismas reglas** que la guía: consistencia por pallet (valores distintos dentro del pallet → discrepancia), celda vacía = no se declara (undefined, no se toca), solo se consolidan si el PL quedó `OK`, y se limpian al eliminar el archivo. La temperatura no numérica genera discrepancia.

> **Emitir Packing List (reporte Excel, nuevo 2026-10-25).** FAS genera/emite un Packing List en Excel desde un Embarque (`GET /ventas/embarques/:id/packing-list/emitir`, nivel `LECTURA` del ítem `VENTAS_EMBARQUES`; generador `embarques.packing-list-emision.ts` con ExcelJS). Mismas columnas que el Packing List de referencia (Edge2) pero **layout propio** de FAS: una sola hoja, cabecera (Exporter+RUT, Customer, SII Receptor, Consignee, Instructive, Vessel, puertos, ETD/ETA, Container(s), BL/AWB), tabla de pallets (una fila por línea de pallet) y totales calculados (cajas, Net Kg, N° de pallets). Columnas: N° Pallet, Container, Tº, Termógrafo, CSG, GGN, Productor (+comuna/provincia), CSP, Packing (+comuna/provincia), Especie, Variedad, Categoría, Calibre, Fecha Embalaje, Artículo (código), Kg Neto Envase, Etiqueta, Cajas, Net Kg, N° Guía, Emisor. **Limitación:** `CSG`/`GGN` salen del `Predio` del productor **best-effort** — solo se llenan si el productor tiene UN único Predio **vigente** (`eliminadoEn: null`; el Pallet guarda `productorId`, no un Predio puntual); con 0 o varios predios vigentes quedan en blanco. `CSP` sale de `planta.csp`. La **comuna/provincia del packing** sale de la dirección **vigente** de la planta, elegida de forma determinista: la marcada **por defecto** (`esPorDefecto`) y, a igualdad, por `codigo`. `Hatch` y `Subcategory` del formato Edge2 se omiten (FAS no los tiene). El **Exporter + RUT** de la cabecera toman el **exportador de la Nota de Venta** (EXPORTADORA, RUT = `identificador`); si la NV no tiene exportador ("Sin exportador"), caen a la **Empresa activa** (razón social + RUT).

### 9.4 Calidad (`calidad.md`)
La Solicitud/Informe de Inspección habilita la generación de la OC en la vía de compra directa. La OC referencia el informe (`informeCalidadId` + PDF).

### 9.5 Fuente externa de documentos de compra (BD / API)

Las **facturas** y **notas de crédito** de proveedor se **consumen** desde una base de datos o API externa; FAS no las emite. La captura es idempotente por `origenExternoId` (CO4) y trae:
- cabecera (tipo, folio, RUT proveedor, fecha, moneda, montos),
- **vencimientos/cuotas** ya definidos (CO3),
- para NC, la **factura afectada** ya conciliada (CO2).

Tras capturar, FAS imputa el documento a una o varias OC por montos (CO1) y refleja el impacto en la cuenta corriente del productor (CO6).

> *Detalle del contrato de la fuente externa (endpoint, autenticación, formato): pendiente.*
---

## 10. Pendientes, Supuestos y Deudas Cross-Módulo

**Pendientes de definición:**
- **OC suelta → Cierre a posteriori** — el modelo ya permite una OC **sin** Cierre (FK `notaVentaId` nullable). Queda diferido el **flujo/UX** de digitar una OC suelta y **ligarla** a un Cierre después (endpoint de vinculación + regla de qué campos se bloquean al vincular). *Diferido.*
- **Detalle de campos AGL360** — ~~qué campos exactos devuelve la consulta por número de embarque~~ **(resuelto por mecanismo, 2026-09-05, ver §9.1 y `ventas.md` §4.3)**: la mecánica (webhook + campos numeroBooking/naviera/nave/numeroContenedor/fechaZarpe/fechaRetiroPlanta) ya está definida y construida. El formato exacto de esos campos puede seguir ajustándose recién cuando AGL360 tenga un ambiente real — hoy corre en modo mock.
- **Lectura IA / PDF** — Recepción y Packing List en formato PDF vía IA (Etapa 2). El mantenedor de columnas resuelve Excel en v0.1. *Pendiente.*
- **Soporte `.xls` (BIFF legado)** — el lector actual solo acepta `.xlsx` (§9.2, QA-RCV-001, 2026-08-17); hay planillas reales de al menos una planta en `.xls`. Requiere una librería adicional para BIFF y normalizar su salida hacia la misma estructura de filas que `.xlsx`. *Diferido — mientras tanto, la planta debe convertir a `.xlsx` antes de subir.*
- **Template de Carga por planta/origen** — `TemplateCarga` (§9.2) ya distingue **tipo** (`RECEPCION`, `PACKING_LIST`, whitelist ampliable sin migración), pero todavía no está asociado a una planta/origen como dice el enunciado de §9.2 ("mapea, por planta/origen..."). Hoy el picker de Recepción filtra solo por tipo, no por la planta elegida en el encabezado. Falta definir la cardinalidad (¿un template por planta+tipo, o varios seleccionables por planta?) antes de modelarlo. Hallazgo QA `QAS-TCT-001` (ronda 1, 2026-08-03) — diferido a propósito, fuera del alcance de la introducción de `tipo`. *Diferido.*

**Deudas cross-módulo (a aplicar):**
- **`ventas.md` — corrección del modelo de Embarque/Instructivo** (parche listo, resumen abajo).
- **`reclamos.md` — FK** `instructivo` (texto libre) → FK al **Embarque**. Desbloqueada al cerrar Ventas.
- **Costos / Liquidación** — el `precioUsdCaja` de la línea de OC alimenta **Costos** (fruta comprada). *(2026-10-01: con la eliminación de la vía de consignación, el disparador de Liquidación a Productor para fruta sin OC queda pendiente de redefinición — ver §6.3.)*

**Supuestos asumidos (confirmar si difieren):**
- El flag de origen (`COMPRA`/`PROCESO`) vive a nivel de Recepción y se propaga a los pallets.
- `cajasPorPallet` en la OC sirve solo para el total esperado, no como tope por pallet.

---

## 11. Reporte de Stock en Pantalla

Pantalla de consulta **solo lectura** del stock de fruta ya recepcionada **y aún disponible** (sin reservar a un Embarque). Vive en el ítem de menú `REPORTES_STOCK_FRUTA` (sección **Reportes**), pero se documenta acá porque lee directamente `Pallet`/`PalletLinea` (§4.5/§4.6) sin agregar modelos nuevos.

> **Supersesión (2026-09-02, EP-QA-005).** Desde que `Pallet.embarqueId` existe (§4.5/§4.7 — reserva a Embarque), el reporte excluye los pallets ya reservados (`embarqueId IS NOT NULL`): dejaron de ser stock disponible. Antes de esta fecha el reporte mostraba todo lo recepcionado sin distinguir reserva, porque `embarqueId` no existía todavía.

> **⚠️ Supersesión (2026-08-24).** Reemplaza la versión anterior de esta sección (ítem `OPER_STOCK` en sección Operaciones, endpoint de resumen agrupado + endpoint de detalle con filtros server-side). Tras revisar un mockup interactivo con el usuario, la pantalla se rediseñó como tarjetas por especie + filtros multiselect en cascada + grilla expandible — eso exige tener el dataset completo disponible en el cliente para acotar los filtros al instante, así que el contrato de API se simplificó a un único endpoint sin filtros. El ítem de menú se reubicó de Operaciones a Reportes en el mismo cambio (decisión de negocio, Christian).

- **Backend:** `fas-api`, `/api/operaciones/stock` (el prefijo de API sigue bajo `operaciones` — independiente de la sección de menú del frontend, mismo patrón que `OPER_MATERIALES` vive en `/api/materiales`).
- **Frontend:** `fas-web`, `/dashboard/reportes/stock-fruta`.
- **Permiso:** ítem `REPORTES_STOCK_FRUTA`, nivel `LECTURA` (solo consulta, sin nivel de escritura).

### 11.1 Endpoint único — dataset completo, sin filtros server-side

`GET /api/operaciones/stock` — sin query params. Devuelve `{ data: StockDetalleRow[] }`, una fila por `PalletLinea` vigente de la empresa, con:

- `especie`/`variedad`/`categoria`/`calibre` (id + `{id, codigo, descripcion}`)
- `productor` (`{id, codigo, descripcion}`)
- `origen` (`COMPRA`|`PROCESO`)
- `estado` — `Recepcion.estado` del Pallet padre (`CARGADA`|`VALIDADA`; `RECHAZADA` nunca llega acá porque esa Recepción no genera Pallets)
- `fechaRecepcion` — `Pallet.creadoEn`
- `numeroPallet`, `palletId`, `palletLineaId`
- `cajas`
- `kg` — `cajas × Articulo.kgNetoEnvase` de la línea (peso **neto** de fruta, sin el embalaje; decisión de negocio, Christian, 2026-08-24) — `0` si el artículo no tiene `kgNetoEnvase` configurado

Filtrado, agrupación (especie/variedad/calibre/categoría), tarjetas por especie y drill-down a pallet se resuelven **en el cliente** sobre este dataset completo.

### 11.2 Tarjetas por especie y antigüedad

Por especie: cajas totales, kilos totales, y apertura por **antigüedad** en 3 tramos — reemplaza la apertura por `estado` que tenía la versión anterior de esta pantalla (Validada/Cargada sigue existiendo, pero ahora solo como filtro y como columna del detalle, ver §11.3/§11.4). Antigüedad = `hoy − fechaRecepcion` (fecha de recepción del Pallet, **no** de cosecha), calculada en el cliente contra la fecha del navegador en cada carga (no se persiste ni es un filtro):

- 0–7 días
- 8–15 días
- +15 días

### 11.3 Grilla de detalle

Fila cabecera agrupada por **Especie / Variedad / Calibre / Categoría** (cajas + kilos de la combinación), expandible a las líneas de Pallet individuales que la componen: **Folio** (`numeroPallet`) / Productor / Antigüedad (días) / Estado / Cajas / Kilos / **Nota Calidad / Nota Condición / Completo** (nuevo, 2026-09-02, §4.8 — a nivel de Pallet, se repiten idénticas en todas las líneas de un mismo pallet; solo lectura acá, editables en Operaciones → Gestión de Pallets). Sin porcentajes.

> **Supersesión (2026-10-27, decisión de negocio, Christian) — aplica a AMBAS pantallas (Stock de Fruta §11 y Calificación de Pallets §4.8).** Se retiran **Estado** (filtro + columna) y **Kilos** (columnas) de **ambas** pantallas: muestran exactamente los **mismos datos** (cajas y clasificación). La **única diferencia** entre ellas es la **posibilidad de edición** (Calificación de Pallets edita Nota Calidad/Condición/Completo del pallet; Stock de Fruta es solo lectura) — la simetría §4.8 ↔ §11 en datos/filtros se mantiene total. *(Corrige la versión previa de esta nota, que por error dejaba Estado/Kilos en Calificación de Pallets.)*

### 11.4 Filtros

Multiselect, en este orden fijo: **Especie, Variedad, Calibre, Categoría, Estado, Productor, Nota Calidad, Nota Condición, Completo** (los 3 últimos, nuevo 2026-09-02). En cascada: las opciones de cada filtro se calculan sobre el dataset ya acotado por los demás filtros activos (excluyéndose a sí mismo) — una opción sin cajas bajo la selección actual se deshabilita en vez de ocultarse, para que se entienda por qué no está disponible. No hay filtro de origen ni de rango de fecha (decisión de negocio, Christian, 2026-08-24 — el origen sigue viajando en cada fila por si se necesita más adelante, solo no se expone como filtro ni columna).

> **Supersesión (2026-10-27, decisión de negocio, Christian):**
> - **Filtro Estado:** se **retira de AMBAS pantallas** (quedan: Especie, Variedad, Calibre, Categoría, Productor, Nota Calidad, Nota Condición, Completo). *(Corrige la versión previa, que lo conservaba en Calificación de Pallets.)*
> - **Conteo de cajas en los filtros:** el número por opción (`X caj.`) deja de mostrarse en **ambas** pantallas (declutter). La **cascada se mantiene intacta**: el conteo se sigue calculando internamente para **deshabilitar** las opciones que quedan en 0 bajo la selección actual; solo se oculta el badge numérico (`MultiCombobox hideCount`).
> - **Stock de Fruta** ubica **Planta** en una 2ª fila de filtros y reduce el ancho de los inputs de días (desde/hasta). Los filtros van en una tarjeta **sticky** (ambas pantallas) para no perderlos al expandir el detalle.

### 11.5 Notas de implementación

- **No descuenta reservas/despacho.** Hoy `Pallet` no tiene `embarqueId` real (§4.5 lo describe como diferido), así que el reporte muestra **todo** el stock recepcionado, sin distinguir lo ya reservado a un Embarque. Cuando `Pallet.embarqueId` se implemente, este reporte deberá excluir o marcar los pallets ya reservados/despachados para seguir representando "disponible" y no solo "recepcionado". *Pendiente, depende de Embarque↔Pallet.*
- **Sin paginación ni límite.** El endpoint trae todo el stock vigente de la empresa en una sola respuesta (necesario para que los filtros en cascada no dependan de ida y vuelta al servidor) — asumible mientras el volumen sea el de una bodega en operación normal. Como además no hay forma de excluir lo ya embarcado (punto anterior), el dataset **crece sin límite temporada tras temporada** hasta que exista `Pallet.embarqueId`. Revisar si hace falta acotar por fecha o por embarque antes de que el payload se vuelva un problema real de performance. *Riesgo aceptado por ahora (decisión de negocio, Christian).*
- `PalletLinea` no es modelo tenant (tabla hija sin `empresaId` propio, mismo patrón que `OrdenCompraLinea`/`NotaVentaDetalle`) — el listado se resuelve leyendo desde `Pallet` (que sí es tenant, así que el Prisma Client Extension aplica el filtro de empresa automáticamente) e incluyendo sus líneas, no con una consulta directa sobre `PalletLinea`.

---

### Anexo — Parche a aplicar en `ventas.md` (modelo Embarque / Instructivo de Embarque)

Reemplaza el modelo anterior ("Nota de Venta → múltiples Instructivos, uno por contenedor"):

> **Cierre de Negocio (= Nota de Venta)** — numeración propia. Genera 1..N Embarques.
>
> **Embarque** — se genera desde la Nota de Venta. Representa un contenedor. Lleva PK `Int` incremental interno + **Número de Instructivo** (campo `Folio`, texto, manual, único; ej. `001A`) como código de negocio. **`Folio` = Número de Instructivo** (mismo dato). El Número de Instructivo es la identidad del instructivo **padre** — el padre **no** es una tabla aparte, es el Embarque mismo. Es el **ancla canónica**: Despacho, Facturas, Reclamos, Liquidaciones y Precios referencian al Embarque por FK.
>
> **InstructivoEmbarqueHijo** — 1..N por Embarque, **siempre ≥ 1**. Uno por planta / punto de retiro. Código **autogenerado** `{folio}-{n}` (ej. `001A-1`, `001A-2`). Contiene fecha/hora de retiro de esa planta. Con una sola planta hay un único hijo (`001A-1`), para mantener la nomenclatura actual.
>
> La partición en hijos se **deriva de la reserva de pallets** al embarque, agrupando por planta de retiro.
