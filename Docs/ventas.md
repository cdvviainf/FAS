# Módulo Ventas — `ventas.md`

> **Estado:** BORRADOR DE CONTEXTO (definición en curso).
> **Q1 (Folio / número de instructivo): RESUELTA** — `Folio` = Número de Instructivo (mismo campo). **Supersesión (2026-08-13, R10):** pasa de manual a **automático** — `{prefijo del Tipo de Embarque}{folio de la NV}`. Ver §4.2, R6 / R10 / R11.
> **Refinamiento (cierre de `compras.md`):** el modelo Embarque → Instructivo se corrige a **padre** (el Embarque, identificado por `Folio`) + **hijos por punto de retiro** (`001A-1`, `001A-2`…). Reemplaza el modelo previo "1 instructivo = 1 contenedor plano". Ver §4.2 y R6 / R11.
> Este documento consolida lo definido en la narrativa de negocio + las pantallas del sistema legado (Nota de Venta y Orden de Embarque). Los `TODO` y la sección §10 marcan lo que falta cerrar.

---

## 1. Propósito y alcance

Sistematizar el ciclo comercial de exportación de Frutera Agrosan, desde el compromiso de venta con el cliente hasta la generación del **Instructivo de Embarque**, entidad ancla que gobierna toda la lógica del negocio aguas abajo.

**En alcance (Etapa 1):**

- **Nota de Venta** (Cierre de Negocio): encabezado + detalle de fruta comprometida.
- **Solicitud de Reserva de Espacios**: output hacia el Gestor Logístico y captura de su respuesta.
- **Instructivo / Orden de Embarque**: encabezado + contenedor + asignación de fruta, validado contra lo comprometido en la Nota de Venta.

**Fuera de alcance:**

- **Programa Comercial** (presupuesto de temporada por semana de embarque): en duda si se sistematiza. Parking lot, no se modela en Etapa 1.
- **Despacho de fruta / descuento de Stock**: se define en Operaciones/Stock. Este módulo solo deja el anclaje (FK a `Embarque`).
- **Proforma y Factura DTE**: definidas en Cobranza (`cobranza.md`). Ventas solo hereda el precio sugerido.
- **Determinación de precios definitiva** (Etapa 3).

---

## 2. Contexto y dependencias cross-módulo

- **El número de instructivo NACE en el Instructivo / Orden de Embarque.** Se **calcula automáticamente** al generar el Embarque (2026-08-13, R10: `{prefijo del Tipo de Embarque}{folio de la NV}`) y queda en el campo **`Folio`** del Embarque (`Folio` = Número de Instructivo, mismo dato; ej. `MAR0042`). Es el identificador de negocio ancla y la identidad del **instructivo padre**. Lo referencian por FK **al `Embarque`**: **Despacho, Compras (OC de fruta), Facturas, Reclamos, Liquidaciones, Precios.** El Embarque genera además **≥1 instructivos hijos** por punto de retiro, con código autogenerado `{folio}-{n}` (ej. `MAR0042-1`; ver R11).
- **Corrección a `reclamos.md`:** el campo `instructivo` (hoy texto libre, "pendiente de FK") pasa a **FK a `Embarque`** una vez cerrado este módulo. → *reconcile posterior.*
- **Compras:** el mismo número de instructivo se reutiliza en las Órdenes de Compra de fruta. La mecánica exacta (unicidad global vs. conciliación por valor) se resuelve en `compras.md`.
- **Cobranza:** el eje operacional de `cobranza.md` es el **Embarque**. El `Valor` de la asignación de contenedor (heredado desde la Nota de Venta) alimenta el precio **sugerido** de la Proforma, que es editable en esa instancia.
- **Entidades:** requiere tipos/roles de `Entidad`: Cliente, Comprador, Notify, Consignatario, Facturar a, Naviera, Embarcador, Agente Aduana, Transportista, **Gestor Logístico**.

---

## 3. Actores y permisos

| Perfil | Acceso |
|---|---|
| Ventas (Giovanni) | Total sobre Nota de Venta e Instructivo de Embarque. |
| — | (Definir niveles LECTURA/TOTAL por ítem de menú al cerrar el spec.) |

`TODO`: mapear a perfil + ítem de menú + nivel, según patrón de `usuarios-perfiles.md`.

---

## 4. Modelo de datos (Prisma)

