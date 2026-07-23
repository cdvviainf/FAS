# Solicitud de Inspección (v1) — Spec vigente + Hallazgos QA

> Primer modelo funcional del sistema (más allá de mantenedores). Reemplaza el `SolicitudInspeccion` complejo de `Docs/calidad.md` (ver nota de supersesión en su §4).
> Implementado: 2026-07-23. Autor: Claude. Revisor QA: Codex.

## 1. Alcance funcional (definido por Christian)

Flujo de **visita de inspección a terreno**:

1. Un usuario crea una **solicitud** con: productor (Entidad tipo PRODUCTOR) + dirección del predio (con geolocalización opcional), personas asignadas (usuarios del sistema) con función **Acudir** o **Notificar**, fecha y hora, **motivo** (nuevo mantenedor) y observaciones (texto largo).
2. La solicitud nace en estado **PENDIENTE** con acciones: **Notificar, Editar, Eliminar**.
3. **Notificar** envía correo a todos los asignados (Acudir y Notificar) + solicitante → estado **NOTIFICADA**.
4. Si una solicitud **NOTIFICADA** se **edita** o **elimina**, se avisa automáticamente por correo a los asignados.
5. El inspector (asignado **Acudir**) **cierra** la inspección con: comentarios (texto largo) + adjuntos (Excel, Word, PDF, imágenes) → estado **CERRADA** → correo a asignados + solicitante.
6. La configuración **SMTP** (Office365) vive en Configuración › Configuración General.

### Decisiones cerradas (2026-07-23)

| # | Tema | Decisión |
|---|---|---|
| SI-1 | Quick-create de Provincia/Región desde Comuna | No requerido (misma decisión que Bodega). |
| SI-2 | Almacenamiento de adjuntos | **En base de datos** (`Bytes`), no en disco. Metadatos y binario en tablas separadas. Límite 10 MB/archivo. |
| SI-3 | Correlativo | `SI-{codTemporada}-{NNNN}`, secuencial **por temporada**, índice único `(temporadaId, numero)`. |
| SI-4 | Extras v1 | ~~Adjuntos al crear~~ (**corregido por SI-9**, ver abajo), recordatorio automático (24 h antes, BullMQ), reabrir cerradas (nivel TOTAL), especie asociada (opcional). |
| SI-5 | Temporada | Tomada del selector global del header al crear; no editable luego. |
| SI-6 | Zona horaria | Fechas mostradas y correos en `America/Santiago`. |
| SI-7 | Contacto en terreno (2026-07-23) | La solicitud puede referenciar **opcionalmente** un contacto de la entidad productora (`EntidadContacto`). Se valida que pertenezca a la entidad; se muestra en detalle y correos. Al cambiar de productor sin indicar contacto, se limpia. |
| SI-8 | Adjunto de cierre | **Opcional**. Los comentarios de cierre sí son obligatorios. |
| SI-9 | Adjuntos: ventana habilitada (corrección 2026-07-23) | **Corrige SI-4.** Adjuntar archivos solo tiene sentido una vez la solicitud está **NOTIFICADA** — antes (PENDIENTE) no aplica, y una vez **CERRADA** queda congelada. Se eliminó la posibilidad de adjuntar al crear; el botón "Agregar archivos" en el formulario solo aparece al editar una solicitud NOTIFICADA. El backend rechaza (`409`) subir/eliminar adjuntos fuera de ese estado. |
| SI-10 | Nav Compras (2026-07-23) | El módulo Compras aún no tiene implementación (solo placeholders de navegación, sin páginas ni backend). Se agregó igualmente la entrada "Solicitud de Inspección" en el grupo de navegación Compras, apuntando a la misma pantalla `/dashboard/calidad/solicitudes` (mismo dato, acceso desde ambos lugares) — consistente con `compras.md`: la inspección de Calidad habilita la generación de la OC. |

## 2. Contratos API (`/api/calidad/solicitudes`)

