# Módulo Compras — Ciclo de Compras (`compras.md`)

> **Proyecto:** FAS — Frutera Agrosan Sistema
> **Estado:** Definición cerrada a nivel de modelo · v0.1
> **Precede a:** implementación (Claude Code) · **QA:** Codex (read-only)
> **Depende de:** `calidad.md` (Solicitud/Informe de Inspección), `ventas.md` (Cierre de Negocio, Embarque, reserva de pallets), `mantenedores-generales.md` (Artículos, Especies, Variedades, Categorías, Calibres)

---

## 1. Propósito y Alcance

El módulo Compras cubre el ciclo completo de adquisición y recepción de fruta, desde la instrucción de embalaje hasta la incorporación de la fruta al stock disponible para embarque. Contempla dos vías de origen —**compra directa** (con Orden de Compra) y **consignación** (sin Orden de Compra)— que convergen en un único módulo de Recepción de Stock.

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
Instrucción de qué embalar. **Sin estado propio** — es solo un documento que se emite. **Sin FK a OC** (la relación es inexistente; ver §6.1). Su valor es estandarizar usando maestros en vez de texto genérico.

> **Editable después de emitido (2026-08-15).** Al no tener estado propio, no existe ninguna transición que bloquee su edición — a diferencia de la OC (`RECEPCIONADA`, §6.2). Tampoco depende de otro documento que pudiera bloquearla (ya no tiene FK a NV — ver supersesión abajo). `PATCH /api/compras/instructivos-embalaje/:id` reemplaza cualquier combinación de `entidadProductorId`/`grupoMercadoId`/`fechaInicioPrograma`/`observaciones` y/o el `detalle` completo de forma atómica (dropea y recrea las líneas, mismo patrón que el reemplazo de calibres en `OrdenCompraLinea.actualizarLinea`).
>
> **Eliminable — soft delete (2026-08-10).** `DELETE /api/compras/instructivos-embalaje/:id` (nivel `TOTAL`) marca `eliminadoEn`/`eliminadoPor` — nunca DELETE físico (CLAUDE.md §12 regla 8). Igual que la edición, sin transición de estado que lo bloquee. El listado y el detalle filtran `eliminadoEn: null`.
>
> **Perfil recomendado para editar (2026-08-15, IE-EDIT-QA-003 — actualizado 2026-08-12).** El formulario de edición completa su selector de Artículo consultando el endpoint de Materiales, protegido por su propio ítem (`OPER_MATERIALES`) — no por `COMPRAS_INSTRUCTIVO`. El selector de Cierre Comercial que originaba este hallazgo **ya no existe** (supersedido por Productor, arriba); el mismo riesgo teórico ahora aplicaría al selector de Productor (`entidadesService`, ítem `CONFIG_ENTIDADES`) pero, igual que en `orden-compra-form.tsx` (que depende de `CONFIG_ENTIDADES` para su propio selector de Productor sin mitigación), no se agregó protección específica — es el mismo patrón ya aceptado en el resto del sistema. Un perfil con `COMPRAS_INSTRUCTIVO: TOTAL` pero sin `LECTURA` en `OPER_MATERIALES` puede editar las líneas ya existentes (el valor guardado se sigue mostrando por nombre, tomado del propio GET del instructivo), pero **no puede elegir** un Artículo nuevo que no pueda listar. Se recomienda que todo perfil con `COMPRAS_INSTRUCTIVO: TOTAL` incluya también `LECTURA` en `OPER_MATERIALES` y `CONFIG_ENTIDADES`.
>
> **Decisión de negocio — postergado (2026-08-15).** El árbitro de QA calificó esto como `BUG_REAL` bajo una lectura estricta de RP3 (`TOTAL` sobre un ítem debería bastar por sí solo, sin depender de `LECTURA` en ítems ajenos referenciados por FK). El usuario (Christian) decidió explícitamente **no** implementar ahora la corrección de raíz (exponer catálogos propios bajo `COMPRAS_INSTRUCTIVO`, o declarar y enforzar dependencias entre ítems de menú en el editor de perfiles) — es un cambio transversal a Compras/Ventas/Operaciones, fuera del alcance de esta edición del Instructivo. Se acepta la mitigación de arriba (perfil recomendado + fix de hidratación que evita la degradación visual) como suficiente para este ciclo. Mismo patrón de cierre que `CCOM-QA-001`/`NV-IE-010` (`Docs/Hallazgos/notas-venta-instructivo-embalaje.md`): gap de cobertura/diseño conocido y aceptado, no un defecto de código pendiente de arreglo.