> Convenciones FAS: `Int @id @default(autoincrement())` para entidades locales; `String` solo para referencias a `Usuario` (Better Auth). Auditoría + softdelete en entidades operativas.

### 4.1 Nota de Venta

> **⚠️ Supersesión (2026-07-27) — Cierre Comercial v1.** Por decisión de Christian, el contrato de esta sección se **reemplaza** en los siguientes puntos, ya implementados en `fas-api`/`fas-web`:
> - `formaPagoId` + `saldoPagoId` (sueltos) → **`condicionPagoId`** (FK a `CondicionPago`, mismo maestro cuotas % + plazoDias que usa Compras). Las cuotas se **snapshotean** en `NotaVentaCuotaPago` al guardar — no cambian retroactivamente si se edita la plantilla `CondicionPago` después (ver R12).
> - ~~`calibres NotaVentaDetalleCalibre[]` (multiselect) → `calibreInicioId`/`calibreFinId` (FK a `Calibre`, rango sobre el maestro ordenado por especie)~~ **Revertido en la supersesión de 2026-07-30 (ver abajo).**
> - `modalidadVentaId`, `clausulaVentaId` (Incoterm), `tipoFleteId` quedan como FK reales al catálogo genérico `Parametro` (antes eran `Int` suelto a la espera de que existieran sus `TipoParametro`; ya se dieron de alta vía seed: `MODALIDAD_VENTA`, `INCOTERM`, `TIPO_FLETE`).
> - **Fuera de esta implementación:** el bloque Embarque/Instructivo (§4.2) y Solicitud de Reserva (§4.3) siguen sin implementar, diferidos a una etapa posterior — no se tocan por esta supersesión.
> Ver `Docs/Hallazgos/notas-venta-instructivo-embalaje.md` para el detalle de la reconciliación QA.
>
> **⚠️ Supersesión (2026-07-30).** Por decisión de Christian, se **revierte** el punto de calibre de la supersesión anterior: `NotaVentaDetalle` vuelve a usar **multiselect** (`calibres NotaVentaDetalleCalibre[]`, tabla intermedia, mismo patrón que `SolicitudInspeccionCalibre`) en vez del rango `calibreInicioId`/`calibreFinId`. Válido: cada `calibreId` debe existir, no estar bloqueado, y pertenecer a la misma especie de la línea (ya no aplica la comparación de `orden` entre inicio/fin). Además, se implementa una **versión mínima** del bloque Embarque (§4.2): solo el encabezado ancla (`id`, `notaVentaId`, `numeroInstructivo`/Folio, auditoría), suficiente para la acción "Generar Embarque" desde el Cierre Comercial y para navegar a una página con las 4 pestañas del workflow (Solicitud de Espacio, Seleccionar Pallets, Generar Instructivos, Despachar) — **sin contenido ni lógica de negocio todavía**. Las tablas hijas del spec (`EmbarqueContenedor`, `AsignacionContenedor`, `InstructivoHijo`, `SolicitudReserva`) y la herencia de campos R4 se agregan cuando se implemente cada pestaña. R3 (bloquear borrado de NV con Embarque asociado) sí se implementó ya, dado que no depende de esos campos.
>
> **⚠️ Supersesión (2026-07-30, segunda decisión del día).** Por decisión de Christian: (a) `compradorId` (FK a `Entidad`, rol "Comprador" independiente) se **reemplaza** por `compradorContactoId` (FK a `EntidadContacto`) — el Comprador pasa a ser un contacto de la propia Entidad Cliente, mismo patrón que `SolicitudInspeccion.contactoId`; se elimina "Comprador" como rol/tipo de `Entidad` en la lista de roles (§2, línea 35) y de R4 (línea 349, ya no aplica herencia porque el contacto depende del cliente, no se hereda como Entidad suelta). No hay backfill posible (un id de Entidad no corresponde a ningún id de EntidadContacto): los Cierres Comerciales existentes pierden el Comprador asignado. (b) `clienteId` sigue siendo `Int` obligatorio, pero ahora existe una Entidad placeholder sembrada ("Cliente Sin Definir", código fijo `CLIENTE-SD`) que se preselecciona automáticamente al crear un Cierre Comercial nuevo cuando el cliente real todavía no se conoce — editable en cualquier momento, incluso después de guardado.

