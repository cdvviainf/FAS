# Módulo: Reclamos — FAS

> **Spec de módulo para desarrollo autónomo con Claude Code.** Extiende `CLAUDE.md` y `00-entorno-general.md`.
>
> | | |
> |---|---|
> | **Key users** | Comercial (crea el reclamo, arma la Provisión, valoriza) · Calidad (completa el análisis: comentario + documentación) |
> | **Secciones de menú** | Ventas › Embarques (creación, dentro del detalle del Embarque) · Calidad › Reclamos (listado + análisis) |
> | **Backend** | `fas-api` · módulo `/api/ventas` (recurso anidado a Embarque) + `/api/calidad` (listado/análisis) |
> | **Frontend** | `fas-web` · pestaña "Reclamos" en `features/ventas/embarques/` + `features/calidad/reclamos/` |
> | **Depende de** | Embarque (`ventas.md`, con Pallet/PalletLinea ya reservados), Entidad (Cliente, heredado), Moneda (heredada) |
> | **Estado** | Reconciliado (2026-09-08) — pendiente de construir |

---

## 0. Supersesión (2026-09-08) — reconciliación contra el Embarque real

> El spec original (Etapa B) se escribió **antes de que existiera el módulo Embarque** — por eso `Reclamo.instructivo` era texto libre y la asociación no bajaba a nivel de pallet. `ventas.md` ya dejaba anotado el pendiente exacto ("el campo `instructivo` pasa a FK a `Embarque`"). Esta versión resuelve eso y agrega lo que se decidió en la reconciliación:
>
> - **`instructivo` (texto) → `embarqueId` (FK real)**. El Reclamo se crea **desde el detalle del Embarque** en Ventas, no desde un formulario independiente.
> - **Se agrega trazabilidad a nivel de `PalletLinea`** (no existía en el spec original): el reclamo marca exactamente qué líneas de qué pallets del Embarque están afectadas, con cantidad de cajas reclamada (puede ser parcial). El campo único `especieId` de cabecera del spec original **se elimina** — un reclamo puede tocar más de una especie si el Embarque es mixto; la o las especies involucradas se derivan de las líneas marcadas.
> - **`clienteId` y `monedaId` se heredan del Embarque** (vía su Nota de Venta) al crear el reclamo — no se vuelven a elegir a mano, y no son editables después.
> - **El flujo cambia de dueño por paso:** Comercial crea (Embarque + líneas marcadas + Provisión inicial); Calidad completa (comentario + documentación); Comercial valoriza (monto confirmado, paso posterior e independiente de la Provisión). Cierre sigue siendo un paso aparte con permiso propio.
> - **Provisión y Valorización dejan de ser "reclamado vs. autorizado" (negociación).** Pasan a ser dos momentos distintos del mismo número: **Provisión = estimación inicial** (con método de cálculo), **Valorización = confirmación posterior** (monto único). Ambos campos son `≥ 0`, sin relación de `≤` entre sí — el confirmado puede terminar siendo mayor o menor que lo estimado.
> - **Se elimina el mantenedor dinámico de "Características de reclamo por especie" y el checklist "Criterios de Cumplimiento"** (Documento 107-like) — decisión de negocio, Christian: simplificado a un campo de texto (`comentarioCalidad`) + documentos adjuntos.
> - **Sin correlativo propio.** El Reclamo es parte del Embarque — no lleva un número de documento independiente (nada de `PrefijoCodigo`). Se identifica por el folio/número de instructivo del Embarque al que pertenece; si un Embarque tiene más de un Reclamo, se listan todos bajo ese mismo folio (fecha/cliente/resumen para diferenciarlos en pantalla).
> - **`PR6`/`PR7` (alerta de Nota de Crédito en Cobranza, alimentar el Score de Riesgo) quedan solo documentados, sin implementación** — los módulos de los que dependen (Facturación/Cobranza, Score) no existen todavía en el código.

---

## 1. Contexto

