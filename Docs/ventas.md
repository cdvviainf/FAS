# Módulo Ventas — `ventas.md`

> **Estado:** BORRADOR DE CONTEXTO (definición en curso).
> **Q1 (Folio / número de instructivo): RESUELTA** — `Folio` = Número de Instructivo (mismo campo, manual). Ver §4.2, R6 / R10 / R11.
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

- **El número de instructivo NACE en el Instructivo / Orden de Embarque.** Se ingresa **manualmente** en el campo **`Folio`** del Embarque (`Folio` = Número de Instructivo, mismo dato; ej. `001A`). Es el identificador de negocio ancla y la identidad del **instructivo padre**. Lo referencian por FK **al `Embarque`**: **Despacho, Compras (OC de fruta), Facturas, Reclamos, Liquidaciones, Precios.** El Embarque genera además **≥1 instructivos hijos** por punto de retiro, con código autogenerado `{folio}-{n}` (ej. `001A-1`; ver R11).
- **Corrección a `reclamos.md`:** el campo `instructivo` (hoy texto libre, "pendiente de FK") pasa a **FK a `Embarque`** una vez cerrado este módulo. → *reconcile posterior.*
- **Compras:** el mismo número de instructivo se reutiliza en las Órdenes de Compra de fruta. La mecánica exacta (unicidad global vs. conciliación por valor) se resuelve en `compras.md`.
- **Cobranza:** el eje operacional de `cobranza.md` es el **Embarque**. El `Valor` de la asignación de contenedor (heredado desde la Nota de Venta) alimenta el precio **sugerido** de la Proforma, que es editable en esa instancia.
- **Entidades:** requiere tipos/roles de `Entidad`: Cliente, Comprador, Notify, Cliente Final, Facturar a, Naviera, Embarcador, Agente Aduana, Transportista, **Gestor Logístico**.

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
> - `calibres NotaVentaDetalleCalibre[]` (multiselect) → **`calibreInicioId`/`calibreFinId`** (FK a `Calibre`, rango sobre el maestro ordenado por especie — mismo patrón que `OrdenCompraLinea.calibreMinId/calibreMaxId` en `compras.md` §6.5).
> - `modalidadVentaId`, `clausulaVentaId` (Incoterm), `tipoFleteId` quedan como FK reales al catálogo genérico `Parametro` (antes eran `Int` suelto a la espera de que existieran sus `TipoParametro`; ya se dieron de alta vía seed: `MODALIDAD_VENTA`, `INCOTERM`, `TIPO_FLETE`).
> - **Fuera de esta implementación:** el bloque Embarque/Instructivo (§4.2) y Solicitud de Reserva (§4.3) siguen sin implementar, diferidos a una etapa posterior — no se tocan por esta supersesión.
> Ver `Docs/Hallazgos/notas-venta-instructivo-embalaje.md` para el detalle de la reconciliación QA.

```prisma
model NotaVenta {
  id               Int       @id @default(autoincrement())
  folio            Int       @unique              // correlativo autonumérico (ver §5 R1)
  fecha            DateTime

  // --- Partes / entidades ---
  clienteId        Int
  compradorId      Int?
  notifyId         Int?
  clienteFinalId   Int?

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

  calibreInicioId Int                                // FK → Calibre, rango sobre el maestro ordenado por especie
  calibreFinId    Int                                // FK → Calibre, idem (ver R12)

  @@index([notaVentaId])
}
```

### 4.2 Instructivo / Orden de Embarque