```prisma
model NotaVenta {
  id               Int       @id @default(autoincrement())
  folio            Int       @unique              // correlativo autonumérico (ver §5 R1)
  fecha            DateTime

  // --- Partes / entidades ---
  clienteId        Int  // preselecciona placeholder "Cliente Sin Definir" al crear (ver supersesión)
  compradorContactoId Int?  // FK -> EntidadContacto, contacto del propio clienteId (ver supersesión)
  notifyId         Int?
  consignatarioId  Int?  // antes clienteFinalId (supersede 2026-08-13) — usa el rol CONSIGNATARIO de TipoEntidad, ya existía y no se usaba

  // --- Destino / logística comercial ---
  // paisDestinoId depende de mercadoId en el formulario (UI): un Mercado agrupa
  // varios Países (mantenedores-generales.md), así que el select de País Destino
  // se filtra por el Mercado elegido y se resetea si este cambia.
  tipoEmbarqueId   Int
  mercadoId        Int
  paisDestinoId    Int
  puertoDestinoId  Int?
  direccionId      Int?
  direccionDetalle String?

  // --- Condiciones de venta ---
  modalidadVentaId Int?      // FK → Parametro (TipoParametro MODALIDAD_VENTA)
  clausulaVentaId  Int?      // FK → Parametro (TipoParametro INCOTERM)
  tipoFleteId      Int?      // FK → Parametro (TipoParametro TIPO_FLETE)
  condicionPagoId  Int?      // FK → CondicionPago ("Forma de Pago" en UI; snapshot en NotaVentaCuotaPago, ver R12)
  monedaId         Int

  observaciones    String?

  detalles         NotaVentaDetalle[]
  cuotasPago       NotaVentaCuotaPago[]             // snapshot inmutable de CondicionPago.cuotas al guardar (R12)
  embarques        Embarque[]

  creadoPorId      String                          // Usuario (Better Auth)
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt
  deletedAt        DateTime?

  @@index([clienteId])
  @@index([fecha])
}

model NotaVentaCuotaPago {
  id              Int              @id @default(autoincrement())
  notaVentaId     Int
  notaVenta       NotaVenta        @relation(fields: [notaVentaId], references: [id], onDelete: Cascade)

  fechaReferencia FechaReferenciaPago @default(FACTURA)  // FACTURA/ZARPE/ENVIO_DOCUMENTOS
  plazoDias       Int
  tipoValor       TipoValorCuota   @default(PORCENTAJE)  // PORCENTAJE/MONTO_UNITARIO
  porcentaje      Decimal?         @db.Decimal(5, 2)      // requerido si tipoValor=PORCENTAJE
  valorUnitario   Decimal?         @db.Decimal(14, 4)     // requerido si tipoValor=MONTO_UNITARIO
  monedaId        Int?
  moneda          Moneda?          @relation(fields: [monedaId], references: [id])
  unidadId        Int?
  unidad          UnidadMedida?    @relation(fields: [unidadId], references: [id])
  montoCalculado  Decimal?         @db.Decimal(14, 4)     // valorUnitario × cantidad real (cajas/kilos), solo MONTO_UNITARIO — recalculado en cada cambio de detalles
  descripcion     String?

  @@index([notaVentaId])
}
```

**Regla de cuotas (2026-07-28, mismo contrato que `compras.md` §4.2.1):** las cuotas `PORCENTAJE` son **siempre obligatorias** y deben sumar exactamente 100% entre sí, exista o no además una cuota `MONTO_UNITARIO`. A lo sumo **una** cuota puede ser `MONTO_UNITARIO`, y debe ser la primera (índice 0) — representa un **cargo adicional** (USD/caja o USD/kilo según cantidad real de la NV), nunca un reemplazo del 100%. `unidadId` en esa cuota solo admite `CAJA` o `KG`; si es `KG`, cada `Articulo` involucrado en los detalles debe tener `kgNetoEnvase` válido (error de negocio si falta). `montoCalculado` se recalcula automáticamente cada vez que se agrega un detalle a la NV (`addDetalle`), ya que a diferencia de la OC los detalles se agregan incrementalmente después del encabezado.