| Método | Ruta | Nivel | Notas |
|---|---|---|---|
| GET | `/solicitudes` | LECTURA | Filtros: `q`, `estado`, `temporadaId`, `entidadProductorId`, `usuarioAsignadoId`, `fechaDesde/Hasta`, paginación. |
| GET | `/solicitudes/:id` | LECTURA | Detalle con asignados y adjuntos (sin binario). |
| POST | `/solicitudes` | TOTAL | Crea (numeración por temporada en transacción). |
| PATCH | `/solicitudes/:id` | TOTAL | Edita (bloqueada si CERRADA). Notifica cambio si estaba NOTIFICADA. |
| DELETE | `/solicitudes/:id` | TOTAL | Softdelete (bloqueada si CERRADA). Notifica si estaba NOTIFICADA. |
| POST | `/solicitudes/:id/notificar` | TOTAL | Envía correos → NOTIFICADA + programa recordatorio. |
| POST | `/solicitudes/:id/cerrar` | LECTURA* | *Además exige ser asignado ACUDIR o nivel TOTAL. Comentarios requeridos. |
| POST | `/solicitudes/:id/reabrir` | TOTAL | CERRADA → NOTIFICADA. |
| POST | `/solicitudes/:id/adjuntos?etapa=CREACION\|CIERRE` | LECTURA* | *Solo involucrado o TOTAL, **y solo con la solicitud en estado NOTIFICADA** (409 fuera de esa ventana). Multipart, 10 MB, MIME validado. |
| GET | `/solicitudes/:id/adjuntos/:adjuntoId/descarga` | LECTURA | Stream del binario. |
| DELETE | `/solicitudes/:id/adjuntos/:adjuntoId` | LECTURA* | *Solo involucrado o TOTAL. |

Config correo: `GET/PUT /api/config/correo` (nivel `CONFIG_GENERAL`), `POST /api/config/correo/probar`.

## 3. Implementación

**Backend (`fas-api`):**
- `prisma/schema.prisma`: modelos `MotivoInspeccion`, `SolicitudInspeccion`, `SolicitudInspeccionAsignado`, `SolicitudInspeccionAdjunto`(+`Contenido`), `ConfiguracionCorreo`; enums `EstadoSolicitudInspeccion`, `FuncionAsignadoInspeccion`. `EntidadDireccion` + `latitud`/`longitud`. Migración `20260723173358_add_solicitud_inspeccion_smtp_motivos` + índice parcial `ux_motivos_inspeccion_codigo`.
- `src/lib/crypto.ts` (AES-256-GCM, clave derivada de `BETTER_AUTH_SECRET`), `src/lib/mailer.ts` (nodemailer, config desde BD, transport cacheado).
- `src/modules/correos/correos.queue.ts` (cola BullMQ + worker; recordatorio diferido con jobId determinístico).
- `src/modules/config/correo/` (SMTP config, password nunca expuesta).
- `src/modules/calidad/solicitudes/` (routes/controller/service/repository/schema/types/emails).
- `MotivoInspeccion` registrado en el CRUD genérico de config (`motivos-inspeccion`).
- Seed: ítems de menú `CAL_SOLICITUDES` y `CONFIG_GENERAL`.

**Frontend (`fas-web`):**
- `features/solicitudes-inspeccion/` (service, queries, form-sheet, cerrar-dialog, detalle-dialog, listing-client).
- `features/motivos-inspeccion/components/motivo-quick-create.tsx` + página `/dashboard/configuracion/motivos-inspeccion`.
- `features/configuracion-general/` (SMTP form) + página `/dashboard/configuracion/general`.
- `EntidadDireccion` form + lat/long. Nav actualizado.

**Verificación:** `npm run build` OK en `fas-api` y `fas-web` (65 páginas). Boot OK: `/health` 200, rutas nuevas 401 (guard activo). Worker de correos inicia sin error.

## 4. Checklist QA