Tras exportar la fruta, el **cliente en destino** puede reclamar por la calidad recibida. El reclamo llega a **Comercial**, que lo registra directamente sobre el **Embarque** correspondiente: identifica qué pallets/líneas de lo despachado están afectados y, si corresponde, deja una **Provisión** (estimación de monto). **Calidad** completa después el análisis (comentario + documentación del cliente). Más adelante, **Comercial confirma la Valorización** (monto final) y, cuando corresponde, **cierra** el reclamo con un veredicto.

---

## 2. Alcance

**Construye:**
1. **Reclamo** — creación por Comercial desde el detalle del Embarque: selección de `PalletLinea`(s) afectadas con cantidad de cajas reclamada, resumen del cliente, Provisión inicial opcional.
2. **Análisis de Calidad** — pantalla propia (`Calidad › Reclamos`) que lista todos los reclamos creados (por folio de Embarque); al abrir uno, Calidad agrega `comentarioCalidad` y adjunta documentación.
3. **Valorización** — Comercial confirma un monto final (`valorConfirmado`), independiente de la Provisión.
4. **Cierre** — veredicto (`procedencia`), bloquea edición posterior salvo reapertura con permiso.
5. **Provisión** — reserva de monto asociada al reclamo (por caja, por kilo o monto fijo/"cerrado"), en la moneda heredada del Embarque, con reversa e historial (nunca se elimina).

**NO construye (fuera de alcance):**
- Cálculo de impacto del reclamo en liquidaciones.
- **Emisión de la Nota de Crédito** sobre la factura del embarque — vive en `cobranza.md`; acá solo quedaría expuesta la provisión vigente para que Cobranza alerte (PR6, diferido — Cobranza/Facturación no existe todavía).
- Alimentar el Score de Riesgo (PR7, diferido — el motor de Score no existe todavía).

---

## 3. Decisiones cerradas (defaults)

| # | Decisión | Default |
|---|---|---|
| RC-D1 | Asociación a embarque | FK real `embarqueId` (ya no texto libre). |
| RC-D2 | Documentación | Cualquier archivo digital (imagen, PDF, correo, otro) — igual que antes. |
| RC-D4 | Cliente / Moneda | Heredados del Embarque (vía su Nota de Venta) al crear — no editables. |
| RC-D6 | Estados | `INGRESADO` (Comercial crea) → `VALORIZADO` (Comercial confirma monto) → `CERRADO`. `CERRADO` bloquea edición (R9). El paso de Calidad (comentario + documentos) **no es una transición de estado** — se puede completar mientras el reclamo no esté `CERRADO`. |
| RC-D7 | Valorización | Campo único `valorConfirmado`, sin relación `≤`/`≥` con la Provisión — ambos `≥ 0`. Permiso separado de valorización (no basta el acceso general). |
| RC-D8 | Veredicto | Campo explícito `procedencia` (`PROCEDENTE`/`IMPROCEDENTE`/`PARCIAL`), requerido para cerrar. |
| RC-D9 | Season-scope | `temporadaId` en el reclamo. |
| RC-D10 | Provisión | Se crea desde el reclamo (no desde Cobranza), en el momento de la creación o después. Nunca se elimina: se reversa (a mano, con permiso `RECLAMO_PROVISION`; o sola, al valorizar — ver R6). Permiso de crear/reversar **específico** (`RECLAMO_PROVISION`), distinto del acceso general a Reclamos. |
| RC-D11 | Numeración | Sin correlativo propio — el reclamo se identifica por el folio del Embarque al que pertenece. |
| RC-D12 | Granularidad del reclamo | Por `PalletLinea` (no por Pallet completo), con cantidad de cajas reclamada (puede ser parcial). La especie/variedad/calibre/categoría del reclamo se derivan de las líneas marcadas — sin campo único de especie en la cabecera. |
| RC-D13 | Datos de Calidad | Simplificado: un campo de texto (`comentarioCalidad`) + documentos adjuntos (selector de archivo simple, no drag&drop) — sin mantenedor dinámico de características ni checklist de cumplimiento. |
| RC-D14 | API externa de documentos | `/api/externo/reclamos/...`, autenticada por `RECLAMOS_API_KEY` (secreto compartido fijo, sin sesión FAS) — ver §6. |