> **Supersesión — ancla a Productor, no a NV (2026-08-12).** `notaVentaId` se **elimina** del modelo. El instructivo se emite **antes** de que exista un Cierre Comercial asociado — el flujo real (§5.1/§5.2) nunca lo condicionó a una NV, solo a la fruta que va a llegar de un productor. Se reemplaza por `entidadProductorId` (FK → Entidad tipo PRODUCTOR, obligatorio, mismo patrón que la OC) + `grupoMercadoId` (FK → GrupoMercado, obligatorio) + `fechaInicioPrograma` (fecha, obligatoria — la UI muestra la semana ISO calculada como label, no se persiste) + `observaciones` (texto libre, opcional). Migración destructiva (no hay forma de derivar un productor desde la NV existente; sistema en desarrollo, sin datos transaccionales reales).
>
> **Detalle — variedad rotulada y altura (2026-08-12).** Cada línea gana `variedadRotuladaId` (FK → Variedad, opcional, filtrada por la misma especie de la línea — una segunda variedad) y `alturaId` (FK → Altura, obligatoria — "altura de pallet"). La grilla de detalle muestra columnas separadas: Especie, Variedad, Variedad Rotulada, Artículo, Categoría, Calibre, Altura, Cantidad (antes "Especie / Variedad" iba combinado en una celda).

- `id` (PK)
- `numero` (correlativo propio)
- `entidadProductorId` (FK → Entidad tipo PRODUCTOR, obligatorio) **(supersede a `notaVentaId`, 2026-08-12 — ver nota arriba)**
- `grupoMercadoId` (FK → GrupoMercado, obligatorio) **(nuevo, 2026-08-12)**
- `fechaInicioPrograma` (fecha, obligatoria) **(nuevo, 2026-08-12)**
- `observaciones` (texto libre, opcional) **(nuevo, 2026-08-12)**
- Detalle (1..N líneas): `articuloId` (FK → Artículo/Embalaje), `especieId`, `variedadId`, `variedadRotuladaId` (FK → Variedad, opcional, misma especie) **(nuevo, 2026-08-12)**, `categoriaId`, lista de calibres (`InstructivoEmbalajeDetalleCalibre`, multiselect — ver nota de supersesión en §4.3), `tipoPalletId` (FK → TipoPallet, nullable) **(nuevo, 2026-08-07)**, `alturaId` (FK → Altura, obligatorio) **(nuevo, 2026-08-12)**, `cantidadPallets`, `cajasPorPallet`, `cajas` **(nuevo, 2026-08-07 — ver nota en §4.3, mismo criterio)**
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
- `solicitudInspeccionId` (FK → SolicitudInspeccion, nullable a nivel de columna) **(nuevo, 2026-08-14)** — reinstala la trazabilidad Compras↔Calidad diferida arriba. Requerido **a nivel de aplicación** al crear una OC (no de columna, para no forzar backfill de OCs de desarrollo previas a este campo): debe ser una solicitud con `tipoInspeccion = COMPRA`, `estado = APROBADA` (ver calidad.md) y el **mismo `entidadProductorId`** que la OC — se rechaza (422) si no corresponde al mismo productor. `RECHAZADA` y el nuevo veredicto `OBJETADA` **(2026-08-10, ver `Docs/Hallazgos/solicitud-inspeccion.md` §7)** también bloquean la OC, exactamente igual que `RECHAZADA` — solo `APROBADA` habilita.
> **Gestión de la Solicitud (2026-08-10, supersesión):** la Solicitud de Inspección de tipo Compra ya no se gestiona (ingresar/editar/notificar) desde Calidad — se ingresa/edita desde `/dashboard/compras/solicitudes` (ítem `COMPRAS_SOLICITUDES`). Calidad conserva solo ver + cerrar. Detalle completo en `Docs/Hallazgos/solicitud-inspeccion.md` §7.
- ~~`fechaEntregaDesde` / `fechaEntregaHasta`~~ **(eliminado 2026-08-07)** — decisión de negocio (Christian): la ventana de entrega no se usa en la operación real de compras; se quita del formulario, del contrato API y del modelo. Si se retoma, debe reintroducirse explícitamente aquí primero.
- `responsableId` (FK → Usuario, nullable) **(nuevo, 2026-07-26)** — solo usuarios marcados `esResponsableVenta` en su ficha
- `destinoMercadoId` (FK → Mercado, nullable) **(nuevo, 2026-07-26)** — "Destino" de la OC
- `formaPagoId` (FK → FormaPago, nullable) **(nuevo, 2026-07-26)** — mantenedor propio (`Docs/mantenedores-generales.md`); reemplaza el texto libre original
- `condicionPagoId` (FK → CondicionPago, nullable) **(nuevo, 2026-07-26)** — reemplaza `condicionPagoTexto`; ver §4.2.1
- `monedaId` (FK → Moneda) **(nuevo)**
- `incotermId` (FK → Parametro, `TipoParametro` codigo `INCOTERM`, nullable) **(reintroducido 2026-08-12)** — supersede el `~~incotermId~~` **eliminado 2026-08-07** por falta de catálogo (`OC-002`, `Docs/Hallazgos/orden-de-compra.md`). El catálogo genérico `Parametro`/`INCOTERM` ya existía (sembrado para Cierre Comercial — `NotaVenta.clausulaVentaId`, mismo mecanismo); se reutiliza en vez de crear un mantenedor propio.
- ~~`facturarAId`~~ **(eliminado 2026-07-26)** — decisión de negocio: la OC no factura a una entidad distinta del productor
- `observaciones` **(nuevo)**
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