```prisma

model NotaVentaDetalle {
  id             Int       @id @default(autoincrement())
  notaVentaId    Int
  notaVenta      NotaVenta @relation(fields: [notaVentaId], references: [id], onDelete: Cascade)

  fechaCompromiso DateTime
  especieId       Int
  variedadId      Int
  articuloId      Int
  categoriaId     Int?
  tipoPalletId    Int?

  cantidadPallets Int
  cajasPorPallet  Int
  cajas           Int
  precio          Decimal   @db.Decimal(14, 4)       // valor unitario por caja, en la moneda del encabezado

  calibres NotaVentaDetalleCalibre[]                 // multiselect (ver supersesión 2026-07-30, R12)

  ordenCompraLineas OrdenCompraLinea[]                // líneas de OC tomadas de esta línea (ver supersesión 2026-08-23, abajo)

  @@index([notaVentaId])
}
```

> **⚠️ Supersesión (2026-08-23) — línea de OC tomada del Cierre Comercial.**
> `compras.md` §4.3 agrega `OrdenCompraLinea.notaVentaDetalleId` (FK
> opcional): al armar una OC contra un Cierre, el usuario puede tomar
> (completa o parcial, en cajas) una línea del Cierre en vez de recapturarla
> a mano. Esto agrega, del lado de `NotaVentaDetalle`:
>
> - **`GET /api/ventas/notas-venta` (listado) gana `estadoOc`**
>   (`PENDIENTE`/`COMPLETA`) por Cierre: `COMPLETA` si la suma de `cajas`
>   comprometidas por `OrdenCompraLinea` vigentes iguala o supera la suma de
>   `cajas` de todas sus líneas; `PENDIENTE` en cualquier otro caso
>   (incluido un Cierre sin líneas todavía).
> - **Eliminar una línea** (`DELETE .../detalles/:id`) se rechaza (422) si
>   tiene cajas comprometidas por alguna `OrdenCompraLinea` vigente.
> - **Editar una línea** (`PATCH .../detalles/:id`) con cajas comprometidas
>   > 0: `especieId`/`variedadId`/`categoriaId`/`articuloId`/`tipoPalletId`/
>   `calibreIds` quedan **bloqueados** (deben llegar idénticos a lo
>   persistido, se rechaza si difieren) — esas OC ya copiaron esos valores
>   server-side y cambiarlos las desincronizaría. `cajas` sigue editable,
>   pero nunca por debajo de lo ya comprometido.

```prisma

model NotaVentaDetalleCalibre {
  id                 Int              @id @default(autoincrement())
  notaVentaDetalleId Int
  notaVentaDetalle   NotaVentaDetalle @relation(fields: [notaVentaDetalleId], references: [id], onDelete: Cascade)
  calibreId          Int
  calibre            Calibre          @relation(fields: [calibreId], references: [id])

  @@unique([notaVentaDetalleId, calibreId])
}
```

### 4.2 Instructivo / Orden de Embarque

> **⚠️ Implementación parcial (2026-07-30).** Existe una **versión mínima** de `Embarque` en `fas-api`/`fas-web`: solo `id`, `notaVentaId`, `numeroInstructivo` (Folio) y auditoría — sin `EmbarqueContenedor`, `AsignacionContenedor`, `InstructivoHijo` ni herencia de campos (R4). Sostiene la acción "Generar Embarque" desde el Cierre Comercial y una página con las 4 pestañas del workflow (Solicitud de Espacio, Seleccionar Pallets, Generar Instructivos, Despachar) **sin contenido ni lógica de negocio todavía**. El modelo completo de abajo sigue siendo el contrato autoritativo a implementar cuando se desarrolle cada pestaña. R3 (bloquear borrado de NV con Embarque asociado) ya está implementado.
>
> **Supersesión (2026-08-13, R10).** "Generar Embarque" deja de pedir el número de instructivo manualmente — se calcula automáticamente (`{prefijo del Tipo de Embarque}{folio de la NV}`, prefijo configurado en Configuración → Prefijos). **Pendiente/diferido:** una NV puede generar más de un Embarque (R7); con este esquema, el segundo Embarque de la misma NV colisiona con el número del primero (mismo folio, mismo tipo) y se rechaza con error — la desambiguación queda como decisión de negocio por resolver (no implementada).