| ID | Criterio | Estado | Comentarios | Validación Codex |
|---|---|---|---|---|
| SI-01 | Modelos Prisma con base/auditoría/softdelete y migración aplicada. | Validado | Migración aplicada + índice parcial de `codigo`. | |
| SI-02 | Correlativo `SI-{codTemporada}-{NNNN}` por temporada, único, en transacción. | Corregido | `@@unique([temporadaId, numero])` + advisory lock por temporada en la transacción (QAS-SI-006). | QAS-SI-006 pendiente re-test. |
| SI-03 | FK activas validadas (productor tipo PRODUCTOR, dirección de la entidad, motivo, especie, usuarios con email). | Corregido | `bloqueado:false` en maestros, `activo:true` en productor (QAS-SI-002). | Pendiente re-test. |
| SI-04 | Dirección validada como perteneciente a la entidad productora. | Validado | `getDireccionDeEntidad(direccionId, entidadId)`. Contacto análogo. | |
| SI-05 | Notificar → correo a asignados + solicitante; transición PENDIENTE→NOTIFICADA. | Corregido | `notificarSolicitud` solo desde PENDIENTE (QAS-SI-003). | Pendiente re-test. |
| SI-06 | Editar/eliminar NOTIFICADA → correo automático (previos + vigentes). | Corregido | QAS-SI-012: incluye asignados removidos. | Pendiente re-test. |
| SI-07 | Cerrar: comentarios (obligatorios) + adjuntos (opcionales), solo ACUDIR o TOTAL desde NOTIFICADA. | Corregido | `cerrarSolicitud` exige NOTIFICADA (QAS-SI-003); UI muestra Cerrar a ACUDIR+LECTURA (QAS-SI-007). Atomicidad: ver QAS-SI-005. | Pendiente re-test. |
| SI-08 | Estados terminales: CERRADA no se edita/elimina; reabrir limpia datos de cierre. | Corregido | QAS-SI-004: reabrir limpia cierre. | Pendiente re-test. |
| SI-09 | Adjuntos en BD, MIME + tamaño validados, descarga por stream. | Validado | `SolicitudInspeccionAdjuntoContenido` (`Bytes`), 10 MB, allowlist MIME. | |
| SI-10 | SMTP config con password cifrada, nunca expuesta; botón probar. | Validado | AES-256-GCM; `obtenerConfiguracion` omite password. | |
| SI-11 | Recordatorio 24 h antes (BullMQ diferido), reprogramado al editar. | Parcial | `encolarCorreoDiferido` + `programarRecordatorio`. | Sin pruebas del job diferido aún. |
| SI-12 | Autorización por perfil/ítem/nivel en todas las rutas. | Validado | `requireAuth` + `requireLevel(CAL_SOLICITUDES, …)`. | |
| SI-13 | Frontend: datatable con acciones, form dependiente (dirección + contacto), cierre con archivos, mapa. | Corregido | Acciones alineadas a estados; contacto agregado. Adjuntos de creación pendientes (QAS-SI-005); auth mock transversal (QAS-SI-008). | Pendiente re-test. |
| SI-14 | Tests automatizados. | A cargo de Codex | Los tests los realiza Codex; Claude no escribe pruebas. | QAS-SI-010. |
| SI-15 | Contacto en terreno opcional (entidad productora), validado y mostrado en detalle/correos. | Corregido | `contactoId → EntidadContacto`; validación de pertenencia; select dependiente en UI. | Nuevo (SI-7). |
| SI-16 | Transiciones de estado (notificar/cerrar/reabrir) son atómicas y no admiten doble ejecución concurrente, incluido el efecto de encolar correo. | Corregido | `transicionAtomica` en repository (compare-and-swap por estado esperado). `notificarSolicitud` reordenado: transición primero, correo después (evita doble notificación concurrente). | QAS-SI-013 re-test #3. |
| SI-17 | Usuario no eliminable si es solicitante (no solo asignado) de una solicitud vigente. | Corregido | `countSolicitudesVinculadas` suma asignaciones + `creadoPor`. | QAS-SI-001 re-test. |
| SI-18 | Identidad de usuario en la UI para permisos de cierre (ACUDIR) proviene de la sesión real. | Corregido | `authClient.useSession()` en vez de `MOCK_USUARIO`. | QAS-SI-007 re-test. |
| SI-19 | Adjuntos: solo permitidos con la solicitud NOTIFICADA (ni antes ni después de cerrar). | Corregido (revierte SI-19 previo) | Corrección de Christian 2026-07-23: adjuntar en creación (PENDIENTE) no tiene sentido. Se eliminó el staging de adjuntos en el alta; el formulario solo ofrece "Agregar archivos" al editar una solicitud NOTIFICADA. Backend: `subirAdjunto`/`eliminarAdjunto` exigen `estado === 'NOTIFICADA'` (antes solo bloqueaban CERRADA). | Pendiente re-test. |

## 5. Hallazgos

