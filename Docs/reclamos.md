# Módulo: Calidad — Reclamos (Etapa B) — FAS

> **Spec de módulo para desarrollo autónomo con Claude Code.** Extiende `CLAUDE.md` y `00-entorno-general.md`.
>
> | | |
> |---|---|
> | **Etapa Calidad** | B — Gestión de reclamos (post-exportación) |
> | **Key users** | Comercial (deriva y valoriza) · Calidad/Isella (ingresa y evalúa) |
> | **Sección de menú** | Calidad › Reclamos |
> | **Backend** | `fas-api` · módulo `/api/calidad`, recurso `/reclamos` |
> | **Frontend** | `fas-web` · `app/(app)/calidad/reclamos/` |
> | **Depende de** | Mantenedores (`Especie`, `Moneda`), Entidades (`Cliente`), Usuarios y Perfiles, **Embarque** (código *Instructivo* — módulo pendiente) |
> | **Estado** | Listo para desarrollo (Etapa 1) |

---

## 0. Contexto para Claude Code

Tras exportar la fruta, el **cliente en destino** puede reclamar por la calidad recibida. El reclamo normalmente llega al **área Comercial**, que lo **deriva a Calidad**; Calidad abre el registro, lo asocia al **embarque** (código *Instructivo*, ej. `001A-1`), adjunta la documentación del cliente, registra el resumen y los datos del cliente (por especie), el texto de lo reclamado y un **checklist de cumplimiento**. Luego **Comercial valoriza** el reclamo (valor reclamado y valor autorizado).

---

## 1. Objetivo

Registrar y gestionar los reclamos de calidad: ingreso por Calidad (documentación, datos del cliente, evaluación) y valorización por Comercial, todo asociado al embarque.

---

## 2. Alcance

**Construye:**
1. Mantenedor **Características de reclamo (datos del cliente)** por especie.
2. Mantenedor **Criterios de cumplimiento** (checklist de evaluación).
3. **Reclamo** — ingreso por Calidad (docs, resumen, datos cliente, texto, checklist).
4. **Valorización** por Comercial (valor reclamado y autorizado).
5. **Provisión** — reserva de monto asociada al reclamo (por caja, por kilo o monto fijo), con reversa e historial.

**NO construye (fuera de alcance):**
- Módulo de **Embarque/Instructivo** (pendiente; aquí se referencia por código textual).
- Cálculo de impacto del reclamo en liquidaciones (Etapa 3).
- **Emisión de la Nota de Crédito** sobre la factura del embarque — vive en `cobranza.md`; aquí solo se expone la provisión vigente para que Cobranza alerte (PR6).

---

## 3. Decisiones cerradas (defaults)

| # | Decisión | Default |
|---|---|---|
| RC-D1 | Asociación a embarque | Por código **Instructivo** (texto) hasta que exista el módulo Embarque; luego FK. |
| RC-D2 | Documentación | Cualquier archivo digital (imagen, PDF, correo, otro). |
| RC-D3 | Datos del cliente | Mantenedor dinámico por especie (tipo de dato + unidad + valores válidos). Todo el mantenedor es "dato proporcionado por el cliente". |
| RC-D4 | Tipos de dato | `BOOLEAN` (Sí/No), `LISTA` (select), `DECIMAL` (con unidad), `PORCENTAJE`, `ENTERO`, `TEXTO`. |
| RC-D5 | Cumplimiento | Mantenedor **general** (no por especie). ✅ |
| RC-D6 | Estados | `INGRESADO` (Calidad) → `VALORIZADO` (Comercial) → `CERRADO`. `CERRADO` **bloquea edición** (R9). |
| RC-D7 | Valorización | `valorAutorizado ≤ valorReclamado`. Requiere un **permiso separado** de valorización (no basta el acceso general a reclamos). Moneda USD por defecto. ✅ |
| RC-D8 | Veredicto | Campo explícito `procedencia` (`PROCEDENTE`/`IMPROCEDENTE`/`PARCIAL`), además del `valorAutorizado`. ✅ |
| RC-D9 | Season-scope | `temporadaId` en el reclamo (E3). |
| RC-D10 | Provisión | Se **crea desde el reclamo** (no desde Cobranza). `reclamoId` obligatorio. Nunca se elimina: se reversa y queda en historial. |