- `id` (PK)
- `ordenCompraId` (FK → OrdenCompra)
- `especieId`, `variedadId`, `categoriaId`, `articuloId` (embalaje)
- `calibres` (`OrdenCompraLineaCalibre`, N:M contra Calibre) — **lista** de calibres puntuales, no un rango. **(Supersesión, 2026-08-15)**: reemplaza los antiguos `calibreMinId`/`calibreMaxId` (FK → Calibre). Motivo: la UI debía mostrar/quitar cada calibre individualmente (igual que `NotaVentaDetalleCalibre`, `ventas.md`) en vez de un rango colapsado; el formulario sigue ofreciendo Desde/Hasta como atajo de captura (usa `Calibre.orden` de la especie para expandir el rango en el momento de agregar), pero lo que persiste es la lista resultante, editable calibre a calibre. Mismo patrón replicado en `InstructivoEmbalajeDetalle` (§4.1). Impacta la validación de Recepción: ver nota en §7.2.
- `tipoPalletId` (FK → TipoPallet, nullable) **(nuevo, 2026-08-07)**
- `cantidadPallets` (Int)
- `cajasPorPallet` (Int) **(referencial, 2026-08-07)** — cajas por pallet aún no tiene mantenedor propio; hoy es un valor fijo (108) que la UI usa solo para precalcular `cajas`. **No** es la fuente de verdad del total ni una restricción por pallet individual.
- `cajas` (Int) **(nuevo, 2026-08-07)** — **total de cajas de la línea, campo independiente y editable** (mismo patrón que `NotaVentaDetalle.cajas` en `ventas.md`). Se precalcula como `cantidadPallets × 108` al cambiar `cantidadPallets`, pero el usuario puede sobrescribirlo (ej. último pallet parcial). Es la cantidad que alimenta el cálculo de cuotas `MONTO_UNITARIO` (§4.2.1) y, a futuro, la validación de Recepción (§7.2) — **no** se recalcula ni se fuerza a coincidir con `cantidadPallets × cajasPorPallet`.
- `precioUsdCaja` (Decimal) — **precio de compra** (lo que paga Agrosan). Alimenta Costos (ver §10)

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

### 4.4 Recepcion
Módulo único, dos modos según presencia de OC. Una Recepción se valida contra **una** OC o contra **ninguna** (nunca varias).

- `id` (PK)
- `ordenCompraId` (FK → OrdenCompra, **nullable**) — presente = modo compra; null = modo consignación
- `origen` (modo derivado: `COMPRA` si hay OC, `CONSIGNACION` si null)
- `plantaOrigenId` / mantenedor de formato aplicado (ver §9.2)
- `documentoOrigenUrl` (Excel u otro cargado)
- `estado` (ver §8)
- `createdAt`, `createdBy`