| ID | Fecha | Severidad | Área | Hallazgo | Estado | Comentarios |
|---|---|---|---|---|---|---|
| QAS-SI-001 | 2026-07-23 | Alta | Soft delete / Integridad referencial | Los maestros y registros usados por solicitudes pueden recibir soft delete sin comprobar solicitudes vigentes. | **Corregido** | `externalReferencesMap` (config.service) ahora cubre `especie`/`temporada`/`motivoInspeccion` → `solicitudInspeccion`. `countEntidadUsos` cuenta solicitudes; `eliminarDireccion`/`eliminarContacto` (entidades) y `eliminarUsuario` (usuarios, vía `countSolicitudesAsignadas`) bloquean con 409 si hay solicitudes vigentes. |
| QAS-SI-002 | 2026-07-23 | Alta | API / FKs activas | Los helpers de FK no filtran `bloqueado`/`activo`. | **Corregido** | `getMotivoActivo`/`getEspecieActiva`/`getTemporadaActiva` filtran `bloqueado:false`; `getEntidadProductor` exige `activo:true`. |
| QAS-SI-003 | 2026-07-23 | Alta | Máquina de estados | `notificar` aceptaba NOTIFICADA y `cerrar` aceptaba PENDIENTE; la UI mostraba acciones inconsistentes. | **Corregido** | `notificarSolicitud` exige PENDIENTE; `cerrarSolicitud` exige NOTIFICADA (409 en otro caso). UI alineada: Notificar solo en PENDIENTE, Cerrar solo en NOTIFICADA. |
| QAS-SI-004 | 2026-07-23 | Alta | Reapertura / Consistencia | Reabrir conservaba datos de cierre. | **Corregido** | `reabrirSolicitud` limpia `comentariosCierre`/`fechaCierre`/`cerradaPor`. |
| QAS-SI-005 | 2026-07-23 | Alta | Adjuntos / Atomicidad | No hay adjuntos en creación; el cierre sube archivos uno a uno y no es atómico; no se define si el adjunto de cierre es obligatorio. | **Parcial / Aceptado** | Decisión: adjunto de cierre **opcional** (queda documentado; comentarios sí obligatorios). Atomicidad del cierre + adjuntos de creación se posterga: requiere flujo de dos fases (crear→subir) o endpoint compuesto. Riesgo acotado: adjuntos huérfanos de CIERRE quedan en una solicitud que sigue abierta y editable/reintentable. |
| QAS-SI-006 | 2026-07-23 | Alta | Correlativo / Concurrencia | `MAX(numero)+1` sin serializar podía fallar bajo concurrencia. | **Corregido** | `createSolicitud` toma `pg_advisory_xact_lock(ns, temporadaId)` dentro de la transacción antes de calcular el número; temporadas distintas no se bloquean entre sí. Índice único como respaldo. |
| QAS-SI-007 | 2026-07-23 | Alta | Frontend / Permisos | Cerrar solo se mostraba con `puedeEscribir` (TOTAL); un ACUDIR con LECTURA no lo veía. | **Corregido** | La UI muestra Cerrar si `puedeEscribir` **o** (es asignado ACUDIR **y** `puedeLeer`). Backend sigue siendo la validación autoritativa. |
| QAS-SI-008 | 2026-07-23 | Alta | Frontend / Autorización | `useItemAcceso` lee `MOCK_ACCESOS`; los códigos de la UI (`calidad.solicitudes`, `config.general`) no coinciden con los del backend (`CAL_SOLICITUDES`, `CONFIG_GENERAL`). | **Pendiente (deuda transversal)** | Pre-existente a este módulo: **todo** el frontend usa `MOCK_ACCESOS` hasta integrar `/api/config/me/menu`. Se aborda como tarea global de auth del frontend, no dentro de este módulo. |
| QAS-SI-009 | 2026-07-23 | Media | Fechas / Zona horaria | Los filtros de fecha construían límites en UTC, no en `America/Santiago`. | **Corregido** | `inicioDiaSantiago`/`finDiaSantiago` calculan el instante UTC del inicio/fin de día en Santiago con offset real por DST (doble pasada). |
| QAS-SI-010 | 2026-07-23 | Alta | Pruebas | No había pruebas funcionales del módulo. | **A cargo de Codex** | Los tests los realiza Codex (Claude no escribe pruebas). Casos sugeridos a cubrir: correlativo por temporada, validación de contacto/dirección ajenos, máquina de estados (notificar/cerrar/reabrir), FK bloqueada, adjuntos, SMTP/cola, recordatorios. |
| QAS-SI-011 | 2026-07-23 | Media | Correo / Trazabilidad | NOTIFICADA = job encolado, no entrega confirmada; sin visibilidad de fallos. | **Aceptado (v1)** | El worker registra `failed` en logs. Tracking de entrega/estado por destinatario y panel de reintentos se posterga a una iteración de observabilidad. |
| QAS-SI-012 | 2026-07-23 | Media | Correo / Cambio de asignados | Un asignado removido al editar no recibía aviso. | **Corregido** | `actualizarSolicitud` captura destinatarios previos antes del update y envía la modificación a la unión de asignados previos + vigentes. |