---

## 4. Modelo de datos (Prisma)

```prisma
enum EstadoReclamo { INGRESADO VALORIZADO CERRADO }
enum Procedencia { PROCEDENTE IMPROCEDENTE PARCIAL }
enum TipoDocumentoReclamo { IMAGEN PDF CORREO OTRO }
enum TipoCalculoProvision { POR_UNIDAD_CAJA POR_PESO_KILO MONTO_FIJO }
enum EstadoProvision { VIGENTE REVERSADA }

model Reclamo {
  id            Int      @id @default(autoincrement())
  empresaId     Int
  empresa       Empresa  @relation(fields: [empresaId], references: [id])

  embarqueId    Int                                  // FK real (RC-D1)
  embarque      Embarque @relation(fields: [empresaId, embarqueId], references: [empresaId, id])

  clienteId     Int                                  // heredado del Embarque al crear (RC-D4)
  cliente       Entidad  @relation("ReclamoCliente", fields: [empresaId, clienteId], references: [empresaId, id])
  monedaId      Int                                  // heredado del Embarque al crear (RC-D4)
  moneda        Moneda   @relation(fields: [monedaId], references: [id])

  fechaReclamo   DateTime? @db.Date                  // fecha en que el cliente reclamó
  resumenCliente String?                             // resumen breve de lo reclamado

  estado        EstadoReclamo @default(INGRESADO)
  procedencia   Procedencia?                         // requerido para cerrar (R5b)

  comentarioCalidad String?                          // análisis de Calidad (RC-D13)

  valorConfirmado   Decimal?  @db.Decimal(14, 4)     // Valorización — monto final (RC-D7)
  valorizadoPor     String?
  fechaValorizacion DateTime?

  temporadaId   Int?

  lineas        ReclamoPalletLinea[]
  documentos    ReclamoDocumento[]
  provisiones   Provision[]

  creadoEn      DateTime  @default(now())
  creadoPor     String
  actualizadoEn DateTime? @updatedAt
  actualizadoPor String?
  eliminadoEn   DateTime?
  eliminadoPor  String?

  @@index([empresaId, embarqueId])
  @@index([estado])
}

// Qué se reclama exactamente (RC-D12) — join a la línea real del pallet ya
// reservado en el Embarque (ventas.md, compras.md §4.5/§4.7).
model ReclamoPalletLinea {
  id            Int        @id @default(autoincrement())
  reclamoId     Int
  reclamo       Reclamo    @relation(fields: [reclamoId], references: [id], onDelete: Cascade)
  palletLineaId Int
  palletLinea   PalletLinea @relation(fields: [palletLineaId], references: [id])
  cantidadCajas Int                                  // ≤ cajas disponibles de esa línea (R-NEW1, ver §5)

  @@unique([reclamoId, palletLineaId])
  @@index([palletLineaId])
}

model ReclamoDocumento {
  id        Int                   @id @default(autoincrement())
  reclamoId Int
  reclamo   Reclamo               @relation(fields: [reclamoId], references: [id], onDelete: Cascade)
  nombre    String
  ruta      String
  mimeType  String?
  tipo      TipoDocumentoReclamo?
  subidoPor String
  creadoEn  DateTime              @default(now())

  @@index([reclamoId])
}

// ───── Provisión (monto reservado — estimación inicial, RC-D10) ─────
model Provision {
  id               Int                  @id @default(autoincrement())
  reclamoId        Int                                            // obligatorio (PR1)
  reclamo          Reclamo              @relation(fields: [reclamoId], references: [id])
  tipoCalculo      TipoCalculoProvision
  valorUnitario    Decimal?             @db.Decimal(12, 4)        // $/caja o $/kilo
  cantidadAfectada Decimal?             @db.Decimal(12, 2)        // cajas o kilos — sugerida desde `lineas`, editable
  montoFijo        Decimal?             @db.Decimal(12, 2)        // si tipoCalculo = MONTO_FIJO ("monto cerrado")
  montoCalculado   Decimal              @db.Decimal(12, 2)        // resultado final, en la moneda del Reclamo
  estado           EstadoProvision      @default(VIGENTE)
  fechaCreacion    DateTime             @default(now())
  creadoPorId      String
  fechaReversa     DateTime?
  reversadoPorId   String?

  @@index([reclamoId])
}
```