> El flag **con/sin OC no es solo un modo de validación**: determina el destino de liquidación de la fruta (ver §6.3). Como la Recepción es homogénea (1 OC o ninguna), el flag se propaga a todos sus pallets.

### 4.5 Pallet
Unidad mínima **indivisible** de inventario. Generado por la Recepción. Compuesto por múltiples líneas (separando productor, embalaje, calibre, categoría, etc.).

- `id` (PK)
- `recepcionId` (FK → Recepcion)
- `numeroPallet` (identificador del pallet según origen; usado en la reconciliación con Packing List)
- `origen` (`COMPRA` | `CONSIGNACION`, heredado de la Recepción)
- `embarqueId` (FK → Embarque, **nullable**) — se puebla al reservar el pallet a un embarque (Ventas); un pallet pertenece a **un solo** Embarque a la vez
- `productorId` (FK → Productor)
- `createdAt`

### 4.6 PalletLinea
- `id` (PK)
- `palletId` (FK → Pallet)
- `especieId`, `variedadId`, `categoriaId`, `articuloId` (embalaje), `calibreId`
- `cajas` (Int)

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


### 4.8 DocumentoCompra (facturas y notas de crédito de proveedor)

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

### 5.2 Vía 2 — Consignación

1. Se confecciona el **Instructivo de Embalaje**.
2. **No se genera OC.**
3. La fruta se **recepciona sin OC** (carga libre) a partir del reporte de stock de la planta → entra a Stock como `CONSIGNACION`.

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
Como las cantidades son validación dura (§7), la OC debe poder editarse hasta que la Recepción cuadre. La reconciliación final OC↔carga es manual: se ajusta la OC o la carga hasta que coincidan.

### 6.3 Destino de liquidación según origen
- **Fruta `COMPRA` (con OC):** precio fijo pactado en la línea de OC → es **costo de compra** → alimenta **Costos**. **No aplica Liquidación a Productor.**
- **Fruta `CONSIGNACION` (sin OC):** **sí** aplica **Liquidación a Productor** (precio variable, resultado de la venta menos costos/comisiones).

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

Aplica **solo en modo compra** (Recepción con OC). En modo consignación no hay validación contra documento previo (carga libre).

**Principio:** validación **por totales de cada línea de OC** (por combinación completa), **no** por pallet ni por característica marginal. La distribución de calibres/características dentro de cada pallet es irrelevante. **Todo o nada.**

### 7.1 Agrupación
Agrupar las líneas del Excel por la combinación **especie + variedad + categoría + embalaje (artículo)** — la misma combinación que identifica una línea de OC. La combinación importa: *RedGlobe debe ser CAT1*; no basta con que los marginales (variedad por un lado, categoría por otro) cuadren por separado.

### 7.2 Validaciones por línea de OC
Para cada línea de OC, contra el grupo correspondiente del Excel:

1. **N° de pallets:** total OC = total Excel.
2. **Cajas:** total OC (**campo `cajas` de la línea**, no `cantidadPallets × cajasPorPallet` — ver nota en §4.3, 2026-08-07) = total Excel.
3. **Calibre (pertenencia a la lista):** **(Supersesión, 2026-08-15 — reemplaza la validación por rango)** **ningún** calibre del Excel puede quedar fuera de la **lista** de calibres de la línea (`OrdenCompraLineaCalibre`, §4.3). Ej.: OC permite calibres {3, 5, 7, 8} → si aparece 1, 2, 4 o 6 en el Excel, rechazo (ya no basta con estar "dentro del rango" 3–8, debe **pertenecer a la lista** exacta). La distribución entre pallets no bloquea; lo que bloquea es un calibre no listado en los totales.
4. **Cobertura:** cualquier combinación/característica del Excel que **no** corresponda a ninguna línea de OC → diferencia reportada.