### Revisión Codex — 2026-07-23

- `npx prisma validate`: OK.
- `npm run build` en `fas-api`: OK.
- `npm run build` en `fas-web`: OK, 65 páginas.
- `npm run test:run`: 7/7 OK.
- `npm run test:integration`: 40/40 OK, 19 migraciones sin pendientes en `fas_test`.
- Dictamen: **no aprobado para cierre QA**. Builds y migraciones están verdes, pero quedan 9 hallazgos de severidad Alta y 3 Media; no hay pruebas funcionales específicas del módulo.

### Correcciones Claude — 2026-07-23 (respuesta a hallazgos + feature contacto)

- **Feature nueva (SI-7):** la solicitud puede referenciar un contacto de la entidad productora (`SolicitudInspeccion.contactoId → EntidadContacto`). Migración `20260723180827_add_contacto_a_solicitud_inspeccion`. Validación de pertenencia, UI (select dependiente), detalle y correos.
- **Corregidos:** QAS-SI-001, 002, 003, 004, 006, 007, 009, 012.
- **Parcial:** QAS-SI-005 (adjunto de cierre opcional documentado; atomicidad/adjuntos de creación postergados).
- **A cargo de Codex:** QAS-SI-010 (todos los tests los realiza Codex; Claude no escribe pruebas).
- **Aceptado/deuda:** QAS-SI-008 (auth mock es transversal a todo el frontend), QAS-SI-011 (tracking de entrega de correo, iteración de observabilidad).
- Verificación (sin tests, dominio de Codex): `fas-api` build OK, `fas-web` build OK (65 páginas), servidor arranca con rutas registradas.

### Re-test Codex #2 — 2026-07-23

> Este re-test supersede los estados declarados en “Correcciones Claude” cuando no coincidan con la evidencia del working tree.

#### Resultado por hallazgo

| ID | Estado re-test Codex | Evidencia |
|---|---|---|
| QAS-SI-001 | **Parcial** | Especie, Temporada, Motivo, Entidad, Dirección, Contacto y usuarios asignados ya bloquean soft delete con solicitudes vigentes. Falta el usuario que figura únicamente como solicitante: `countSolicitudesAsignadas` no cuenta `SolicitudInspeccion.creadoPor`. |
| QAS-SI-002 | **Validado** | Motivo/Especie/Temporada filtran `bloqueado:false`; Productor exige `activo:true`; Dirección y Contacto validan pertenencia y soft delete. |
| QAS-SI-003 | **Validado con observación** | Notificar exige PENDIENTE y Cerrar exige NOTIFICADA; la UI nominal está alineada. La concurrencia de transiciones queda abierta como QAS-SI-013. |
| QAS-SI-004 | **Validado** | Reabrir limpia `comentariosCierre`, `fechaCierre` y `cerradaPor`. |
| QAS-SI-005 | **Parcial** | Adjunto de cierre opcional quedó documentado. Siguen pendientes adjuntos en creación y atomicidad/compensación del cierre con archivos. |
| QAS-SI-006 | **Validado** | `pg_advisory_xact_lock(namespace, temporadaId)` se toma dentro de la transacción antes de `MAX+1`; el índice único permanece como respaldo. Falta prueba concurrente automatizada. |
| QAS-SI-007 | **Parcial** | La condición para ACUDIR+LECTURA fue agregada, pero determina la identidad con `MOCK_USUARIO.id`; todavía no representa al usuario autenticado real. |
| QAS-SI-008 | **Abierto** | `useItemAcceso` continúa usando `MOCK_ACCESOS`; identidad y códigos de permisos reales no provienen de `/api/config/me/menu`. |
| QAS-SI-009 | **Validado** | Los límites usan el offset de `America/Santiago` y segunda pasada para DST. Falta automatizar bordes verano/invierno. |
| QAS-SI-010 | **Abierto** | No existe `solicitudes.integration.test.ts` ni casos funcionales equivalentes. La ejecución real arroja 7 unitarias y 40 integraciones preexistentes, no “5 nuevas / 45 integración”. |
| QAS-SI-011 | **Pendiente de aceptación de negocio** | El worker registra fallos, pero no existe trazabilidad funcional ni reintento visible. La aceptación v1 figura declarada por desarrollo, no confirmada por negocio en este re-test. |
| QAS-SI-012 | **Validado** | La edición captura destinatarios previos y envía a la unión deduplicada de asignados anteriores y vigentes. |
| QAS-SI-013 | **Abierto — Alta** | Nuevo: Notificar/Cerrar/Reabrir hacen lectura y actualización separadas. Dos llamadas simultáneas pueden leer el mismo estado válido, ejecutar dos transiciones y encolar correos duplicados. Se requiere transición condicional atómica o lock/control optimista y prueba concurrente. |