> Back-relations a agregar: `Embarque` → `reclamos`; `Entidad` → `reclamosCliente`; `Moneda` → `reclamos`; `PalletLinea` → `reclamoLineas`.

---

## 5. Reglas de negocio / invariantes

- **R1 — Asociación a embarque.** Todo reclamo referencia un `embarqueId` real. Se crea desde el detalle del Embarque en Ventas (no hay pantalla de creación independiente).
- **R2 — Documentación.** Se aceptan archivos de cualquier tipo (imagen, PDF, correo, otro).
- **R-NEW1 — Cantidad reclamada acotada, acumulada entre reclamos.** La suma de `cantidadCajas` reclamadas contra una misma `PalletLinea`, **sumando entre todos los reclamos no eliminados** (no solo dentro del mismo reclamo), no puede superar `PalletLinea.cajas` → 422. Evita que dos reclamos distintos reclamen la misma caja dos veces. La misma `palletLineaId` **no puede repetirse dos veces dentro del mismo body** (`lineas`) → 422 (evita una violación de índice único al persistir).
- **R-NEW2 — Líneas del mismo embarque.** Toda `PalletLinea` marcada en `ReclamoPalletLinea` debe pertenecer a un `Pallet` con `embarqueId` igual al del Reclamo → 422 si no.
- **R5 — Flujo.** `INGRESADO` (Comercial crea) → `VALORIZADO` (Comercial confirma monto) → `CERRADO`. El paso de Calidad (comentario + documentos) no es una transición de estado — editable mientras el reclamo no esté `CERRADO`. **Cerrar exige estar `VALORIZADO` primero** — cerrar directo desde `INGRESADO` → 422 (no se puede saltar la valorización). **R5b:** antes de cerrar debe registrarse la `procedencia`.
- **R6 — Valorización.** `valorConfirmado ≥ 0`. Solo usuarios con el **permiso específico de valorización** (`RECLAMO_VALORIZACION`) — no basta el acceso general a reclamos. **Efecto colateral (2026-09-08):** al valorizar, cualquier Provisión `VIGENTE` del mismo reclamo se **reversa automáticamente** — es un efecto de sistema (la estimación inicial ya no aplica una vez que existe el monto confirmado), no pasa por el chequeo "no la reversa quien la creó" de PR3 (eso rige solo para la reversa manual).
- **R9 — Bloqueo por cierre.** Un reclamo `CERRADO` no admite modificaciones (líneas, documentos, comentario, valorización, provisiones) → **403** (no 422 — el bloqueo por estado es un caso de permiso/autorización, no de validación de datos). Reabrir requiere permiso específico (`RECLAMO_CIERRE`, misma acción cubre cerrar/reabrir). El chequeo de estado y la escritura van en la misma operación atómica — un cierre concurrente no puede colarse en la ventana entre "revisar estado" y "escribir".
- **R8 — Auditoría + softdelete** en el reclamo.

### Provisión