### 7.3 Resultado
- **Todo cuadra** → se cargan los pallets a Stock (con `origen = COMPRA`).
- **Algo falla** → **rechazo total** de la carga. Mensaje: *"No coincide la OC con la carga"* + lista de diferencias, referenciando las líneas del Excel:
  - *Embalaje / categoría / variedad `XXXX` de las líneas `w,x,y,z` del Excel no está en la OC.*
  - *Calibre `N` de las líneas `a,b,c` del Excel no está en la lista de calibres de la OC.*
  - *Suma de cajas: hay `X` cajas de más del calibre/línea `AB` y `J` de menos del calibre/línea `CD` respecto de la OC.*

> El detalle de diferencias existe para que la planta corrija y reenvíe el archivo.

---

## 8. Estados y Bloqueos

- **InstructivoEmbalaje:** sin máquina de estados (documento emitido).
- **OrdenCompra:** `Borrador → Emitida → Recepcionada` (editable hasta recepcionar; ver §6.2). *(Detalle fino de estados a afinar en implementación.)*
- **Recepcion:** `Cargada → Validada` (modo OC) · `Cargada` (modo consignación). Carga es todo-o-nada; una carga rechazada no genera pallets.
- **"Standby" de despacho (Packing List):** no es un estado formal nuevo; es la condición de **no poder avanzar los pasos siguientes ni facturar** mientras haya discrepancia PL↔reserva. Se modela como bloqueo sobre el Embarque/Despacho (`ventas.md`), no como un estado propio de Compras.

---

## 9. Integraciones y Dependencias

### 9.1 AGL (empresa relacionada) — solo lectura
AGL gestiona la **reserva del contenedor**: Agrosan solicita un espacio indicando cliente, destino y fechas; AGL coordina con las empresas de transporte y carga en su sistema el detalle (número de contenedor, número de booking, fechas de retiro por planta, etc.). FAS **consulta por número de embarque** y AGL devuelve la información. Integración **solo de lectura**, sin escritura ni sincronización bidireccional. *(Detalle de campos: pendiente, ver §10.)*

### 9.2 Mantenedor de formatos de carga (columnas por planta/origen)
Patrón único reutilizado tanto para el **reporte de stock de consignación** como para el **Packing List**: un mantenedor que mapea, por planta/origen, cada dato requerido por la aplicación a su **columna del Excel** y **fila de inicio**. Si más adelante alguna planta envía PDF, se amplía con lectura IA (§10).

### 9.3 Packing List — reconciliación (interfaz con `ventas.md`)
Comparación a **nivel de pallet**, en dos pasos:
1. Los **números de pallet** del PL = los números de pallet **reservados** al embarque.
2. El **detalle de cada pallet** del PL = el detalle del pallet en Stock.

Discrepancia → se informan las diferencias y el despacho queda bloqueado (no facturable) hasta cuadrar.

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
- **Detalle de campos AGL** — qué campos exactos devuelve la consulta por número de embarque. *Pendiente.*
- **Lectura IA / PDF** — Recepción y Packing List en formato PDF vía IA (Etapa 2). El mantenedor de columnas resuelve Excel en v0.1. *Pendiente.*
- **Template de Carga por planta/origen** — `TemplateCarga` (§9.2) ya distingue **tipo** (`RECEPCION`, `PACKING_LIST`, whitelist ampliable sin migración), pero todavía no está asociado a una planta/origen como dice el enunciado de §9.2 ("mapea, por planta/origen..."). Hoy el picker de Recepción filtra solo por tipo, no por la planta elegida en el encabezado. Falta definir la cardinalidad (¿un template por planta+tipo, o varios seleccionables por planta?) antes de modelarlo. Hallazgo QA `QAS-TCT-001` (ronda 1, 2026-08-03) — diferido a propósito, fuera del alcance de la introducción de `tipo`. *Diferido.*

**Deudas cross-módulo (a aplicar):**
- **`ventas.md` — corrección del modelo de Embarque/Instructivo** (parche listo, resumen abajo).
- **`reclamos.md` — FK** `instructivo` (texto libre) → FK al **Embarque**. Desbloqueada al cerrar Ventas.
- **Costos / Liquidación** — el `precioUsdCaja` de la línea de OC alimenta **Costos** (fruta comprada); la fruta de consignación alimenta **Liquidación a Productor**.

**Supuestos asumidos (confirmar si difieren):**
- El flag `COMPRA/CONSIGNACION` vive a nivel de Recepción y se propaga a los pallets.
- `cajasPorPallet` en la OC sirve solo para el total esperado, no como tope por pallet.

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