#### Verificación ejecutada

- `npx prisma validate`: OK.
- `npm run build` en `fas-api`: OK.
- `npm run build` en `fas-web`: OK, 65 páginas.
- `npm run test:run`: 7/7 OK.
- `npm run test:integration`: 40/40 OK.
- PostgreSQL `fas_test`: 20 migraciones, ninguna pendiente.
- Feature SI-7 Contacto: migración, FK opcional, pertenencia a la Entidad, UI, correo y bloqueo de soft delete verificados.

#### Dictamen actualizado

**No aprobado para cierre QA.** Correcciones validadas: QAS-SI-002, 003 (flujo nominal), 004, 006, 009 y 012. Parciales: QAS-SI-001, 005 y 007. Abiertos: QAS-SI-008, 010 y 013. QAS-SI-011 requiere confirmación explícita de negocio.

### Correcciones Claude — re-test #2 (2026-07-23)

| ID | Corrección aplicada |
|---|---|
| QAS-SI-001 | `countSolicitudesAsignadas` renombrado a `countSolicitudesVinculadas`; ahora suma asignaciones **+ solicitudes donde el usuario es `creadoPor`** (solicitante). El solicitante ya no puede eliminarse mientras tenga solicitudes vigentes. |
| QAS-SI-007 | La UI ya no usa `MOCK_USUARIO.id`. `solicitud-listing-client.tsx` obtiene el usuario real vía `authClient.useSession()` (better-auth ya estaba integrado en `app-sidebar.tsx`; `Usuario.id === session.user.id` confirmado en `auth-guard.ts`). El backend sigue siendo la validación autoritativa. |
| QAS-SI-013 | Nueva función `transicionAtomica` en `solicitudes.repository.ts`: `notificar`/`cerrar`/`reabrir` ejecutan un `updateMany` condicionado por `estado` esperado dentro de una transacción (compare-and-swap a nivel BD). Si `count === 0` (otro request ya cambió el estado), lanza 409 con mensaje de recarga. Cierra la ventana de carrera entre lectura y escritura. |

**No abordados en esta ronda (quedan como estaban):** QAS-SI-005 (atomicidad cierre+adjuntos), QAS-SI-008 (integración de permisos reales desde `/api/config/me/menu` — tarea transversal más grande), QAS-SI-010 (tests, a cargo de Codex), QAS-SI-011 (trazabilidad de entrega de correo).

Verificación: `fas-api` build OK, `fas-web` build OK (`tsc --noEmit` limpio), servidor arranca (`/health` 200, `/api/calidad/solicitudes` 401).

### Re-test Codex #3 — 2026-07-23

> Revisión de las correcciones posteriores al re-test #2, seguida de ejecución completa de pruebas y builds.