```prisma
model Embarque {
  id                Int       @id @default(autoincrement())
  notaVentaId       Int
  notaVenta         NotaVenta @relation(fields: [notaVentaId], references: [id])

  // Q1 RESUELTA: `Folio` = Número de Instructivo (mismo dato). Campo único manual.
  // Identidad del instructivo PADRE; la UI lo etiqueta "Folio". Ej. "001A".
  numeroInstructivo String    @unique            // manual, requerido — anclaje de negocio (campo UI "Folio")

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
- **R10 — Número de instructivo.** Texto ingresado **manualmente** en el campo `Folio` del Embarque (no correlativo), **único**, reutilizado en OC de Compras. Es la identidad del instructivo **padre**. **`Folio` = Número de Instructivo** (mismo dato; Q1 resuelta).
- **R11 — Instructivos hijos por punto de retiro.** Cada Embarque genera **≥1** `InstructivoHijo`, uno por planta / punto de retiro que aporta fruta al contenedor. Código **autogenerado** `{numeroInstructivo}-{n}` (ej. `001A-1`, `001A-2`). Contiene la fecha/hora de retiro de esa planta (varían entre plantas). Con una sola planta de retiro hay un **único hijo** (`001A-1`), para mantener la nomenclatura actual. La partición se **deriva de la reserva de pallets** al embarque, agrupando por punto de retiro (mecánica en Operaciones/Stock). Fuente de las fechas de retiro: **AGL** (§2, `compras.md`).
- **R12 — Forma de Pago y rango de calibre del detalle (Cierre Comercial v1, ver supersesión §4.1).** Al elegir una `CondicionPago` ("Forma de Pago") en el encabezado, sus cuotas (`porcentaje`/`plazoDias`) se **copian** a `NotaVentaCuotaPago` en el mismo momento (snapshot inmutable, igual que `OrdenCompraCuotaPago` en `compras.md` §4.2.1) — si la plantilla `CondicionPago` se edita después, los Cierres Comerciales ya guardados **no** cambian. Cada línea de detalle exige `calibreInicioId`/`calibreFinId` (rango, no multiselect), validado igual que `compras.md` §6.5: ambos deben pertenecer a la especie de la línea y `calibreInicio.orden <= calibreFin.orden` según el maestro ordenado.

---

## 6. Contratos API (Fastify, prefijo `/api/ventas`)

| Método | Ruta | Notas |
|---|---|---|
| GET/POST/PATCH/DELETE | `/notas-venta[/:id]` | DELETE solo sin embarque asociado (R3). PATCH bloquea campos heredados si hay embarque. |
| POST | `/notas-venta/:id/detalles` | Línea de fruta (rango de calibre inicio/fin, ver R12). |
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

1. **Nota de Venta** — encabezado (Folio, Fecha, Cliente, Tipo Embarque, Mercado, País Destino, Dirección/Detalle, Puerto Destino, Comprador, Notify, Modalidad Venta, Cláusula Venta, Tipo Flete, Forma de Pago —`CondicionPago`, cuotas se muestran como preview snapshot al guardar—, Moneda, Cliente Final, Observaciones) → **Continuar**.
2. **Detalle NV** — línea (Fecha Compromiso, Especie, Variedad, Artículo tipo Embalaje —etiqueta/kg neto/kg bruto heredados del artículo—, Calibre Inicio/Fin, Categoría, Tipo Pallet, Cant. Pallets, Cajas x Pallet, Cajas, Precio por caja) + grilla → **Terminar**.
3. **Orden de Embarque** — encabezado extenso (incluye **`Folio`** = N° de instructivo, texto manual único) + botón **Seleccionar Reserva** (rellena datos logísticos desde la reserva).
4. **Detalle Orden Embarque** — botón **Contenedor** → campos del contenedor + checks de inspección/fumigación.
5. **Detalle Asignación Contenedor** (modal) — Artículo, Variedad, Calibre, Tipo Pallet, Cant. Pallets, Cajas x Pallet, Cajas, Valor + grilla con Total.

---

## 8. Mantenedores y catálogos requeridos

**Ya implementados (Cierre Comercial v1, ver supersesión §4.1):** Modalidad de Venta, Cláusula de Venta (Incoterm) y Tipo Flete como `Parametro` genérico (mantenedores-generales.md) bajo sus `TipoParametro` `MODALIDAD_VENTA`/`INCOTERM`/`TIPO_FLETE`. Forma de Pago reemplazada por `CondicionPago` (`config/condiciones-pago`, compartido con Compras — no se crea un mantenedor "Saldo Pago" separado, ver R12).

**Mantenedores nuevos/confirmar (Embarque/Instructivo, aún sin implementar):** Tipo Embarque, **Vía de Embarque**, Ruta, Tipo BL, Tipo Contenedor, Tipo Tratamiento, Tipo Atmósfera, Bodega, Categoría, Tipo Pallet, Puerto (Embarque/Destino), Destino Final, Tipo Inspección.

**Entidades por rol/tipo:** Cliente, Comprador, Notify, Cliente Final, Facturar a, Naviera, Embarcador, Agente Aduana, Transportista, **Gestor Logístico** (tipo nuevo, patrón `PLANTA`).

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

- **✅ Q1 (RESUELTA).** El campo **`Folio`** de la Orden de Embarque **es** donde se ingresa manualmente el número de instructivo (ej. `001A`) — `Folio` = Número de Instructivo, mismo dato/campo. El número es la identidad del instructivo **padre** (el Embarque); los **hijos** por punto de retiro derivan su código automáticamente (`001A-1`, `001A-2`; ver R11). Referenciado por FK al `Embarque` desde Despacho, Compras, Facturas, Reclamos, Liquidaciones, Precios.
- **Q2.** ¿Puede una NV → Embarque ser también N:1 (varias NV consolidando un Instructivo)? → por resolver (R7).
- **Q3.** La validación fruta Embarque ⊆ NV (R8), ¿topea además **cantidades**, o solo restringe el catálogo (especie/variedad/artículo/calibre/categoría)?
- **Q4.** Campos exactos de la **respuesta de reserva** del Gestor Logístico (¿naviera, nave, tipo de contenedor, fechas?).
- **Q5.** Niveles de permiso por perfil/ítem de menú (§3).
- **Q6.** Programa Comercial: ¿se sistematiza o se descarta definitivamente?