```prisma
model Embarque {
  id                Int       @id @default(autoincrement())
  notaVentaId       Int
  notaVenta         NotaVenta @relation(fields: [notaVentaId], references: [id])

  // Q1 RESUELTA: `Folio` = Número de Instructivo (mismo dato). Campo único.
  // Identidad del instructivo PADRE; la UI lo etiqueta "Folio".
  // Supersesión (2026-08-13, R10): pasa de manual a AUTOMÁTICO — se calcula
  // al generar el Embarque como {prefijo del Tipo de Embarque}{folio de la
  // NV}, usando el prefijo configurado en Configuración → Prefijos (uno por
  // Tipo de Embarque). Ej. "MAR0042".
  numeroInstructivo String    @unique            // calculado, no se ingresa manualmente — anclaje de negocio (campo UI "Folio")

  fechaIngreso      DateTime

  // --- Reserva (respuesta del Gestor Logístico) ---
  reservaId         Int?
  reserva           SolicitudReserva? @relation(fields: [reservaId], references: [id])

  // --- Partes / entidades (heredados de NV donde apliquen, ver §5 R4) ---
  clienteId         Int
  compradorId       Int?
  notifyId          Int?
  navieraId         Int?
  embarcadorId      Int?
  agenteAduanaId    Int?
  facturarAId       Int?

  // --- Ruta / destino ---
  tipoEmbarqueId    Int
  origenId          Int?
  puertoEmbarqueId  Int?
  mercadoId         Int
  paisDestinoId     Int
  puertoDestinoId   Int?
  rutaId            Int?
  destinoFinalId    Int?
  direccionId       Int?
  direccionDetalle  String?
  tipoFleteId       Int?

  // --- Documentos / textos ---
  nave              String?
  booking           String?
  dus               String?
  tipoBLId          Int?
  awlBl             String?

  // --- Hitos logísticos ---
  stackingDesde     DateTime?
  stackingHasta     DateTime?
  corteDocumental   DateTime?
  lateArrival       DateTime?
  fechaZarpe        DateTime?
  eta               DateTime?
  rta               DateTime?

  observaciones     String?
  observacionesPlanta String?

  contenedores      EmbarqueContenedor[]
  instructivosHijos InstructivoHijo[]             // ≥1, uno por punto de retiro (R11)

  creadoPorId       String
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  deletedAt         DateTime?

  @@index([notaVentaId])
  @@index([numeroInstructivo])
}

model EmbarqueContenedor {
  id              Int       @id @default(autoincrement())
  embarqueId      Int
  embarque        Embarque  @relation(fields: [embarqueId], references: [id], onDelete: Cascade)

  bodegaId        Int?
  transportistaId Int?
  tipoContenedorId Int?
  numeroContenedor String?
  sello           String?
  tipoTratamientoId Int?
  temperatura     String?
  ventilacion     String?
  cbm             Decimal?  @db.Decimal(10, 3)
  tipoAtmosferaId Int?
  co2             String?
  o2              String?
  fechaEnPlanta   DateTime?

  tipoInspeccionId Int?
  fumigacionOrigen  Boolean @default(false)
  fumigacionDestino Boolean @default(false)
  aprobadoOrigen    Boolean @default(false)
  aprobadoUsda      Boolean @default(false)

  asignaciones    AsignacionContenedor[]

  @@index([embarqueId])
}

model AsignacionContenedor {
  id             Int       @id @default(autoincrement())
  contenedorId   Int
  contenedor     EmbarqueContenedor @relation(fields: [contenedorId], references: [id], onDelete: Cascade)

  articuloId     Int
  variedadId     Int
  calibreId      Int
  tipoPalletId   Int?

  cantidadPallets Int
  cajasPorPallet  Int
  cajas           Int
  valor           Decimal   @db.Decimal(14, 4)   // heredado del precio de NV (R5)

  @@index([contenedorId])
}

model InstructivoHijo {
  id             Int       @id @default(autoincrement())
  embarqueId     Int
  embarque       Embarque  @relation(fields: [embarqueId], references: [id], onDelete: Cascade)

  codigo         String    @unique              // autogenerado "{numeroInstructivo}-{n}", ej. "001A-1"
  secuencia      Int                             // n correlativo dentro del embarque (1, 2, 3…)
  puntoRetiroId  Int                             // planta / punto de retiro (Entidad tipo PLANTA)

  // Retiro por planta — varía entre plantas. Fuente: AGL (solo lectura; ver §2 y compras.md).
  fechaRetiro    DateTime?
  horaRetiro     String?

  observaciones  String?

  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  @@unique([embarqueId, secuencia])
  @@index([embarqueId])
  @@index([puntoRetiroId])
}
```

