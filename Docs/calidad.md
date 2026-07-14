# Módulo: Calidad — Control de Calidad de Fruta en Origen (Etapa A) — FAS

> **Spec de módulo para desarrollo autónomo con Claude Code.** Extiende `CLAUDE.md` y `00-entorno-general.md`.
>
> | | |
> |---|---|
> | **Etapa Calidad** | A — Control de calidad en origen (la otra etapa de Calidad se especifica aparte) |
> | **Key user** | Isella (Calidad) + Inspectores |
> | **Sección de menú** | Calidad |
> | **Plataformas** | **WEB** (configuración + solicitudes + inspección + informes) · **Móvil/PWA** (solo registro de inspecciones) |
> | **Backend** | `fas-api` · prefijo `/api/calidad` |
> | **Frontend** | `fas-web` · `app/(app)/calidad/` (+ vistas móviles PWA) |
> | **Depende de** | Mantenedores (`Especie`, `Variedad`, `Categoria`, `Calibre`, `Mercado`, `Parametro`), Entidades (Cliente/Productor), Productores (`Predio`), Materiales (`Articulo` EMBALAJE), Usuarios y Perfiles, BullMQ (PDF/correo) |
> | **Estado** | Listo para desarrollo (Etapa 1) |

---

## 0. Contexto para Claude Code

Registra los **controles de calidad de fruta en origen**. **Cada especie tiene su propia norma**, por lo que defectos y características de madurez se **asocian por especie** y toda la captura se segmenta por la especie de la solicitud. La **configuración** vive solo en WEB; la **app móvil (PWA)** solo sirve para que el inspector **registre la inspección** (offline-first).

---

## 1. Objetivo

Permitir: (a) configurar la norma de calidad por especie (defectos y madurez); (b) emitir solicitudes de inspección; (c) que el inspector registre la inspección por caja (defectos, madurez, fotos, resultado); y (d) generar un informe PDF enviable por correo, todo asociado a la solicitud.

---

## 2. Alcance

**Construye:**
1. Mantenedores (WEB): `Tipo de defecto → Grupo de defecto → Defecto`; `Característica de madurez`; y su **asociación por especie**.
2. Solicitudes de inspección (WEB).
3. Registro de inspección por caja (WEB + Móvil/PWA offline).
4. Fotos + resultado (Aprobado/Objetado/Rechazado).
5. Informe PDF + envío por correo.

**NO construye (fuera de alcance):**
- La otra etapa de Calidad (validación de lotes recepcionados / reclamos) — spec aparte.
- App **nativa** (se hace PWA, ver §3).
- Umbrales automáticos de aprobación (resultado es manual en esta etapa).

---

## 3. Decisiones cerradas (defaults)

| # | Decisión | Default / Respuesta |
|---|---|---|
| CA-D1 | Jerarquía de defectos y características de madurez | Definidas **dentro de `calidad.md`** (usando la base de maestro general). |
| CA-D2 | Tipos de dato de madurez | `DECIMAL`, `PORCENTAJE`, `ENTERO`, `TEXTO`, `LISTA`. |
| CA-D3 | Unidad de madurez | **Texto** específico de Calidad (ej. "Libras/CM2", "Grados"); **no** sale del maestro Unidad de medida. ✅ confirmado |
| CA-D4 | Presión máx/mín/promedio | **3 características separadas**; el inspector calcula afuera e ingresa cada valor. ✅ confirmado |
| CA-D5 | Valor de defecto por caja | Cantidad de **frutos afectados** (entero). |
| CA-D6 | Predio/embalaje/categoría/calibre | Se eligen **por caja** (pueden variar entre cajas). |
| CA-D7 | Especie de la inspección | Única (la de la solicitud); filtra defectos/madurez. |
| CA-D8 | Inspector | `Usuario` con acceso de Inspector, asignado en la solicitud. |
| CA-D9 | Resultado | Manual (criterio del inspector): Aprobado / Objetado / Rechazado. |
| CA-D10 | Informe | PDF generado al completar (job BullMQ); **envío por correo manual** a destinatarios elegidos (acción explícita). |
| CA-D11 | Móvil | **PWA** (mismo `fas-web`), **offline-first** con cola de sincronización; solo registro de inspecciones. |
| CA-D12 | Fotos | Asociadas a la inspección, con etiqueta opcional de caja. |
| CA-D13 | Season-scope | La solicitud lleva `temporadaId` (E3). |