---

## 4. Modelo de datos (Prisma)

```prisma
enum TipoDatoReclamo { BOOLEAN LISTA DECIMAL PORCENTAJE ENTERO TEXTO }
enum EstadoReclamo { INGRESADO VALORIZADO CERRADO }
enum Procedencia { PROCEDENTE IMPROCEDENTE PARCIAL }
enum TipoDocumentoReclamo { IMAGEN PDF CORREO OTRO }

// ───── Mantenedores (solo WEB) ─────
model CaracteristicaReclamoCliente {           // datos proporcionados por el cliente, por especie
  // + base (§4.1 mantenedores-generales.md)
  tipoDato TipoDatoReclamo
  unidad   String?                              // texto (ej. "°Brix")
  opciones CaracteristicaReclamoOpcion[]        // para LISTA (ej. Clasificación 1..5)
  especies CaracteristicaReclamoEspecie[]
}

model CaracteristicaReclamoOpcion {
  id               Int                          @id @default(autoincrement())
  caracteristicaId Int
  caracteristica   CaracteristicaReclamoCliente @relation(fields: [caracteristicaId], references: [id])
  valor            String
  orden            Int                          @default(0)
  @@index([caracteristicaId])
}

model CaracteristicaReclamoEspecie {
  id               Int                          @id @default(autoincrement())
  caracteristicaId Int
  caracteristica   CaracteristicaReclamoCliente @relation(fields: [caracteristicaId], references: [id])
  especieId        Int
  especie          Especie                      @relation(fields: [especieId], references: [id])
  @@unique([caracteristicaId, especieId])
}

model CriterioCumplimiento {                    // "Cumplimiento de reclamos" (checklist)
  // + base   (ej. "Tipo de reporte", "Fotografías", "Entregado en fecha")
  opciones CriterioCumplimientoOpcion[]
}

model CriterioCumplimientoOpcion {
  id         Int                  @id @default(autoincrement())
  criterioId Int
  criterio   CriterioCumplimiento @relation(fields: [criterioId], references: [id])
  valor      String                                  // "Objetivo", "Representativas", "Sí"...
  orden      Int                  @default(0)
  @@index([criterioId])
}

// ───── Operación ─────
model Reclamo {
  id                Int        @id @default(autoincrement())
  numero            Int           @unique
  instructivo       String                            // código de embarque (RC-D1)
  especieId         Int
  especie           Especie       @relation(fields: [especieId], references: [id])
  clienteId         Int?
  cliente           Entidad?      @relation("ReclamoCliente", fields: [clienteId], references: [id])
  fechaReclamo      DateTime?     @db.Date            // fecha del reclamo del cliente
  fechaIngreso      DateTime      @default(now())     // ingreso por Calidad
  derivadoPorId     String?                            // usuario Comercial que derivó
  ingresadoPorId    String                             // usuario Calidad
  resumenCliente    String?                            // resumen del reclamo del cliente
  textoReclamo      String?                            // texto largo de lo reclamado
  estado            EstadoReclamo @default(INGRESADO)
  procedencia       Procedencia?                       // veredicto del reclamo (R5b)

  // Valorización (Comercial)
  valorReclamado    Decimal?      @db.Decimal(14, 4)  // menor valor declarado por el cliente
  valorAutorizado   Decimal?      @db.Decimal(14, 4)  // ≤ valorReclamado (R6)
  monedaId          Int?
  moneda            Moneda?       @relation(fields: [monedaId], references: [id])
  valorizadoPorId   String?
  fechaValorizacion DateTime?

  temporadaId       Int?

  documentos        ReclamoDocumento[]
  datosCliente      ReclamoDatoCliente[]
  cumplimiento      ReclamoCumplimiento[]

  creadoEn      DateTime  @default(now())
  creadoPor     String
  actualizadoEn DateTime? @updatedAt
  actualizadoPor String?
  eliminadoEn   DateTime?
  eliminadoPor  String?

  @@index([instructivo])
  @@index([estado])
}

model ReclamoDocumento {
  id        Int                @id @default(autoincrement())
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

model ReclamoDatoCliente {
  id               Int                       @id @default(autoincrement())
  reclamoId        Int
  reclamo          Reclamo                      @relation(fields: [reclamoId], references: [id], onDelete: Cascade)
  caracteristicaId Int
  caracteristica   CaracteristicaReclamoCliente @relation(fields: [caracteristicaId], references: [id])
  valorBooleano    Boolean?                                          // BOOLEAN
  valorNumerico    Decimal?                     @db.Decimal(14, 4)   // DECIMAL/PORCENTAJE/ENTERO
  valorTexto       String?                                          // TEXTO
  opcionId         Int?                                             // LISTA
  opcion           CaracteristicaReclamoOpcion? @relation(fields: [opcionId], references: [id])
  @@index([reclamoId])
}

model ReclamoCumplimiento {
  id         Int                     @id @default(autoincrement())
  reclamoId  Int
  reclamo    Reclamo                    @relation(fields: [reclamoId], references: [id], onDelete: Cascade)
  criterioId Int
  criterio   CriterioCumplimiento       @relation(fields: [criterioId], references: [id])
  opcionId   Int
  opcion     CriterioCumplimientoOpcion @relation(fields: [opcionId], references: [id])
  @@unique([reclamoId, criterioId])
}

// ───── Provisión (monto reservado por el reclamo) ─────
enum TipoCalculoProvision { POR_UNIDAD_CAJA POR_PESO_KILO MONTO_FIJO }
enum EstadoProvision { VIGENTE REVERSADA }

model Provision {
  id               Int                  @id @default(autoincrement())
  reclamoId        Int                                            // obligatorio (PR1)
  reclamo          Reclamo              @relation(fields: [reclamoId], references: [id])
  embarqueId       Int                                            // FK a Embarque (ventas.md)
  tipoCalculo      TipoCalculoProvision
  valorUnitario    Decimal?             @db.Decimal(12, 4)        // ej. USD 1 por caja, USD 0,5 por kilo
  cantidadAfectada Decimal?             @db.Decimal(12, 2)        // cajas o kilos reclamados (PR2)
  montoFijo        Decimal?             @db.Decimal(12, 2)        // si tipoCalculo = MONTO_FIJO
  montoCalculado   Decimal              @db.Decimal(12, 2)        // resultado final, siempre poblado
  moneda           String
  estado           EstadoProvision      @default(VIGENTE)
  fechaCreacion    DateTime             @default(now())
  creadoPorId      String
  fechaReversa     DateTime?
  reversadoPorId   String?

  @@index([reclamoId])
  @@index([embarqueId])
}
```