- **PR1 — Reclamo obligatorio.** No existen provisiones sin `reclamoId` → 422.
- **PR2 — Cantidad acotada, invariante permanente.** `cantidadAfectada` (cajas o kilos) no puede superar lo reclamado (`SUM(ReclamoPalletLinea.cantidadCajas)` del mismo reclamo, o su equivalente en kilos) → 422. No es solo un chequeo al crear la Provisión: **editar las líneas del reclamo (`PATCH`) revalida las Provisiones `VIGENTE` contra los nuevos totales** — si reducir las líneas dejaría alguna por sobre lo que queda reclamado, la edición completa se rechaza (422); no se reversa la Provisión sola de forma automática (esa reversa automática está reservada para el efecto de Valorizar, R6).
- **PR3 — Reversa manual, nunca borrado.** Cualquier usuario con el permiso `RECLAMO_PROVISION` puede reversar a mano (no debe ser quien la creó), y solo si el Reclamo padre no está `CERRADO` (→ 403 si lo está, R9 aplica también a Provisiones). La reversa fija `estado = REVERSADA` y registra `fechaReversa`/`reversadoPorId`; el registro **nunca se elimina**. (La reversa **automática** al valorizar — ver R6 — es un camino aparte que no aplica el chequeo "no quien la creó" ni pasa por acá.) Crear una Provisión también exige `RECLAMO_PROVISION` — permiso específico, distinto del acceso general a Reclamos, **incluida la Provisión inline** que se puede armar en el mismo `POST` de creación del Reclamo (RC-D10): sin ese permiso, el body no puede traer `provision` aunque el usuario sí tenga acceso para crear el Reclamo.
- **PR4 — Independencia de la NC.** Una provisión reversada puede o no derivar en una Nota de Crédito; son pasos independientes.
- **PR5 — Efecto en cartera.** Mientras `estado = VIGENTE`, el `montoCalculado` reduce el **saldo pendiente visible** del cliente/embarque en Cobranza (informativo — no altera montos de `Cuota`). **Diferido**: Cobranza no existe todavía.
- **PR6 — Alerta al emitir NC.** *(Diferido, sin Cobranza/Facturación construido.)*
- **PR7 — Alimenta el Score.** *(Diferido, sin motor de Score construido.)*

---

## 6. Contratos API

**Creación y detalle (Ventas — recurso anidado a Embarque)**
| Método | Ruta | Notas |
|---|---|---|
| POST | `/api/ventas/embarques/:embarqueId/reclamos` | Crea el reclamo (hereda cliente/moneda del Embarque). Body incluye `lineas: [{palletLineaId, cantidadCajas}]` y, opcionalmente, la Provisión inicial. |
| GET | `/api/ventas/embarques/:embarqueId/reclamos` | Lista los reclamos de ese Embarque. |
| PATCH | `/api/ventas/embarques/:embarqueId/reclamos/:id` | Edita cabecera/líneas mientras no esté `CERRADO` (403 si lo está). Si viene `lineas`, **reemplaza el set completo** (no un merge) — revalida R-NEW1/R-NEW2 excluyendo las líneas propias del reclamo del cálculo de "ya reclamado" (se están reemplazando, no sumando). Sin `provision` — esa tiene su propio endpoint. |

**Análisis y ciclo de vida (Calidad)**
| Método | Ruta | Notas |
|---|---|---|
| GET | `/api/calidad/reclamos` | Lista todos los reclamos (todos los Embarques), filtrable por `folio` (busca sobre `embarque.numeroInstructivo`, contains/insensitive), `estado` y `clienteId`. Paginado (`page`/`limit`). |
| GET | `/api/calidad/reclamos/:id` | Detalle completo (líneas, documentos, provisiones). |
| PATCH | `/api/calidad/reclamos/:id/analisis` | `{ comentarioCalidad }` — sin cambio de estado. |
| POST | `/api/calidad/reclamos/:id/documentos` | Sube documentación. |
| POST | `/api/calidad/reclamos/:id/valorizar` | `{ valorConfirmado }` → `VALORIZADO` (R6, permiso `RECLAMO_VALORIZACION`). |
| POST | `/api/calidad/reclamos/:id/cerrar` | `{ procedencia }` → `CERRADO` (R5b/R9, permiso `RECLAMO_CIERRE`). |
| POST | `/api/calidad/reclamos/:id/reabrir` | Reabre (mismo permiso `RECLAMO_CIERRE`). |

**Provisiones**
| Método | Ruta | Notas |
|---|---|---|
| GET/POST | `/api/calidad/reclamos/:id/provisiones` | Crea/lista provisiones del reclamo. Requiere permiso `RECLAMO_PROVISION`. Valida PR1/PR2. |
| POST | `/api/calidad/provisiones/:id/reversar` | Reversa la provisión (PR3, permiso `RECLAMO_PROVISION`). Nunca elimina. |

### API externa de documentos (2026-09-08)