**Campos de la solicitud derivados del documento físico (N° 107) — resueltos:**
| Campo | Resolución |
|---|---|
| Mercado_País (multi) | Multiselect a `Mercado` (maestro general). ✅ |
| Planta / Frigorífico | `Entidad` tipo **`PLANTA`** (nuevo tipo de entidad). ✅ |
| Tipo de inspección | Enum `TipoInspeccion`: `PROCESO`, `PRODUCTO_TERMINADO`. ✅ |
| Calificación (B1) | Texto libre. ✅ |
| Embalaje solicitado | Multiselect de `Articulo` tipo `EMBALAJE` (puede ser más de uno). ✅ |

---

## 4. Modelo de datos (Prisma)

```prisma
// ───── Mantenedores (solo WEB) ─────
enum TipoDatoMadurez { DECIMAL PORCENTAJE ENTERO TEXTO LISTA }

model TipoDefecto {
  // + base (§4.1 mantenedores-generales.md)
  grupos GrupoDefecto[]
}

model GrupoDefecto {
  // + base
  tipoDefectoId Int
  tipoDefecto   TipoDefecto @relation(fields: [tipoDefectoId], references: [id])
  defectos      Defecto[]
}

model Defecto {
  // + base
  grupoDefectoId Int
  grupoDefecto   GrupoDefecto     @relation(fields: [grupoDefectoId], references: [id])
  especies       DefectoEspecie[]
}

model DefectoEspecie {                 // asocia (o no) un defecto a una especie
  id        Int     @id @default(autoincrement())
  defectoId Int
  defecto   Defecto @relation(fields: [defectoId], references: [id])
  especieId Int
  especie   Especie @relation(fields: [especieId], references: [id])
  @@unique([defectoId, especieId])
}

model CaracteristicaMadurez {
  // + base
  tipoDato TipoDatoMadurez
  unidad   String?                                  // texto (CA-D3): "Libras/CM2", "Grados"...
  opciones CaracteristicaMadurezOpcion[]            // solo si tipoDato = LISTA
  especies CaracteristicaMadurezEspecie[]
}

model CaracteristicaMadurezOpcion {                 // valores válidos para tipoDato LISTA
  id               Int                   @id @default(autoincrement())
  caracteristicaId Int
  caracteristica   CaracteristicaMadurez @relation(fields: [caracteristicaId], references: [id])
  valor            String                                  // "Rojo", "Verde", "Ámbar"...
  orden            Int                   @default(0)
  @@index([caracteristicaId])
}

model CaracteristicaMadurezEspecie {
  id               Int                   @id @default(autoincrement())
  caracteristicaId Int
  caracteristica   CaracteristicaMadurez @relation(fields: [caracteristicaId], references: [id])
  especieId        Int
  especie          Especie               @relation(fields: [especieId], references: [id])
  @@unique([caracteristicaId, especieId])
}

// ───── Flujo de inspección (WEB + Móvil) ─────
enum EstadoSolicitud { SOLICITADA EN_PROCESO COMPLETADA ANULADA }
enum ResultadoInspeccion { APROBADO OBJETADO RECHAZADO }
enum TipoInspeccion { PROCESO PRODUCTO_TERMINADO }

model SolicitudInspeccion {
  id                 Int              @id @default(autoincrement())
  numero             Int                 @unique            // correlativo (ej. 107)
  fechaSolicitud     DateTime            @db.Date
  emitidaPorId       String                                 // Usuario
  inspectorId        String?                                // Usuario (Inspector)
  clienteId          Int?                                   // Entidad CLIENTE (opcional)
  entidadProductorId Int                                    // Entidad PRODUCTOR
  especieId          Int
  variedadId         Int?
  plantaFrigorificoId Int?                                  // Entidad tipo PLANTA
  plantaFrigorifico  Entidad?            @relation("SolicitudPlanta", fields: [plantaFrigorificoId], references: [id])
  tipoInspeccion     TipoInspeccion?                        // PROCESO / PRODUCTO_TERMINADO
  fechaDespacho      DateTime?           @db.Date
  todosCalibres      Boolean             @default(false)
  todasCategorias    Boolean             @default(false)
  calificacion       String?                                // texto (ej. "B1")
  cantidadPallet     Int?
  contactoNombre     String?
  contactoTelefono   String?
  contactoEmpresa    String?
  observaciones      String?
  estado             EstadoSolicitud     @default(SOLICITADA)
  resultado          ResultadoInspeccion?                   // al cerrar
  fechaInspeccion    DateTime?
  temporadaId        Int?

  mercados           SolicitudMercado[]
  calibres           SolicitudCalibre[]
  categorias         SolicitudCategoria[]
  embalajes          SolicitudEmbalaje[]
  cajas              InspeccionCaja[]
  fotos              InspeccionFoto[]

  creadoEn           DateTime            @default(now())
  creadoPor          String
  actualizadoEn      DateTime?           @updatedAt
  actualizadoPor     String?

  @@index([entidadProductorId])
  @@index([estado])
}

model SolicitudMercado {
  solicitudId Int
  solicitud   SolicitudInspeccion @relation(fields: [solicitudId], references: [id], onDelete: Cascade)
  mercadoId   Int
  mercado     Mercado             @relation(fields: [mercadoId], references: [id])
  @@id([solicitudId, mercadoId])
}
model SolicitudCalibre {
  solicitudId Int
  solicitud   SolicitudInspeccion @relation(fields: [solicitudId], references: [id], onDelete: Cascade)
  calibreId   Int
  calibre     Calibre             @relation(fields: [calibreId], references: [id])
  @@id([solicitudId, calibreId])
}
model SolicitudCategoria {
  solicitudId Int
  solicitud   SolicitudInspeccion @relation(fields: [solicitudId], references: [id], onDelete: Cascade)
  categoriaId Int
  categoria   Categoria           @relation(fields: [categoriaId], references: [id])
  @@id([solicitudId, categoriaId])
}
model SolicitudEmbalaje {                  // embalajes solicitados (Articulo tipo EMBALAJE), 1..N
  solicitudId Int
  solicitud   SolicitudInspeccion @relation(fields: [solicitudId], references: [id], onDelete: Cascade)
  embalajeId  Int
  embalaje    Articulo            @relation("SolicitudEmbalajes", fields: [embalajeId], references: [id])
  @@id([solicitudId, embalajeId])
}

model InspeccionCaja {
  id             Int              @id @default(autoincrement())
  solicitudId    Int
  solicitud      SolicitudInspeccion @relation(fields: [solicitudId], references: [id], onDelete: Cascade)
  numeroCaja     Int                                        // 1..N (cantidad definida en terreno)
  predioId       Int                                        // Predio (CSG) del productor (R7)
  predio         Predio              @relation(fields: [predioId], references: [id])
  embalajeId     Int?                                       // Articulo tipo EMBALAJE
  embalaje       Articulo?           @relation(fields: [embalajeId], references: [id])
  categoriaId    Int?
  categoria      Categoria?          @relation(fields: [categoriaId], references: [id])
  calibreId      Int?
  calibre        Calibre?            @relation(fields: [calibreId], references: [id])
  cantidadFrutos Int

  defectos       InspeccionCajaDefecto[]
  madurez        InspeccionCajaMadurez[]

  @@unique([solicitudId, numeroCaja])
  @@index([solicitudId])
}

model InspeccionCajaDefecto {
  id        Int         @id @default(autoincrement())
  cajaId    Int
  caja      InspeccionCaja @relation(fields: [cajaId], references: [id], onDelete: Cascade)
  defectoId Int
  defecto   Defecto        @relation(fields: [defectoId], references: [id])
  cantidadFrutosAfectados Int                                // CA-D5
  @@unique([cajaId, defectoId])
  @@index([cajaId])
}

model InspeccionCajaMadurez {
  id               Int                       @id @default(autoincrement())
  cajaId           Int
  caja             InspeccionCaja               @relation(fields: [cajaId], references: [id], onDelete: Cascade)
  caracteristicaId Int
  caracteristica   CaracteristicaMadurez        @relation(fields: [caracteristicaId], references: [id])
  valorNumerico    Decimal?                     @db.Decimal(14, 4)  // DECIMAL/PORCENTAJE/ENTERO
  valorTexto       String?                                          // TEXTO
  opcionId         Int?                                             // LISTA
  opcion           CaracteristicaMadurezOpcion? @relation(fields: [opcionId], references: [id])
  @@index([cajaId])
}

model InspeccionFoto {
  id          Int              @id @default(autoincrement())
  solicitudId Int
  solicitud   SolicitudInspeccion @relation(fields: [solicitudId], references: [id], onDelete: Cascade)
  ruta        String
  numeroCaja  Int?                                          // etiqueta opcional (CA-D12)
  creadoEn    DateTime            @default(now())
  @@index([solicitudId])
}
```