> Back-relations a agregar: `Especie` → características de reclamo + reclamos; `Entidad` → reclamos (cliente); `Moneda` → reclamos.

---

## 5. Reglas de negocio / invariantes

- **R1 — Asociación a embarque.** Todo reclamo referencia un `instructivo` (texto). Cuando exista el módulo Embarque, pasa a FK.
- **R2 — Documentación.** Se aceptan archivos de cualquier tipo (imagen, PDF, correo, otro).
- **R3 — Datos del cliente por especie.** Las características capturables son las asociadas a la especie del reclamo; el valor se guarda según `tipoDato` (`valorBooleano`/`valorNumerico`/`valorTexto`/`opcionId`).
- **R4 — Checklist.** Una opción por criterio de cumplimiento (`@@unique([reclamoId, criterioId])`).
- **R5 — Flujo.** `INGRESADO` (Calidad abre) → `VALORIZADO` (Comercial valoriza) → `CERRADO`. La derivación inicial viene de Comercial. **R5b:** antes de cerrar debe registrarse la `procedencia` (PROCEDENTE/IMPROCEDENTE/PARCIAL).
- **R6 — Valorización.** `valorAutorizado ≤ valorReclamado` → 422 si no. Solo usuarios con el **permiso específico de valorización** (ítem de menú dedicado, E2) — no basta el acceso general a reclamos. Pasar a `VALORIZADO` exige ambos valores.
- **R9 — Bloqueo por cierre.** Un reclamo `CERRADO` no admite modificaciones (cabecera, documentos, datos, valorización). Reabrir o modificar un reclamo cerrado requiere un **permiso específico**.
- **R10 — Permisos diferenciados (E2).** El ingreso (Calidad), la valorización (Comercial) y el cierre/reapertura son ítems de menú/permiso **separados**.
- **R7 — Listas con opciones.** Característica `LISTA` y todo `CriterioCumplimiento` deben tener ≥1 opción.
- **R8 — Auditoría + softdelete** en mantenedores y reclamo.