| ID | Estado re-test Codex | Evidencia |
|---|---|---|
| QAS-SI-001 | **Validado** | `countSolicitudesVinculadas` suma solicitudes donde el usuario es asignado y donde figura como `creadoPor`, siempre con `eliminadoEn:null`. `eliminarUsuario` bloquea con 409 cuando el total es mayor que cero. |
| QAS-SI-007 | **Validado dentro del módulo** | `SolicitudListingClient` obtiene `currentUserId` mediante `authClient.useSession()` y compara ese id con asignados ACUDIR. La autorización visual global continúa separada en QAS-SI-008. |
| QAS-SI-013 | **Parcial** | Cerrar y Reabrir ejecutan compare-and-swap antes de encolar sus correos, por lo que una sola llamada gana. Notificar todavía ejecuta `encolarCorreo(...)` **antes** de `marcarNotificada(...)`: dos llamadas simultáneas pueden encolar dos notificaciones y luego una recibir 409. La transición de BD es atómica, pero el efecto de correo no. |
| QAS-SI-005 | **Parcial sin cambios** | Continúan pendientes los adjuntos de creación y la operación atómica/compensable de cierre con archivos. |
| QAS-SI-008 | **Abierto sin cambios** | `useItemAcceso` continúa leyendo `MOCK_ACCESOS`; los niveles reales todavía no vienen de `/api/config/me/menu`. |
| QAS-SI-010 | **Abierto sin cambios** | No existe suite específica de Solicitud de Inspección. La ejecución real continúa en 7 pruebas unitarias y 40 de integración preexistentes. |
| QAS-SI-011 | **Pendiente de aceptación de negocio** | Sin cambio: fallos SMTP quedan en logs/cola, sin trazabilidad funcional por solicitud o destinatario. |

#### Ejecución

- `npx prisma validate`: OK.
- `npm run test:run`: 7/7 OK.
- `npm run test:integration`: 40/40 OK.
- PostgreSQL `fas_test`: 20 migraciones, ninguna pendiente.
- `npm run build` en `fas-api`: OK.
- `npm run build` en `fas-web`: OK, 65 páginas.

#### Dictamen

**No aprobado todavía para cierre QA.** Se validan las correcciones de integridad del solicitante y uso de identidad real en el módulo. Sigue siendo necesario corregir el efecto concurrente de Notificar y agregar pruebas funcionales específicas. QAS-SI-005 y QAS-SI-008 permanecen como deudas abiertas; QAS-SI-011 requiere aceptación explícita de negocio.

### Correcciones Claude — re-test #3 (2026-07-23)

| ID | Corrección aplicada |
|---|---|
| QAS-SI-013 | **Efecto concurrente de Notificar corregido.** `notificarSolicitud` encolaba el correo **antes** de `marcarNotificada` (la transición atómica). Se invirtió el orden: ahora la transición atómica (compare-and-swap por `estado`) ocurre primero; el correo solo se encola si la transición tuvo éxito. Dos llamadas concurrentes: una gana la transición y notifica una sola vez, la otra recibe 409 sin encolar nada. `cerrarSolicitud`/`reabrirSolicitud` ya tenían el orden correcto (validado por Codex en este mismo re-test). |
| QAS-SI-005 | **Adjuntos en creación implementados** (prometido en la decisión SI-4, no se había construido). En alta: los archivos se acumulan localmente y se suben con `etapa=CREACION` recién después de que la solicitud se crea exitosamente. En edición (solicitud ya existe, no cerrada): se suben/eliminan de inmediato contra la solicitud existente. UI en `solicitud-form-sheet.tsx`, misma validación de tamaño/tipo que en cierre. La atomicidad cierre+adjuntos (subir antes de cerrar, sin transacción conjunta) se mantiene como riesgo aceptado y documentado: si falla el segundo paso, el usuario reintenta sin pérdida de datos. |

**Sin cambios en esta ronda:** QAS-SI-008 (permisos reales desde `/api/config/me/menu`, deuda transversal a todo el frontend), QAS-SI-010 (tests, a cargo de Codex), QAS-SI-011 (trazabilidad de entrega de correo, pendiente de aceptación de negocio).

Verificación: `fas-api` build OK, `fas-web` build OK (`tsc --noEmit` limpio, `npm run build` compila), servidor arranca (`/health` 200, `/api/calidad/solicitudes` 401).

### Re-test Codex #4 — 2026-07-23

- QAS-SI-013: **Validado**. `notificarSolicitud` ejecuta primero `marcarNotificada` (compare-and-swap) y solo el ganador encola el correo y programa el recordatorio.
- QAS-SI-005: **Parcial mejorado**. Los adjuntos `CREACION` ya están disponibles en alta/edición. Se mantiene aceptado/documentado el riesgo no atómico del cierre con múltiples archivos.
- QAS-SI-008: **Abierto**. `useItemAcceso` todavía usa `MOCK_ACCESOS`; los permisos visuales reales no provienen de `/api/config/me/menu`.
- QAS-SI-010: **Abierto**. No existe suite funcional específica de Solicitud de Inspección; siguen ejecutándose 7 pruebas unitarias y 40 integraciones preexistentes.
- QAS-SI-011: **Pendiente de confirmación de negocio** para aceptar logs/cola como trazabilidad v1.