> Back-relations a agregar en sus maestros: `Especie` → `defectos`/`caracteristicasMadurez`; `Mercado/Calibre/Categoria` → relaciones de solicitud; `Predio` → cajas; `Articulo` → cajas (embalaje de caja) y `SolicitudEmbalaje` (embalajes solicitados); `Entidad` → solicitudes (cliente / productor / planta).

---

## 5. Reglas de negocio / invariantes

- **R1 — Segmentación por especie.** Para una solicitud de especie E, los defectos y características capturables son solo los asociados a E (`DefectoEspecie`/`CaracteristicaMadurezEspecie`).
- **R2 — Jerarquía.** Grupo pertenece a un Tipo; Defecto pertenece a un Grupo.
- **R3 — Característica LISTA.** Si `tipoDato = LISTA` debe tener ≥1 opción; otros tipos no llevan opciones. `unidad` aplica principalmente a `DECIMAL`.
- **R4 — Captura por caja.** Cantidad de cajas definida en terreno; `numeroCaja` único por solicitud. Cada caja exige `predio` y `cantidadFrutos` (embalaje/categoría/calibre según flujo).
- **R5 — Defectos opcionales.** Solo se registran los defectos encontrados; el valor es la cantidad de frutos afectados.
- **R6 — Madurez por tipo de dato.** El valor se guarda en `valorNumerico` (DECIMAL/PORCENTAJE/ENTERO), `valorTexto` (TEXTO) u `opcionId` (LISTA), según `tipoDato`.
- **R7 — Predio del productor.** El `predio` de cada caja debe pertenecer al productor de la solicitud.
- **R8 — Estados.** `SOLICITADA → EN_PROCESO → COMPLETADA` (o `ANULADA`). Pasar a `COMPLETADA` exige `resultado` (Aprobado/Objetado/Rechazado).
- **R9 — Móvil.** La PWA solo registra inspecciones (sin configuración), offline-first; al sincronizar, el servidor valida (R1–R8). Conflictos: última escritura del inspector dueño de la solicitud.
- **R10 — Informe.** Al completar se genera el PDF (job BullMQ). El **envío por correo** es una acción explícita del usuario a destinatarios elegidos.
- **R11 — Inspector.** Solo un usuario con acceso de Inspector puede registrar; la solicitud define el inspector asignado.