### 4.3 Solicitud de Reserva

```prisma
model SolicitudReserva {
  id             Int       @id @default(autoincrement())
  notaVentaId    Int?
  gestorLogId    Int                               // Entidad tipo GESTOR_LOGISTICO

  // Requerimiento (output del sistema)
  destino        String?
  viaEmbarqueId  Int?                              // mantenedor Vía de Embarque
  fechaRequerida DateTime?

  // Respuesta del gestor
  empresaTransporte String?
  numeroReserva     String?
  // TODO: naviera, nave, tipo contenedor, etc. según formato de respuesta real

  observaciones  String?
  embarques      Embarque[]

  creadoPorId    String
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  @@index([gestorLogId])
}
```

---

## 5. Reglas de negocio / invariantes

- **R1 — Folio NV.** Correlativo autonumérico por el sistema.
- **R2 — Sin estados.** Ni Nota de Venta ni Embarque manejan máquina de estados; se rigen por existencia de asociaciones (R3).
- **R3 — Borrado / edición NV.** La Nota de Venta solo puede **borrarse si no tiene Instructivo asociado**. Una vez asociada, solo se editan campos **que no se hereden** al Instructivo.
- **R4 — Herencia NV → Embarque.** Todo campo repetido entre encabezados se **hereda y queda bloqueado** al asociar (Cliente, Tipo Embarque, Mercado, País Destino, Comprador, Notify, Dirección/Detalle, Tipo Flete, Cláusula, Moneda…). No hay lista especial: si se repite, se hereda.
- **R5 — Precio.** El `valor` de `AsignacionContenedor` se **hereda** del `precio` de la línea de Nota de Venta. El precio **definitivo** es el de la Proforma (Cobranza): se sugiere desde acá pero es **editable** en esa instancia.
- **R6 — Embarque = Contenedor (1:1).** Un Embarque representa un contenedor físico. Se modela `EmbarqueContenedor` como tabla separada (1:N estructural) para dejar la puerta abierta, aunque hoy se fuerce a 1. El `numeroInstructivo` (campo `Folio`) es la identidad del **instructivo padre** — el padre **no** es una tabla aparte, es el Embarque mismo. El padre puede tener **hijos** por punto de retiro (R11).
- **R7 — Nota de Venta → Embarque (1:N).** Una NV puede generar varios Instructivos (un contenedor = un instructivo; venta de N contenedores = N instructivos). El caso inverso (varias NV consolidando un Instructivo) queda **por resolver** (§10 Q2).
- **R8 — Validación fruta Embarque ⊆ fruta NV.** La fruta asignada al contenedor se elige **filtrada** por lo comprometido en la Nota de Venta: no se puede asignar especie/variedad/artículo/calibre/categoría fuera del detalle de la NV. *(Confirmar si además topea cantidades — §10 Q3.)*
- **R9 — Stock (etapa posterior).** Tras crear el Instructivo, se asocia el stock; el stock **debe coincidir** con lo determinado en las características del Instructivo. Mecánica en Operaciones/Stock.

> **Implementado (2026-09-02).** `Pallet.embarqueId` (compras.md §4.5/§4.7) + pestaña "Seleccionar Pallets" del Embarque: reserva/desvincula pallets uno a uno o en bloque, validando R8 (solo catálogo — especie/variedad/categoría/artículo/calibre — **sin** tope de cantidad, decisión de negocio, Christian; §10 Q3 queda resuelta así, no pendiente). `Embarque.despachadoEn` es el único gatillo de bloqueo hoy: una vez seteado, ya no se puede desvincular un pallet (agregar sigue permitido — decisión de negocio, Christian). **Pendiente, deuda aceptada (no bloquea esta entrega):** el despacho NO exige reconciliación contra Packing List todavía (§9.3, EP-QA-003) — ese módulo no existe; y reservar pallets NO genera los `InstructivoHijo` de R11 todavía (EP-QA-004) — ver nota ahí.
- **R10 — Número de instructivo.** ~~Texto ingresado manualmente~~ **(supersedido 2026-08-13)** — se **calcula automáticamente** al generar el Embarque: `{prefijo del Tipo de Embarque}{folio de la NV}` (prefijo + dígitos configurados en Configuración → Prefijos, un prefijo por Tipo de Embarque — `mantenedores-generales.md`/`PrefijoCodigo`). Sigue siendo **único**, reutilizado en OC de Compras, identidad del instructivo **padre**. **`Folio` = Número de Instructivo** (mismo dato; Q1 resuelta). Si el Tipo de Embarque de la NV no tiene prefijo configurado, se bloquea la generación con error. Colisión entre Embarques de una misma NV (R7): sin resolver, ver nota en §4.2.
- **R11 — Instructivos hijos por punto de retiro.** Cada Embarque genera **≥1** `InstructivoHijo`, uno por planta / punto de retiro que aporta fruta al contenedor. Código **autogenerado** `{numeroInstructivo}-{n}` (ej. `001A-1`, `001A-2`). Contiene la fecha/hora de retiro de esa planta (varían entre plantas). Con una sola planta de retiro hay un **único hijo** (`001A-1`), para mantener la nomenclatura actual. La partición se **deriva de la reserva de pallets** al embarque, agrupando por punto de retiro (mecánica en Operaciones/Stock). Fuente de las fechas de retiro: **AGL** (§2, `compras.md`).