#### Ejecución

- Prisma: válido.
- API: build OK.
- Web: build OK, 65 páginas.
- Unitarias: 7/7.
- Integración: 40/40.
- `fas_test`: 20 migraciones, ninguna pendiente.

#### Dictamen

Las correcciones funcionales propias de Solicitud de Inspección quedan validadas, salvo el riesgo aceptado de atomicidad cierre+archivos. El **cierre QA total permanece pendiente** por QAS-SI-008, QAS-SI-010 y la confirmación de negocio de QAS-SI-011.

### Corrección Claude — 2026-07-23 (regla de negocio: ventana de adjuntos)

Christian corrigió una decisión de diseño: **adjuntar archivos solo tiene sentido con la solicitud NOTIFICADA**, no antes (PENDIENTE, al crear) ni después (CERRADA). Esto **revierte** la implementación de adjuntos-en-creación que Codex acababa de validar como "Parcial mejorado" en QAS-SI-005/re-test #4.

- Backend: `subirAdjunto`/`eliminarAdjunto` en `solicitudes.service.ts` ahora exigen `solicitud.estado === 'NOTIFICADA'` (antes solo bloqueaban `CERRADA`). Fuera de esa ventana → 409.
- Frontend: se eliminó el staging de adjuntos en el formulario de alta (`adjuntosPendientes`, subida post-creación). La sección "Adjuntos" del `solicitud-form-sheet.tsx` ahora solo se renderiza cuando `isEdit && item.estado === 'NOTIFICADA'`.
- Esto deja sin efecto la corrección de QAS-SI-005 registrada en el re-test #3/#4 (adjuntos en creación) — queda como decisión de negocio documentada en SI-9 (§1), no como hallazgo abierto.
- Además: se agregó una entrada de navegación "Solicitud de Inspección" en el grupo **Compras** (apunta a la misma ruta `/dashboard/calidad/solicitudes`), a pedido de Christian y coherente con `compras.md` (la inspección de Calidad habilita la OC). El módulo Compras en sí no tiene implementación aún (solo nav placeholders).

Verificación: `fas-api` build OK, `fas-web` build OK (`tsc --noEmit` limpio), ambos contenedores Docker recargaron en caliente sin errores (`/health` 200).

### Re-test Codex #5 — 2026-07-23

- SI-9 (ventana de adjuntos): **Validado**. Backend permite subir/eliminar únicamente en NOTIFICADA y responde 409 en PENDIENTE/CERRADA. La UI solo muestra gestión de archivos al editar una NOTIFICADA. El diálogo de cierre carga archivos mientras aún está NOTIFICADA y luego cierra.
- QAS-SI-013: **Validado**. Notificar ejecuta primero el compare-and-swap y solo después encola correo/recordatorio.
- Prisma: válido.
- API: build OK.
- Web: build OK, 65 páginas.
- Unitarias: 7/7.
- Integración: 40/40.
- `fas_test`: 20 migraciones, ninguna pendiente.

**Dictamen:** las correcciones funcionales revisadas quedan aprobadas. El cierre QA formal continúa condicionado únicamente por QAS-SI-008 (permisos frontend todavía mock), QAS-SI-010 (sin pruebas específicas del módulo) y la aceptación de negocio de QAS-SI-011.

## 6. Notas para el deploy (Office365)

- La casilla usada como remitente debe tener **SMTP AUTH habilitado** en el tenant M365 (Microsoft lo trae deshabilitado por defecto en tenants nuevos): Admin → Usuarios → correo → *Administrar aplicaciones de correo electrónico* → activar *SMTP autenticado*.
- Host `smtp.office365.com`, puerto `587`, seguridad `STARTTLS` (defaults precargados en el formulario).
- Si la organización fuerza MFA, se requiere una cuenta con MFA excluida para SMTP o una app password.
- La clave de cifrado de la password SMTP se deriva de `BETTER_AUTH_SECRET`; si ese secret cambia, hay que volver a guardar la configuración SMTP.