---

## 6. Contratos API (Fastify, prefijo `/api/calidad`)

**Configuración (WEB)**
| Método | Ruta | Notas |
|---|---|---|
| CRUD | `/tipos-defecto`, `/grupos-defecto`, `/defectos` | Jerarquía (R2). |
| CRUD | `/caracteristicas-madurez` (+ `/:id/opciones`) | LISTA exige opciones (R3). |
| PUT | `/defectos/:id/especies` · `/caracteristicas-madurez/:id/especies` | Asociación por especie (R1). |
| GET | `/especies/:id/norma` | Defectos + características de la especie (para descargar al móvil). |

**Solicitudes e inspección**
| Método | Ruta | Notas |
|---|---|---|
| GET/POST/PATCH | `/solicitudes[/:id]` | Cabecera (campos del documento). Asignar inspector. |
| GET | `/solicitudes?inspectorId=&estado=` | Listado (para el inspector). |
| CRUD | `/solicitudes/:id/cajas[/:cajaId]` | Cajas (R4/R7). |
| PUT | `/solicitudes/:id/cajas/:cajaId/defectos` | Defectos encontrados (R5). |
| PUT | `/solicitudes/:id/cajas/:cajaId/madurez` | Valores de madurez (R6). |
| POST | `/solicitudes/:id/fotos` | Subir foto(s) (etiqueta de caja opcional). |
| POST | `/solicitudes/:id/sync` | **Sincronización móvil**: sube en bloque una inspección hecha offline. |
| POST | `/solicitudes/:id/cerrar` | `{ resultado }` → COMPLETADA (R8). |
| GET | `/solicitudes/:id/informe.pdf` | Genera/descarga el PDF. |
| POST | `/solicitudes/:id/informe/enviar` | Envía el PDF por correo (acción explícita). |

