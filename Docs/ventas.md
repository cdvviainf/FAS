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
  tipoEmbarqueId   Int
  mercadoId        Int
  paisDestinoId    Int
  puertoDestinoId  Int?
  direccionId      Int?
  direccionDetalle String?

  // --- Condiciones de venta ---
  modalidadVentaId Int?
  clausulaVentaId  Int?      // Incoterm
  tipoFleteId      Int?
  formaPagoId      Int?
  saldoPagoId      Int?
  monedaId         Int

  observaciones    String?

  detalles         NotaVentaDetalle[]
  embarques        Embarque[]

  creadoPorId      String                          // Usuario (Better Auth)
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt
  deletedAt        DateTime?

  @@index([clienteId])
  @@index([fecha])
}

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
  precio          Decimal   @db.Decimal(14, 4)

  calibres        NotaVentaDetalleCalibre[]         // Calibre es multiselect

  @@index([notaVentaId])
}

model NotaVentaDetalleCalibre {
  id        Int              @id @default(autoincrement())
  detalleId Int
  detalle   NotaVentaDetalle @relation(fields: [detalleId], references: [id], onDelete: Cascade)
  calibreId Int
  @@unique([detalleId, calibreId])
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

---

## 6. Contratos API (Fastify, prefijo `/api/ventas`)

| Método | Ruta | Notas |
|---|---|---|
| GET/POST/PATCH/DELETE | `/notas-venta[/:id]` | DELETE solo sin embarque asociado (R3). PATCH bloquea campos heredados si hay embarque. |
| POST | `/notas-venta/:id/detalles` | Línea de fruta (calibre multiselect). |
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

1. **Nota de Venta** — encabezado (Folio, Fecha, Cliente, Tipo Embarque, Mercado, País Destino, Dirección/Detalle, Puerto Destino, Comprador, Notify, Modalidad Venta, Cláusula Venta, Tipo Flete, Forma Pago, Saldo Pago, Moneda, Cliente Final, Observaciones) → **Continuar**.
2. **Detalle NV** — línea (Fecha Compromiso, Especie, Variedad, Artículo, Calibre multi, Categoría, Tipo Pallet, Cant. Pallets, Cajas x Pallet, Cajas, Precio) + grilla → **Terminar**.
3. **Orden de Embarque** — encabezado extenso (incluye **`Folio`** = N° de instructivo, texto manual único) + botón **Seleccionar Reserva** (rellena datos logísticos desde la reserva).
4. **Detalle Orden Embarque** — botón **Contenedor** → campos del contenedor + checks de inspección/fumigación.
5. **Detalle Asignación Contenedor** (modal) — Artículo, Variedad, Calibre, Tipo Pallet, Cant. Pallets, Cajas x Pallet, Cajas, Valor + grilla con Total.

---

## 8. Mantenedores y catálogos requeridos

**Mantenedores nuevos/confirmar:** Tipo Embarque, Modalidad de Venta, Cláusula de Venta (Incoterm), Tipo Flete, Forma de Pago, Saldo Pago, **Vía de Embarque**, Ruta, Tipo BL, Tipo Contenedor, Tipo Tratamiento, Tipo Atmósfera, Bodega, Categoría, Tipo Pallet, Puerto (Embarque/Destino), Destino Final, Tipo Inspección.

**Entidades por rol/tipo:** Cliente, Comprador, Notify, Cliente Final, Facturar a, Naviera, Embarcador, Agente Aduana, Transportista, **Gestor Logístico** (tipo nuevo, patrón `PLANTA`).

`TODO`: cotejar cuáles ya existen en `mantenedores-generales.md` / `entidades.md` y cuáles hay que crear.

---

## 9. Plan de implementación / Tests / DoD

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