Consultas externas a la documentación de un reclamo — sistema externo con su propia API key (mismo espíritu que la integración saliente con AGL360, pero en sentido inverso: acá es un tercero llamando **hacia** FAS). Sin sesión de usuario FAS.

| Método | Ruta | Notas |
|---|---|---|
| GET | `/api/externo/reclamos/:id/documentos` | Lista metadata de los documentos del reclamo. |
| GET | `/api/externo/reclamos/:id/documentos/:documentoId` | Descarga el archivo. |

- **Autenticación:** header `Authorization: Bearer <RECLAMOS_API_KEY>`, comparado contra la env var `RECLAMOS_API_KEY` (`timingSafeEqual`, fail-closed si no está configurada — mismo criterio que `AGL360_WEBHOOK_SECRET`).
- **Sin sesión → sin contexto de empresa automático.** El tenant del reclamo se resuelve primero (consulta directa contra el `id` del reclamo) y recién ahí se fija el contexto para el resto de la operación — mismo patrón que el webhook AGL360, que deriva el tenant de `referencia_externa` antes de tocar cualquier modelo tenant.
- **Límite conocido, no resuelto:** esta ruta no aplica aislamiento multiempresa por sesión — queda acotada solo por conocer el `id`/`documentoId` exactos (IDs numéricos autoincrementales, no adivinables en la práctica pero tampoco criptográficamente opacos). Si en el futuro hay más de un consumidor externo con necesidad real de aislarse entre sí, revisar.
- **Consumidor, alcance entre empresas y rotación del secreto:** sin definir todavía — pendiente cuando exista un consumidor real concreto.

---

## 7. Frontend

**Ventas → Embarques → detalle → pestaña "Reclamos" (creación/edición, Comercial):**
- Botón "Nuevo Reclamo" → selector de líneas afectadas con **dos vistas intercambiables** (RC-D12): por Pallet (lista plana, elige líneas puntuales) o por características (agrupado especie/variedad/calibre/categoría, elige el grupo y marca cuántas cajas de él) — misma lógica de agrupación que ya usa Stock de Fruta, aplicada acá para seleccionar en vez de solo visualizar.
- Cabecera: fecha del reclamo del cliente, resumen. Cliente y moneda se muestran heredados (no editables).
- Provisión opcional en el mismo paso: tipo de cálculo (caja/kilo/monto cerrado), valor unitario o monto fijo, cantidad afectada (prellenada desde las líneas marcadas, editable).
- Cada fila de la tabla de reclamos del Embarque tiene un botón "Editar" (oculto si el reclamo está `CERRADO`) que reabre el mismo diálogo precargado, para modificar cabecera/líneas vía el `PATCH` (sin Provisión — esa se administra desde el detalle en Calidad).

**Calidad → Reclamos (análisis, listado propio):**
- Tabla de todos los reclamos, identificados por **folio del Embarque** (no tienen número propio) + fecha + cliente + estado, filtrable por folio/cliente/estado y paginada.
- Detalle: comentario de Calidad (texto), documentos adjuntos (**selector de archivo simple** — no drag&drop, decisión de negocio: es funcionalmente equivalente y no vale la pena el trabajo de UI extra), y desde ahí también provisiones/valorización/cierre (según permiso).

---

## 8. Criterios de aceptación (Given / When / Then)