> **Pendiente (2026-09-02, EP-QA-004) — deuda aceptada.** La reserva de pallets al Embarque (R9) ya está implementada, pero todavía no genera `InstructivoHijo` — el modelo no existe en el schema. Queda para cuando se aborde esta regla.
- **R12 — Forma de Pago y calibres aceptados del detalle (Cierre Comercial v1, ver supersesiones §4.1).** Al elegir una `CondicionPago` ("Forma de Pago") en el encabezado, sus cuotas (`porcentaje`/`plazoDias`) se **copian** a `NotaVentaCuotaPago` en el mismo momento (snapshot inmutable, igual que `OrdenCompraCuotaPago` en `compras.md` §4.2.1) — si la plantilla `CondicionPago` se edita después, los Cierres Comerciales ya guardados **no** cambian. Cada línea de detalle exige al menos un `calibreId` (multiselect, `NotaVentaDetalleCalibre`, ver supersesión 2026-07-30): cada calibre debe existir, no estar bloqueado, y pertenecer a la especie de la línea.

---

## 6. Contratos API (Fastify, prefijo `/api/ventas`)

| Método | Ruta | Notas |
|---|---|---|
| GET/POST/PATCH/DELETE | `/notas-venta[/:id]` | DELETE solo sin embarque asociado (R3). PATCH bloquea campos heredados si hay embarque. |
| POST | `/notas-venta/:id/detalles` | Línea de fruta (multiselect de calibres, ver R12). |
| GET/POST/PATCH/DELETE | `/embarques[/:id]` | Hereda campos de NV (R4). |
| POST | `/embarques/:id/contenedores` | Encabezado de contenedor. |
| POST | `/embarques/:id/contenedores/:cid/asignaciones` | Asignación de fruta, validada contra NV (R8), valor heredado (R5). |
| GET | `/embarques/:id/instructivos-hijos` | Hijos por punto de retiro (autogenerados en la reserva de pallets, R11). |
| GET/POST/PATCH | `/reservas[/:id]` | Solicitud + captura de respuesta del gestor. |
| GET | `/reservas/:id/output` | Genera el documento/listado a enviar al Gestor Logístico. |

`TODO`: definir validaciones de payload y respuestas de error (patrón 422 como en Reclamos).

---

## 7. UI / Pantallas

Basadas en el sistema legado (screenshots):

1. **Nota de Venta** — encabezado (Folio, Fecha, Cliente, Tipo Embarque, Mercado, País Destino, Dirección/Detalle, Puerto Destino, Comprador, Notify, Modalidad Venta, Cláusula Venta, Tipo Flete, Forma de Pago —`CondicionPago`, cuotas se muestran como preview snapshot al guardar—, Moneda, Consignatario, Observaciones) → **Continuar**.
2. **Detalle NV** — línea (Fecha Compromiso, Especie, Variedad, Artículo tipo Embalaje —etiqueta/kg neto/kg bruto heredados del artículo—, Calibre Inicio/Fin, Categoría, Tipo Pallet, Cant. Pallets, Cajas x Pallet, Cajas, Precio por caja) + grilla → **Terminar**.
3. **Orden de Embarque** — encabezado extenso (incluye **`Folio`** = N° de instructivo, calculado automáticamente y único — R10) + botón **Seleccionar Reserva** (rellena datos logísticos desde la reserva).
4. **Detalle Orden Embarque** — botón **Contenedor** → campos del contenedor + checks de inspección/fumigación.
5. **Detalle Asignación Contenedor** (modal) — Artículo, Variedad, Calibre, Tipo Pallet, Cant. Pallets, Cajas x Pallet, Cajas, Valor + grilla con Total.