---

## 7. Frontend WEB (`fas-web/app/(app)/calidad/`)

- **Configuración:** mantenedores de defectos (Tipo/Grupo/Defecto), características de madurez (con tipo de dato, unidad y, para LISTA, sus opciones) y **matriz de asociación por especie**.
- **Solicitudes:** formulario que refleja el documento N° 107 (mercados multiselect, cliente, especie/variedad, productor, planta/frigorífico, tipo de inspección, despacho, calibres/categorías con "todos/todas", calificación, embalaje, cantidad de pallet, contacto). Asignación de inspector.
- **Inspección (también web):** alta de cajas con su predio/embalaje/categoría/calibre/frutos, defectos encontrados, madurez, fotos y resultado.
- **Informe:** vista del PDF + botón de envío por correo (destinatarios). Responsivo (E5).

## 7b. Móvil / PWA (offline-first)

- Mismo `fas-web` como **PWA instalable**; vistas optimizadas para móvil del inspector.
- **Offline:** al tomar una solicitud, se descarga su norma (`/especies/:id/norma`) y datos necesarios a almacenamiento local (IndexedDB). El registro de cajas/defectos/madurez/fotos funciona **sin señal**.
- **Sincronización:** cola local que envía a `/solicitudes/:id/sync` al recuperar conexión; el servidor valida y persiste. Fotos se guardan localmente y se suben en la sincronización.
- La PWA **no** expone configuración.

---

## 8. Criterios de aceptación (Given / When / Then)

- **CA1 (R1):** En una solicitud de Manzana, solo aparecen los defectos/características asociados a Manzana.
- **CA2 (R2):** Crear un Defecto sin Grupo, o un Grupo sin Tipo → 422.
- **CA3 (R3):** Característica `LISTA` sin opciones → 422; característica `DECIMAL` acepta `unidad` "Libras/CM2".
- **CA4 (CA-D4):** Presión máxima, mínima y promedio existen como 3 características independientes y se capturan por separado.
- **CA5 (R4):** Dos cajas con el mismo `numeroCaja` en una solicitud → 422.
- **CA6 (R5):** De 20 defectos de la especie, registrar solo 3 → se persisten 3 filas; los demás quedan sin registro.
- **CA7 (R6):** Una característica `LISTA` se guarda con `opcionId`; una `DECIMAL` con `valorNumerico`; una `TEXTO` con `valorTexto`.
- **CA8 (R7):** Caja con un predio que no es del productor de la solicitud → 422.
- **CA9 (R8):** Cerrar una solicitud sin `resultado` → 422; con resultado → estado COMPLETADA.
- **CA10 (R9):** Inspección registrada offline se sincroniza vía `/sync` y queda idéntica a una registrada online.
- **CA11 (R10):** Al completar, se puede generar el PDF; el envío por correo es una acción aparte.

---

## 9. Plan de implementación (orden para Claude Code)

1. Enums + mantenedores (defectos jerárquicos, características de madurez + opciones) + asociaciones por especie + migración.
2. Endpoint `/especies/:id/norma` (consumible por web y móvil).
3. Solicitudes (CRUD + asignación de inspector + multiselects).
4. Inspección: cajas + defectos + madurez + fotos (R4–R7).
5. Cierre con resultado (R8) + generación de PDF (job BullMQ).
6. Envío de informe por correo (acción explícita).
7. PWA: service worker, almacenamiento offline (IndexedDB), cola de sincronización, endpoint `/sync`.
8. Tests CA1–CA11.
9. Frontend web (config + solicitud + inspección + informe) y vistas móviles.

---

## 10. Definition of Done

- [ ] Mantenedores y asociaciones por especie migrados y operativos (WEB).
- [ ] Solicitud refleja el documento físico; inspector asignable.
- [ ] Inspección por caja con defectos (solo encontrados), madurez por tipo de dato y fotos.
- [ ] Cierre con resultado + PDF generado; envío por correo como acción explícita.
- [ ] PWA offline-first registrando inspecciones y sincronizando vía `/sync`.
- [ ] Tests CA1–CA11 en verde.
- [ ] Decisiones de §3 confirmadas con los key users.
- [ ] Schema incorporado al `CLAUDE.md` global.