### Provisión

- **PR1 — Reclamo obligatorio.** No existen provisiones sin `reclamoId` → 422.
- **PR2 — Cantidad acotada.** `cantidadAfectada` (cajas o kilos) no puede superar la cantidad total del embarque reclamado → 422. Es habitual que el reclamo cubra solo una parte del embarque.
- **PR3 — Reversa, nunca borrado.** Cualquier usuario con permiso puede reversar (no debe ser quien la creó). La reversa fija `estado = REVERSADA` y registra `fechaReversa`/`reversadoPorId`; el registro **nunca se elimina** y queda visible en el historial.
- **PR4 — Independencia de la NC.** Una provisión reversada puede o no derivar en una Nota de Crédito; son dos pasos independientes que el usuario concilia.
- **PR5 — Efecto en cartera.** Mientras `estado = VIGENTE`, el `montoCalculado` reduce el **saldo pendiente visible** del cliente/embarque en Cobranza. Es informativo/visual: **no** altera los montos de las `Cuota` de `cobranza.md`.
- **PR6 — Alerta al emitir NC.** Al emitir una NC en `cobranza.md` sobre la factura del mismo embarque, si existe una provisión `VIGENTE` para ese reclamo, el sistema **alerta (no bloquea)** y sugiere el `montoCalculado` como monto inicial de la NC (editable).
- **PR7 — Alimenta el Score.** El monto de las provisiones `VIGENTE`, junto con los claims cerrados, alimenta el parámetro "Valor Reclamado" del motor de Score (`cobranza-score-riesgo.md` §5.3).

---

## 6. Contratos API (Fastify · módulo `/api/calidad` · recurso `/reclamos`)

**Configuración**
| Método | Ruta | Notas |
|---|---|---|
| CRUD | `/caracteristicas-reclamo` (+ `/:id/opciones`) | LISTA exige opciones (R7). |
| PUT | `/caracteristicas-reclamo/:id/especies` | Asociación por especie (R3). |
| CRUD | `/criterios-cumplimiento` (+ `/:id/opciones`) | Checklist (R7). |

**Reclamos**
| Método | Ruta | Notas |
|---|---|---|
| GET/POST/PATCH | `/reclamos[/:id]` | Ingreso por Calidad. Filtros por instructivo/estado/cliente. |
| POST | `/reclamos/:id/documentos` | Subir documentación (cualquier tipo). |
| PUT | `/reclamos/:id/datos-cliente` | Datos del cliente (por especie, R3). |
| PUT | `/reclamos/:id/cumplimiento` | Checklist de cumplimiento (R4). |
| POST | `/reclamos/:id/valorizar` | `{ valorReclamado, valorAutorizado, monedaId }` → VALORIZADO (R6, permiso de valorización). |
| POST | `/reclamos/:id/cerrar` | `{ procedencia }` → CERRADO (R5b/R9, permiso de cierre). Bloquea ediciones posteriores. |
| POST | `/reclamos/:id/reabrir` | Reabre un reclamo cerrado (permiso específico, R9). |