---

## 8. Mantenedores y catálogos requeridos

**Ya implementados (Cierre Comercial v1, ver supersesión §4.1):** Modalidad de Venta, Cláusula de Venta (Incoterm) y Tipo Flete como `Parametro` genérico (mantenedores-generales.md) bajo sus `TipoParametro` `MODALIDAD_VENTA`/`INCOTERM`/`TIPO_FLETE`. Forma de Pago reemplazada por `CondicionPago` (`config/condiciones-pago`, compartido con Compras — no se crea un mantenedor "Saldo Pago" separado, ver R12).

**Mantenedores nuevos/confirmar (Embarque/Instructivo, aún sin implementar):** Tipo Embarque, **Vía de Embarque**, Ruta, Tipo BL, Tipo Contenedor, Tipo Tratamiento, Tipo Atmósfera, Bodega, Categoría, Tipo Pallet, Puerto (Embarque/Destino), Destino Final, Tipo Inspección.

**Entidades por rol/tipo:** Cliente, Comprador, Notify, Consignatario, Facturar a, Naviera, Embarcador, Agente Aduana, Transportista, **Gestor Logístico** (tipo nuevo, patrón `PLANTA`).

`TODO`: cotejar cuáles ya existen en `mantenedores-generales.md` / `entidades.md` y cuáles hay que crear.

---

## 9. Plan de implementación / Tests / DoD

> **Cierre Comercial v1 (R12) — cobertura de tests diferida (decisión de negocio, Christian, 2026-07-27).** Esta sección **no exige** cobertura de integración para `condicionPagoId`/snapshot de cuotas, `modalidadVentaId`/`clausulaVentaId`/`tipoFleteId` ni rango `calibreInicioId`/`calibreFinId` como condición para dar por cerrada la implementación. La falta de esos casos (`CCOM-QA-001`, ver `Docs/Hallazgos/notas-venta-instructivo-embalaje.md`) queda **aceptada como gap postergado**, no como defecto bloqueante — se retoma cuando el usuario decida agregarla.

`TODO` (completar al cerrar §10):
- Migraciones Prisma.
- Endpoints + validaciones.
- Tests: creación NV, borrado bloqueado con embarque (R3), herencia y bloqueo de campos (R4), validación fruta ⊆ NV (R8), herencia de precio (R5), generación de ≥1 `InstructivoHijo` por Embarque con código autogenerado `{folio}-{n}` (R11).
- Reconcile de `reclamos.md` (instructivo → FK Embarque).

---

## 10. Preguntas abiertas / decisiones pendientes

- **✅ Q1 (RESUELTA).** El campo **`Folio`** de la Orden de Embarque **es** el número de instructivo (ej. `MAR0042`) — `Folio` = Número de Instructivo, mismo dato/campo. Desde 2026-08-13 (R10) se **calcula automáticamente** al generar el Embarque, ya no se ingresa a mano. El número es la identidad del instructivo **padre** (el Embarque); los **hijos** por punto de retiro derivan su código automáticamente (`MAR0042-1`, `MAR0042-2`; ver R11). Referenciado por FK al `Embarque` desde Despacho, Compras, Facturas, Reclamos, Liquidaciones, Precios.
- **Q2.** ¿Puede una NV → Embarque ser también N:1 (varias NV consolidando un Instructivo)? → por resolver (R7).
- **Q3.** La validación fruta Embarque ⊆ NV (R8), ¿topea además **cantidades**, o solo restringe el catálogo (especie/variedad/artículo/calibre/categoría)?
- **Q4.** Campos exactos de la **respuesta de reserva** del Gestor Logístico (¿naviera, nave, tipo de contenedor, fechas?).
- **Q5.** Niveles de permiso por perfil/ítem de menú (§3).
- **Q6.** Programa Comercial: ¿se sistematiza o se descarta definitivamente?