- **CA1 (R1):** Crear un reclamo sin `embarqueId` válido → 422; con uno existente → OK.
- **CA2 (R-NEW1):** Dos reclamos distintos intentan reclamar, en conjunto, más cajas que las que tiene una `PalletLinea` → el segundo → 422.
- **CA3 (R-NEW2):** Marcar una `PalletLinea` que pertenece a otro Embarque → 422.
- **CA4 (R2):** Adjuntar una imagen, un PDF y un correo al mismo reclamo → 3 documentos.
- **CA5 (PR1/PR2):** Provisión sin `reclamoId` → 422; con `cantidadAfectada` mayor a lo reclamado → 422.
- **CA6 (R6):** Valorizar con `valorConfirmado < 0` → 422; con un valor `≥ 0` → estado `VALORIZADO`.
- **CA7 (R6 permiso):** Un usuario sin `RECLAMO_VALORIZACION` no puede valorizar → 403 (aunque tenga acceso general a reclamos).
- **CA8 (R5):** Flujo `INGRESADO → VALORIZADO → CERRADO` respeta el orden; completar el comentario de Calidad no cambia el estado.
- **CA9 (R5b):** Cerrar sin `procedencia` → 422; con `PARCIAL`/`PROCEDENTE`/`IMPROCEDENTE` → `CERRADO`.
- **CA10 (R9):** Editar/valorizar un reclamo `CERRADO` → 403; solo con `RECLAMO_CIERRE` se puede reabrir y volver a modificar.
- **CA11 (PR3):** Reversar una provisión → `REVERSADA`, sigue visible en el historial, nunca se borra.
- **CA12 (R5):** Cerrar un reclamo `INGRESADO` (sin pasar por `VALORIZADO`) → 422, no 403 (es una regla de flujo, no un bloqueo por cierre).
- **CA13 (R6):** Valorizar un reclamo que tiene una Provisión `VIGENTE` → la Provisión queda `REVERSADA` automáticamente (sin exigir que quien valoriza sea distinto de quien creó la Provisión).
- **CA14 (IMP-QA-R1-019):** Editar (`PATCH`) las líneas de un reclamo reemplaza el set completo — las líneas anteriores dejan de contar como "reclamadas" (quedan libres para otro reclamo), las nuevas se revalidan contra R-NEW1/R-NEW2.
- **CA15 (RC-D10):** Crear o reversar una Provisión sin el permiso `RECLAMO_PROVISION` → 403, aunque el usuario tenga acceso general a Reclamos. Incluye la Provisión **inline** del `POST` de creación del Reclamo — un usuario con solo `VENTAS_EMBARQUES` no puede colarla mandando `provision` en el body.
- **CA16 (PR3/R9):** Reversar una Provisión de un Reclamo ya `CERRADO` → 403, aunque quien reversa no sea quien la creó.
- **CA17 (R-NEW1):** Mandar dos entradas con el mismo `palletLineaId` en `lineas` (crear o editar) → 422, no un error 500 de base de datos.
- **CA18 (PR2):** Un reclamo con una Provisión `VIGENTE` de 10 cajas se edita reduciendo el total reclamado a 2 cajas → 422, la edición no se aplica y la Provisión sigue en 10.

---

## 9. Plan de implementación (orden para Claude Code)

1. Modelos + migración (`Reclamo`, `ReclamoPalletLinea`, `ReclamoDocumento`, `Provision` + enums). Back-relations en `Embarque`/`Entidad`/`Moneda`/`PalletLinea`.
2. Backend: creación de Reclamo (anidada a Embarque, hereda cliente/moneda, valida R-NEW1/R-NEW2) + líneas + documentos.
3. Backend: Provisión (crear/listar/reversar, PR1-PR3) + Valorización (R6) + Cierre/Reapertura (R5b/R9).
4. Tests CA1–CA11 contra Postgres real.
5. Frontend: pestaña "Reclamos" en Embarque (Ventas) con selector dual (por pallet / por características) + Provisión inline.
6. Frontend: pantalla `Calidad → Reclamos` (listado por folio de Embarque + detalle con comentario/documentos/valorización/cierre).

---

## 10. Definition of Done

- [ ] Reclamo creable desde el detalle del Embarque, con líneas marcadas y Provisión opcional.
- [ ] Pantalla de Calidad lista todos los reclamos por folio de Embarque; comentario + documentos completables sin bloquear por estado.
- [ ] Valorización y Cierre con permisos separados (`RECLAMO_VALORIZACION`/`RECLAMO_CIERRE`), veredicto `procedencia` requerido para cerrar.
- [ ] R-NEW1 (acumulado entre reclamos) y R-NEW2 (línea del mismo embarque) validados.
- [ ] Provisión con reversa-nunca-borrado (PR1-PR3) funcionando.
- [ ] Tests CA1–CA11 en verde.
- [ ] Schema incorporado al `CLAUDE.md` global.