**Provisiones**
| Método | Ruta | Notas |
|---|---|---|
| GET/POST | `/reclamos/:id/provisiones` | Crea/lista provisiones del reclamo. Valida PR1/PR2. |
| POST | `/provisiones/:id/reversar` | Reversa la provisión (PR3). Nunca elimina. |
| GET | `/embarques/:id/provision-vigente` | Consumido por `cobranza.md` para la alerta de PR6. |

---

## 7. Frontend (`fas-web/app/(app)/calidad/reclamos/`)

- **Configuración:** mantenedor de características de reclamo (datos del cliente) con tipo de dato/unidad/opciones y asociación por especie; mantenedor de criterios de cumplimiento con sus opciones.
- **Reclamo — Paso 1 (Calidad):** cabecera (instructivo, especie, cliente, fechas, derivado por), **adjuntos** (drag&drop de imágenes/PDF/correos), **resumen del cliente**, **datos del cliente** (campos dinámicos por especie), **texto largo** de lo reclamado, y **checklist de cumplimiento** (una opción por criterio).
- **Reclamo — Paso 2 (Comercial):** valorización (valor reclamado = menor declarado por el cliente, valor autorizado ≤ reclamado, moneda). Disponible según acceso de perfil.
- Responsivo (E5). El paso de valorización se habilita solo a usuarios con el acceso correspondiente.

---

## 8. Criterios de aceptación (Given / When / Then)

- **CA1 (R1):** Crear un reclamo sin instructivo → 422; con `001A-1` → OK.
- **CA2 (R2):** Adjuntar una imagen, un PDF y un correo al mismo reclamo → 3 documentos.
- **CA3 (R3):** En un reclamo de Uva, solo aparecen las características de reclamo asociadas a Uva; "Termógrafo" (BOOLEAN) se guarda en `valorBooleano`, "Clasificación" (LISTA) en `opcionId`, "Brix" (DECIMAL) en `valorNumerico`.
- **CA4 (R4):** Seleccionar dos opciones para el mismo criterio → 422.
- **CA5 (R7):** Característica `LISTA` o criterio sin opciones → 422.
- **CA6 (R6):** Valorizar con `valorAutorizado > valorReclamado` → 422; con `≤` → estado `VALORIZADO`.
- **CA7 (R6 permiso):** Un usuario sin el permiso específico de valorización no puede valorizar → 403 (aunque tenga acceso a reclamos).
- **CA8 (R5):** Flujo INGRESADO → VALORIZADO → CERRADO respeta el orden.
- **CA9 (R5b):** Cerrar sin `procedencia` → 422; con `PARCIAL`/`PROCEDENTE`/`IMPROCEDENTE` → CERRADO.
- **CA10 (R9):** Editar/valorizar un reclamo CERRADO → 403; solo con permiso de reapertura se puede modificar.

---

## 9. Plan de implementación (orden para Claude Code)

1. Enums + mantenedores (características de reclamo + opciones + asociación especie; criterios de cumplimiento + opciones) + migración.
2. Reclamo (CRUD ingreso) + documentos (cualquier tipo) + datos cliente (R3) + checklist (R4).
3. Valorización (R6) + cierre (R5).
4. Tests CA1–CA10.
5. Frontend: mantenedores + reclamo en dos pasos (Calidad / Comercial).

---

## 10. Definition of Done

- [ ] Mantenedores (características de reclamo por especie + criterios de cumplimiento) operativos.
- [ ] Reclamo con documentación multi-tipo, datos del cliente por especie, texto y checklist.
- [ ] Valorización (≤ reclamado) restringida a un **permiso separado**; veredicto `procedencia` requerido al cerrar; `CERRADO` bloquea edición (reapertura con permiso).
- [ ] Tests CA1–CA10 en verde.
- [ ] Decisiones de §3 confirmadas con los key users.
- [ ] Schema incorporado al `CLAUDE.md` global.
