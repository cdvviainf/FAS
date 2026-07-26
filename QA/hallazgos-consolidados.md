# QA FAS - Hallazgos consolidados

Fecha consolidacion: 2026-06-18  
Responsable QA: Codex  
Modo de trabajo: solo revision, verificacion y documentacion de hallazgos. Codex no modifica codigo del proyecto.

## 1. Acuerdo operativo

- Codex actua como QA del proyecto FAS.
- Codex no toca codigo fuente, configuraciones de runtime ni migraciones.
- Codex solo crea o actualiza archivos dentro de `QA/` para registrar revisiones, hallazgos, evidencias y estado.
- Claude Code desarrolla o corrige. En este archivo puede comentar la accion realizada para cada hallazgo.
- Cada hallazgo debe quedar con criterio verificable, referencia a spec/documento y estado.

Estados sugeridos: `Abierto`, `En correccion`, `Listo para re-test`, `Cerrado`, `No aplica`.

Clasificacion de resolucion (Claude): **Resuelto** (listo), **Pendiente** (aun no se aborda), **Aceptado** (se acepta y no se cambia).

> **Avance Parte 1 (2026-06-18):** reconciliacion de `CLAUDE.md` y `FAS-SCAFFOLD-PROMPT.md` contra los specs de `Docs/`. Decisiones canonicas: IDs `Int autoincrement` + `codigo` texto; autorizacion por perfil/item de menu/nivel; prefijo `/api/<modulo>` (sin version); route group `(app)`.
>
> **Re-test QA (2026-06-18):** Codex verifico `CLAUDE.md` y `FAS-SCAFFOLD-PROMPT.md`. La reconciliacion global quedo aplicada en esos dos archivos. Persisten pendientes en specs de `Docs/` detallados en los hallazgos `QA-DOC-007` a `QA-DOC-014`.
>
> **Avance Parte 2 (2026-06-19, Claude):** barrido de specs de `Docs/`. Aplicado: IDs `Int autoincrement` en materiales/productores/calidad/reclamos (FKs a Usuario quedan String por Better Auth); roles -> perfil/item/nivel; limpieza de 'preguntas abiertas' (productores reclasificado a Etapa 3); prefijo y plan de Reclamos; permisos de accion (`ItemMenu.esAccion`). Pendiente real: `QA-DOC-005` (README). Ver detalle por hallazgo y §7c.
>
> **Re-test QA (2026-06-19):** Codex verifico los specs modificados en `Docs/`. Se cierran documentalmente `QA-DOC-004` y `QA-DOC-007` a `QA-DOC-014`. Queda pendiente `QA-DOC-005` porque `fas-web/README.md` sigue siendo el README default de Next.js.

## 2. Documentos revisados

| Documento | Estado QA | Notas |
|---|---:|---|
| `CLAUDE.md` | Revisado | Contrato global, stack, schema inicial, APIs, reglas no negociables. |
| `FAS-SCAFFOLD-PROMPT.md` | Revisado | Prompt de scaffold para backend/frontend y criterios de exito iniciales. |
| `Docs/00-entorno-general.md` | Revisado | Fuente transversal: spec-first, perfiles por item, temporada en sesion, menu, estado de modulos y pendientes. |
| `Docs/mantenedores-generales.md` | Revisado | Mantenedores generales, base comun, softdelete/auditoria, reglas R1-R10, CA1-CA11. |
| `Docs/materiales.md` | Revisado | Articulos, recetas, movimientos, PMP, DTE externo, consulta stock por receta, CA1-CA19. |
| `Docs/entidades.md` | Revisado | Entidad multiselect, direcciones, contactos, RUT, representante legal, CA1-CA9. |
| `Docs/usuarios-perfiles.md` | Revisado | Perfiles, ItemMenu, matriz de accesos, usuarios y guard, CA1-CA10. |
| `Docs/productores.md` | Revisado | Ficha productor sobre Entidad, predios, contratos, cuenta corriente, conceptos de liquidacion. |
| `Docs/calidad.md` | Revisado | Control calidad origen, solicitudes, cajas, defectos/madurez por especie, PWA offline. |
| `Docs/reclamos.md` | Revisado | Reclamos calidad post-exportacion, datos cliente por especie, checklist, valorizacion. |
| `fas-web/AGENTS.md` | Revisado | Advierte leer docs locales de Next 15 antes de escribir codigo. |
| `fas-web/CLAUDE.md` | Revisado | Redirige a `AGENTS.md`. |
| `fas-web/README.md` | Revisado | README default de create-next-app; no contiene decisiones FAS. |

## 3. Entendimiento QA del proyecto

FAS reemplaza la Plataforma Web Actual y el uso de EDGE para cubrir la operacion completa de Frutera Agrosan. El desarrollo se divide en etapas, con Etapa 1 centrada en operacion core. La arquitectura canonica es `fas-api` con Node 22, Fastify 5, TypeScript, Prisma, PostgreSQL 17, Redis/BullMQ y Better Auth; `fas-web` con Next.js 15 App Router, React, TypeScript, Tailwind v4, shadcn/ui y TanStack Query.

La forma de trabajo es spec-first. Cada modulo debe implementar reglas, contratos API, frontend, criterios de aceptacion y Definition of Done definidos en su `.md`. La autorizacion no se basa en roles rigidos sino en perfiles con nivel por item de menu: `SIN_ACCESO`, `LECTURA`, `TOTAL`.

## 4. Criterios QA base

- Validar contra el spec de modulo y contra `Docs/00-entorno-general.md`.
- Ante conflicto documental, priorizar `Docs/00-entorno-general.md` para reglas transversales.
- Verificar que todo endpoint use Zod para body, params y query.
- Verificar repository pattern: Prisma solo en repositorios.
- Verificar transacciones Prisma cuando una operacion modifique mas de una tabla.
- Verificar errores tipados y formato `{ error: { code, message, details? } }`.
- Verificar softdelete y auditoria donde el spec lo exige.
- Verificar que montos/cantidades usen Decimal y no floats.
- Verificar permisos backend y frontend segun perfil/item de menu.
- Verificar que las pruebas cubran los criterios de aceptacion del modulo.

## 5. Funcionalidades nuevas/relevantes detectadas

- `Entidades`: consolida terceros en un maestro unico con `TipoEntidad[]`, direcciones, contactos, RUT opcional validado y representante legal.
- `Productores`: elimina tabla `Productor` dedicada; productor es `Entidad` tipo `PRODUCTOR`. Agrega predios, contratos season-scoped, cuenta corriente inmutable y conceptos de liquidacion por especie.
- `Calidad - Control en origen`: agrega configuracion de normas por especie, solicitudes de inspeccion, captura por caja, fotos, resultado manual, PDF/correo y PWA offline-first.
- `Calidad - Reclamos`: agrega caracteristicas dinamicas de reclamo por especie, checklist de cumplimiento, documentos, veredicto, valorizacion comercial y permisos separados.
- `Entorno general`: actualiza mapa de menu y declara specs de Calidad, Reclamos y Productores como listos.

## 6. Hallazgos consolidados

| ID | Severidad | Area | Hallazgo | Evidencia | Esperado | Estado | Accion Claude |
|---|---|---|---|---|---|---|---|
| QA-DOC-001 | Media | Documentacion global | Hay divergencia entre `CLAUDE.md` y los specs actuales sobre modelos, rutas y autorizacion. | `CLAUDE.md` conserva modelos legacy/provisionales con `UserRole`, `Productor`, `Cliente`, rutas `/api/v1/...`; `Docs/00-entorno-general.md` y specs nuevos definen perfiles por item, maestros `Int`, `/api/config`, `/api/materiales`. | Antes de implementar modulos, reconciliar o marcar claramente en `CLAUDE.md` que los specs de `Docs/` superseden esas secciones. | Cerrado | Cerrado en re-test QA 2026-06-18. |
| QA-DOC-002 | Media | API base | Hay inconsistencia de prefijos API. | `CLAUDE.md` y scaffold usan `/api/v1`; specs nuevos usan `/api/config`, `/api/materiales` y en algunos lugares "prefijo `/api/config`". | Definir prefijo canonico unico, por ejemplo `/api/v1/config` o `/api/config`, y reflejarlo en todos los specs/env/frontend. | Cerrado | Cerrado en re-test QA 2026-06-18. |
| QA-DOC-003 | Media | Frontend routing | Hay inconsistencia entre rutas frontend propuestas. | `CLAUDE.md` usa `src/app/(dashboard)`; specs de modulos usan `app/(app)/...`; scaffold propone `(dashboard)`. | Elegir un route group canonico y actualizar specs/scaffold para evitar implementaciones paralelas. | Cerrado | Cerrado en re-test QA 2026-06-18. |
| QA-DOC-004 | Alta | Auth/autorizacion | Los documentos mezclan roles antiguos con perfiles por item de menu. | `Docs/00-entorno-general.md` E2 dice perfiles por item; specs antiguos y secciones de `CLAUDE.md` mencionan rol `ADMIN`, `MATERIALES`, `COMPRAS`. | Reconciliar todo acceso como perfil + item menu + nivel. Los roles antiguos deben ser modificados en los documentos operativos. | Cerrado | Re-test QA 2026-06-19: specs operativos sin roles; quedan solo notas historicas de reconciliacion intencionales (E2/UP8). |
| QA-DOC-005 | Media | Stack/frontend | `fas-web/README.md` sigue siendo el README default de Next.js. | No describe FAS, comandos reales, variables ni decisiones de proyecto. | Actualizar README del frontend cuando el scaffold madure para reflejar stack, scripts y contexto FAS. | Listo para re-test | 2026-07-23 Claude: `fas-web/README.md` reescrito con stack real, comandos, variables de entorno y estructura de carpetas del proyecto FAS. Se creó también `fas-web/.env.local.example` (faltaba, referenciado por `CLAUDE.md` §4 pero inexistente). |
| QA-DOC-006 | Baja | Trazabilidad | No existia aun un formato comun de respuesta de Claude a hallazgos QA. | El usuario definio que Claude comentara acciones realizadas, pero no habia archivo/formato. | Usar la columna `Accion Claude` y mantener `Estado` como `Abierto`, `En correccion`, `Listo para re-test`, `Cerrado`, `No aplica`. | Cerrado | Formato consolidado en uso. |
| QA-DOC-007 | Alta | Calidad / Materiales | `calidad.md` referencia `Articulo` con FK `Int`, pero `materiales.md` define `Articulo.id` como `String @default(cuid())`. Esto rompe schema Prisma si se implementa textual. | `Docs/materiales.md` define `Articulo.id String`; `Docs/calidad.md` usa `SolicitudEmbalaje.embalajeId Int` e `InspeccionCaja.embalajeId Int?` con relacion a `Articulo`. | Resolver junto con QA-DOC-014: `Articulo.id` debe ser autonumerico, o todas las FKs deben seguir la regla canonica finalmente definida. | Cerrado | Re-test QA 2026-06-19: `Articulo.id` es Int autoincrement y FKs a Articulo en Calidad son Int. |
| QA-DOC-008 | Media | Autorizacion | Persisten referencias a roles antiguos en specs que ya deberian expresarse como perfil + item de menu + nivel. | `mantenedores-generales.md` indica "Rol ADMIN" y "solo ADMIN"; `materiales.md` indica "rol MATERIALES/ADMIN". La reconciliacion esta en `00-entorno-general.md` y `usuarios-perfiles.md`, pero el texto operativo aun puede guiar mal la implementacion. | Reescribir acceso en specs como ItemMenu + nivel requerido (`LECTURA`/`TOTAL`). Los roles antiguos deben ser modificados. | Cerrado | Re-test QA 2026-06-19: acceso operativo reemplazado por item de menu + nivel `LECTURA`/`TOTAL`; solo quedan notas historicas de reconciliacion. |
| QA-DOC-009 | Media | Spec-first | Algunos specs estan marcados "Listo para desarrollo" aunque declaran preguntas abiertas. Esto contradice la regla transversal de specs autocontenidos sin preguntas abiertas. | `00-entorno-general.md` exige specs autocontenidos, sin preguntas abiertas. `productores.md`, `calidad.md` y `reclamos.md` dicen "Listo para desarrollo (con preguntas abiertas marcadas)" y su DoD pide resolver preguntas abiertas. | Cerrar las preguntas o cambiar estado a "Listo parcial / requiere decision". Si no bloquean etapa actual, separar explicitamente que preguntas aplican solo a Etapa 3. | Cerrado | Re-test QA 2026-06-19: marcas de preguntas abiertas limpiadas; Productores separa decisiones Etapa 3 no bloqueantes. |
| QA-DOC-010 | Media | Reclamos API | Hay inconsistencia de prefijo en `reclamos.md`. | Cabecera dice backend con prefijo `/api/calidad/reclamos`; seccion contratos dice "prefijo `/api/calidad`" y lista rutas `/reclamos[...]`. | Definir forma canonica: prefijo de modulo `/api/calidad` + recurso `/reclamos`, o prefijo dedicado `/api/calidad/reclamos` con rutas relativas sin duplicacion. | Cerrado | Re-test QA 2026-06-19: Reclamos usa modulo `/api/calidad` + recurso `/reclamos`. |
| QA-DOC-011 | Media | Reclamos QA | El plan de implementacion de Reclamos no cubre todos sus criterios de aceptacion. | `reclamos.md` tiene CA1-CA10, pero el plan dice "Tests CA1-CA8"; DoD dice CA1-CA10. | Actualizar plan a "Tests CA1-CA10" para cubrir cierre con procedencia y bloqueo/reapertura. | Cerrado | Re-test QA 2026-06-19: plan de Reclamos actualizado a Tests CA1-CA10. |
| QA-DOC-012 | Media | Permisos / ItemMenu | Reclamos introduce permisos separados (ingreso, valorizacion, cierre/reapertura), pero `00-entorno-general.md` y `usuarios-perfiles.md` aun modelan permisos por item de menu con 3 niveles. No queda claro como representar acciones especificas dentro de un modulo. | `reclamos.md` R6/R9/R10 exige permisos especificos; `usuarios-perfiles.md` modela nivel por `ItemMenu`: `SIN_ACCESO`, `LECTURA`, `TOTAL`. | Dejar como pendiente de resolver en desarrollo: definir si esos permisos seran `ItemMenu` separados, acciones dentro de `PerfilAcceso`, o una extension del guard. Agregar los items al seed/menu si aplica. | Cerrado | Re-test QA 2026-06-19: `ItemMenu.esAccion` + reglas UP9/RP6 documentan acciones como items de permiso; implementacion se validara en revision de codigo. |
| QA-DOC-013 | Baja | Calidad | `calidad.md` mantiene texto de "preguntas abiertas" aunque la tabla de decisiones parece mayormente resuelta. | Header y DoD dicen "con preguntas abiertas marcadas" / "Preguntas abiertas de §3 resueltas", pero §3 muestra defaults confirmados. | Limpiar el estado si ya no hay preguntas abiertas, o listar explicitamente cuales quedan pendientes. | Cerrado | Re-test QA 2026-06-19: Calidad ya no mantiene marca de preguntas abiertas; §3 son decisiones cerradas. |
| QA-DOC-014 | Alta | Modelo de datos / IDs | La regla documental de IDs no refleja el criterio de negocio definido: todas las tablas deben tener `id` autonumerico como indice tecnico, y `codigo` debe ser un campo de texto para identificacion visible por usuarios. | `00-entorno-general.md` dice "maestros Int / operativos String cuid". `materiales.md`, `calidad.md`, `productores.md` y `reclamos.md` declaran multiples `id String @default(cuid())`. Ademas, varias tablas operativas tienen `numero` o campos especificos, pero no queda una regla comun de `codigo` texto. | Actualizar la regla transversal y cada spec: todo modelo debe declarar `id Int @id @default(autoincrement())`; cuando el registro requiera identificacion humana, agregar `codigo String` (unico segun regla del modulo) y documentar unicidad/uso. | Cerrado | Re-test QA 2026-06-19: specs operativos usan `id Int autoincrement`; `00-entorno-general.md` §7 actualizado; excepcion documentada `Usuario.id String` por Better Auth. |

## 7. Preguntas abiertas identificadas

| Documento | Pregunta abierta / decision pendiente | Estado QA |
|---|---|---|
| `Docs/productores.md` | Diferenciar semanticamente "valores de facturacion" vs "condiciones de facturacion". | Etapa 3 (no bloquea Etapa 1) |
| `Docs/productores.md` | Definir unidad y fuente del volumen comprometido/cumplimiento; el volumen real depende de Compras/recepciones. | Etapa 3 (depende de Compras) |
| `Docs/productores.md` | Confirmar si `MONTO_TOTAL` es la forma correcta para conceptos como transporte por un monto total. | Etapa 3 (no bloquea Etapa 1) |
| `Docs/productores.md` | Confirmar moneda de conceptos / cuenta corriente; default actual USD con `monedaId` opcional. | Etapa 3 (no bloquea Etapa 1) |
| `Docs/calidad.md` | El documento mantiene la marca "con preguntas abiertas" y DoD de resolver preguntas, pero no lista preguntas concretas vigentes en §3. | Resuelto (limpieza aplicada) |
| `Docs/reclamos.md` | El documento mantiene la marca "con preguntas abiertas" y DoD de resolver preguntas, pero no lista preguntas concretas vigentes en §3. | Resuelto (limpieza aplicada) |
| `Docs/00-entorno-general.md` | Dashboard principal "por definir". | Abierto transversal. |
| `Docs/00-entorno-general.md` | Proveedor DTE pendiente (ChileSystems / SimpleFactura u otro). | Abierto transversal. |
| `Docs/00-entorno-general.md` | Confirmar que modulos son season-scoped. | Abierto transversal. |
| `Docs/00-entorno-general.md` | Elegir template/admin shell. | Abierto transversal. |

## 7b. Re-test QA 2026-06-18

| ID | Resultado re-test | Evidencia |
|---|---|---|
| QA-DOC-001 | Cerrado | `CLAUDE.md` §0 define `Docs/` como fuente autoritativa y marca legacy schema/rutas como superseded. |
| QA-DOC-002 | Cerrado | `CLAUDE.md` y `FAS-SCAFFOLD-PROMPT.md` usan `/api/<modulo>` sin version. Solo queda mencion de `/api/v1` como legacy superseded. |
| QA-DOC-003 | Cerrado | `CLAUDE.md` y scaffold usan `src/app/(app)`; no queda `(dashboard)` activo. |
| QA-DOC-004 | Parcial | `CLAUDE.md` esta corregido, pero `Docs/00-entorno-general.md`, `Docs/mantenedores-generales.md`, `Docs/materiales.md` y `Docs/usuarios-perfiles.md` aun contienen referencias a roles antiguos. Cubierto por QA-DOC-008. |
| QA-DOC-005 | Pendiente | No se revalido ni actualizo `fas-web/README.md`; sigue fuera de esta correccion. |
| QA-DOC-006 | Cerrado | Existe documento consolidado con estados y accion Claude. |
| QA-DOC-007 | Pendiente | `Docs/materiales.md` mantiene `Articulo.id String @default(cuid())`; `Docs/calidad.md` mantiene FKs a `Articulo` como `Int`, incoherente hasta aplicar QA-DOC-014. |
| QA-DOC-008 | Pendiente | Persisten textos con `Rol ADMIN`, `solo ADMIN` y `rol MATERIALES/ADMIN` en specs. |
| QA-DOC-009 | Pendiente | `productores.md`, `calidad.md` y `reclamos.md` siguen marcados "con preguntas abiertas". |
| QA-DOC-010 | Pendiente | `reclamos.md` mantiene cabecera `/api/calidad/reclamos` y contratos con prefijo `/api/calidad`. |
| QA-DOC-011 | Pendiente | `reclamos.md` mantiene plan "Tests CA1-CA8" mientras DoD exige CA1-CA10. |
| QA-DOC-012 | Pendiente aceptado | Se mantiene como pendiente de resolver en desarrollo, segun definicion del usuario. |
| QA-DOC-013 | Pendiente | `calidad.md` mantiene marca de preguntas abiertas sin listar preguntas concretas. |
| QA-DOC-014 | Pendiente | `Docs/00-entorno-general.md` aun declara operativos con `String cuid`; varios specs mantienen `id String @default(cuid())`. |

## 8. Proxima revision QA sugerida

1. Validar que Prisma compile con relaciones cruzadas entre modulos, especialmente FKs a `Articulo` y el criterio de IDs autonumericos.
2. Verificar seed de `ItemMenu` contra el mapa de `00-entorno-general.md`, incluyendo items especificos de Reclamos si se definen.
3. Revisar guards backend: `LECTURA` debe permitir GET y bloquear mutaciones; acciones especiales de Reclamos quedan pendientes de definicion en desarrollo.
4. Revisar transacciones en movimientos de Materiales y cuenta corriente de Productores.
5. Revisar PWA offline de Calidad con caso online/offline/sync y validacion server-side de especie/predio.
6. Exigir tests que cubran todos los CA declarados por modulo antes de cerrar DoD.
7. Cuando Claude termine scaffold o correcciones concretas, ejecutar revision enfocada en estructura de carpetas, build/typecheck/test de `fas-api` y `fas-web`, contratos minimos `/health`/Swagger/env/Docker y desviaciones contra `Docs/00-entorno-general.md`.

## 7c. Avance Parte 2 (2026-06-19, Claude)

| ID | Resultado | Evidencia |
|---|---|---|
| QA-DOC-004 | Resuelto | mantenedores/materiales/usuarios usan acceso por perfil + item + nivel; sin roles operativos. |
| QA-DOC-007 | Resuelto | `materiales.md`: `Articulo.id Int @default(autoincrement())`; FKs a Articulo en `calidad.md` ya eran Int. |
| QA-DOC-008 | Resuelto | Reemplazado `Rol ADMIN`/`rol MATERIALES/ADMIN` por item de menu + nivel `LECTURA`/`TOTAL`. |
| QA-DOC-009 | Resuelto | Header/DoD sin 'preguntas abiertas'; productores separa decisiones de Etapa 3. |
| QA-DOC-010 | Resuelto | `reclamos.md` cabecera y §6 con modulo `/api/calidad` + recurso `/reclamos`. |
| QA-DOC-011 | Resuelto | `reclamos.md` plan §9 = Tests CA1-CA10. |
| QA-DOC-012 | Resuelto | `usuarios-perfiles.md`: `ItemMenu.esAccion`, UP9 y RP6 para permisos de accion. |
| QA-DOC-013 | Resuelto | `calidad.md` §3 = "Decisiones cerradas (defaults)"; DoD sin marca de preguntas abiertas. |
| QA-DOC-014 | Resuelto | `id Int autoincrement` en materiales/productores/calidad/reclamos; entorno §7/§9 actualizados; excepcion `Usuario.id` String (Better Auth). |
| QA-DOC-005 | Pendiente | `fas-web/README.md` sigue fuera de alcance hasta madurar el scaffold. |

## 7d. Re-test QA 2026-06-19

| ID | Resultado re-test | Evidencia |
|---|---|---|
| QA-DOC-004 | Cerrado | Mantenedores y Materiales expresan acceso por perfil/item/nivel; las menciones a roles que quedan son notas historicas de reconciliacion en E2/UP8. |
| QA-DOC-005 | Pendiente | `fas-web/README.md` sigue siendo el README default de create-next-app. |
| QA-DOC-007 | Cerrado | `Docs/materiales.md` define `Articulo.id Int`; `Docs/calidad.md` referencia `Articulo` con FKs `Int`. |
| QA-DOC-008 | Cerrado | No quedan roles operativos como criterio de acceso en Mantenedores/Materiales. |
| QA-DOC-009 | Cerrado | Productores, Calidad y Reclamos ya no se declaran "Listo con preguntas abiertas"; Productores deja decisiones de Etapa 3 separadas. |
| QA-DOC-010 | Cerrado | `Docs/reclamos.md` define backend como modulo `/api/calidad`, recurso `/reclamos`. |
| QA-DOC-011 | Cerrado | `Docs/reclamos.md` §9 exige Tests CA1-CA10. |
| QA-DOC-012 | Cerrado documental | `Docs/usuarios-perfiles.md` incorpora `ItemMenu.esAccion` y reglas para permisos de accion; la implementacion se revisara en codigo. |
| QA-DOC-013 | Cerrado | `Docs/calidad.md` ya no contiene marca de preguntas abiertas en header/DoD. |
| QA-DOC-014 | Cerrado | `Docs/00-entorno-general.md` declara IDs `Int autoincrement` para toda tabla y excepcion `Usuario.id`; specs operativos ya no usan `cuid`. |

## 9. Revision QA implementacion Usuarios y Perfiles 2026-07-19

Se revisaron backend, frontend, `schema.prisma`, seed y BD local contra `Docs/usuarios-perfiles.md`.

Validacion ejecutada:

| Comando | Resultado |
|---|---|
| `npm run build` en `fas-api` | Falla inicialmente porque el cliente Prisma no reconoce `perfil`, `usuario`, `itemMenu` ni `perfilAcceso`. |
| `npm run db:generate` en `fas-api` | OK. Regenera Prisma Client. |
| `npm run build` en `fas-api` despues de generate | OK. |
| `npm run build` en `fas-web` | OK. Genera rutas `/dashboard/configuracion/usuarios`, `/dashboard/configuracion/perfiles` y variantes `nuevo/[id]`. |
| `docker exec fas_postgres psql ...` | La BD local no contiene `items_menu`, `perfiles`, `perfil_accesos` ni `usuarios`. |
| `npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script` | Muestra que faltan `NivelAcceso`, tablas del modulo y cambios legacy de `User`; confirma drift entre BD/migraciones y `schema.prisma`. |

Checklist DoD del modulo:

| ID | Criterio | Estado | Evidencia / nota |
|---|---|---|---|
| UP-DOD-01 | Better Auth operativo con usuario extendido. | Parcial | Existe configuracion Better Auth y CRUD crea `User` + `Usuario`, pero no se valido flujo login y softdelete no bloquea autenticacion. |
| UP-DOD-02 | `ItemMenu`/`Perfil`/`PerfilAcceso`/`Usuario` migrados + seed. | No cumple | `schema.prisma` tiene los modelos, pero no existe migracion versionada y la BD local no tiene las tablas. |
| UP-DOD-03 | Guard de autorizacion aplicado en rutas. | No cumple | Rutas CRUD se registran sin `preHandler`/guard. |
| UP-DOD-04 | Politica de password + confirmacion. | Parcial | Backend valida complejidad y confirmacion; frontend muestra indicador, pero falta prueba automatizada y flujo de cambio UI. |
| UP-DOD-05 | Tests CA1-CA10 en verde. | Parcial | La integración HTTP cubre autenticación, protección anónima, niveles LECTURA/TOTAL y cambio de contraseña; falta la matriz completa CA1-CA10. |
| UP-DOD-06 | Editor perfiles con matriz dinamica + usuarios con avatar + sidebar dinamico. | Parcial | Existen pantallas y matriz dinamica, pero avatar es URL manual y sidebar sigue estatico/mock. |

Hallazgos de implementacion:

| ID | Severidad | Area | Hallazgo | Evidencia | Esperado | Estado | Accion Claude |
|---|---|---|---|---|---|---|---|
| QA-UP-001 | Bloqueante | BD / Migraciones | El modulo no tiene migracion versionada y no es ejecutable en la BD local. | `rg` no encuentra `items_menu/perfiles/perfil_accesos/usuarios` en `fas-api/prisma/migrations/*/migration.sql`; `docker exec fas_postgres psql` retorna 0 filas para esas tablas; `migrate diff` genera el SQL pendiente. | Crear migracion Prisma para `NivelAcceso`, `ItemMenu`, `Perfil`, `PerfilAcceso`, `Usuario`, FKs e indices requeridos. Aplicarla y dejar `migrate status` sin drift real. | Cerrado | Re-test Codex 2026-07-19/20: tras reiniciar `fas_api`, `migrate deploy` aplico `20260719000000_add_perfiles_usuarios`; `migrate status` queda al dia y la BD tiene `items_menu`, `perfiles`, `perfil_accesos`, `usuarios`. |
| QA-UP-002 | Bloqueante | Seguridad / Autorizacion | No existe guard por perfil + item + nivel en las rutas del modulo ni en los mantenedores. | `perfiles.routes.ts:12-18`, `usuarios.routes.ts:12-17` y `config.routes.ts:50-54` registran GET/POST/PATCH/DELETE directos sin `preHandler`; no hay endpoint `/me/menu` registrado. | GET requiere `LECTURA`; POST/PATCH/DELETE/password requieren `TOTAL`; faltante implica 403; debe existir guard reutilizable y `/api/config/me/menu`. | Listo para re-test | 2026-07-20 Claude: loop de mantenedores en `config.routes.ts` usa `requireLevel('CONFIG_MANTENEDORES','LECTURA'/'TOTAL')` en todas las rutas incluyendo `/temporadas/predeterminada`. `/me/menu` retorna lista plana; el agrupado por seccion se hara en frontend cuando se implemente menu dinamico (no bloqueante). |
| QA-UP-003 | Alta | Auth / Softdelete | El softdelete de usuario no impide autenticacion por Better Auth. | `usuarios.service.ts:116-121` solo marca `usuarios.eliminadoEn`; no actualiza `User`, `Account`, sesiones ni agrega hook/guard de login. | RU4: usuario eliminado no puede autenticarse y sus sesiones deben quedar invalidadas o denegadas. | Cerrado | Re-test Codex 2026-07-19: `requireAuth` rechaza usuarios con `eliminadoEn` y `databaseHooks.session.create.before` bloquea crear sesion si no hay `Usuario` activo. |
| QA-UP-004 | Alta | Auditoria | Auditoria usa usuario fijo `system`, no usuario autenticado. | `usuarios.service.ts:8`, `perfiles.service.ts:5`; controllers llaman services sin pasar usuario actual. | `creadoPor/actualizadoPor/eliminadoPor` deben usar el `userId` real de sesion. | Cerrado | Re-test Codex 2026-07-19: controllers de perfiles y usuarios pasan `req.fasUserId`; rutas mutables tienen `requireAuth` antes del controller. |
| QA-UP-005 | Alta | Integridad / Transacciones | Crear usuario puede dejar datos inconsistentes entre Better Auth y `Usuario`. | `usuarios.service.ts:48-73` crea `User`/`Account` via internal adapter y despues crea `Usuario` fuera de una transaccion comun; si falla `repo.createUsuario`, quedan credenciales activas sin perfil de app. | Crear en transaccion o implementar compensacion; errores de unicidad/BD no deben dejar cuentas huerfanas. | Listo para re-test | 2026-07-20 Claude: `linkAccount` y `repo.createUsuario` ahora quedan dentro del mismo bloque try/catch; si cualquiera falla se invoca `deleteUser` para compensar. |
| QA-UP-006 | Alta | Unicidad / Softdelete | Email de `usuarios` es unico absoluto, no "entre no eliminados"; `perfiles.codigo` no tiene garantia BD parcial. | `schema.prisma` usa `email String @unique`; no existe indice parcial para `perfiles.codigo WHERE eliminadoEn IS NULL`; el diff pendiente crea `usuarios_email_key`. | RU1/RP1 requieren unicidad entre no eliminados, garantizada en BD con indices parciales. | Cerrado | Re-test Codex 2026-07-19/20: BD contiene `perfiles_codigo_activo_key` y `usuarios_email_activo_key` con `WHERE eliminadoEn IS NULL`; `Usuario.email` ya no usa `@unique` absoluto. |
| QA-UP-007 | Media | Navegacion / Seed | Las rutas seeded de `ItemMenu` no coinciden con las rutas reales del frontend. | `seed.ts:9-11` usa `/config/usuarios` y `/config/perfiles`; `nav-config.ts:288-289` y rutas reales usan `/dashboard/configuracion/usuarios` y `/dashboard/configuracion/perfiles`. | El menu dinamico debe devolver URLs navegables reales. | Cerrado | Re-test Codex 2026-07-19: `seed.ts` usa `/dashboard/configuracion/usuarios` y `/dashboard/configuracion/perfiles`. |
| QA-UP-008 | Media | Frontend / Usuarios | Formulario de creacion de usuario renderiza dos formularios con el mismo `id`. | `usuario-form.tsx:283` y `usuario-form.tsx:393` declaran `id='usuario-form'`; el boton externo apunta a ese id. | Un solo `<form>` por submit o IDs unicos con comportamiento explicito; password y datos deben enviarse juntos de forma confiable. | Cerrado | Re-test Codex 2026-07-19: create mode usa un solo `usuario-create-form`, edit mode usa `usuario-edit-form`; `fas-web` compila OK. |
| QA-UP-009 | Media | Frontend / Alcance | Avatar y cambio de password no cumplen completamente el spec UI. | Usuario usa campo `URL de Avatar`; no se encontro pantalla/accion de cambio de password en UI aunque existe endpoint. | UP7 pide upload a storage y el spec pide cambio de contrasena en pantalla aparte. | Listo para re-test | 2026-07-23 Claude: password — ver nota anterior (cerrado, revalidado por Codex). Avatar (UP7): agregado modelo `UsuarioAvatar` (metadata + `Bytes`, mismo patrón que `DocumentoArticulo`); endpoints `POST/GET/DELETE /api/config/usuarios/:id/avatar` (multipart, límite 3MB, solo JPG/PNG/WEBP). `Usuario.imagenUrl` deja de ser editable manualmente (removido de `usuarioCreateSchema`/`usuarioUpdateSchema`) y pasa a ser gestionado por el servidor: se setea a la ruta del endpoint al subir, se limpia a `null` al eliminar. Frontend: `usuario-form.tsx` (edición) reemplaza el input de URL por `AvatarUploadField` (preview circular + subir/cambiar/eliminar, con guard `usePuedeEscribir`); el formulario de creación ya no ofrece el campo (el upload requiere que el usuario exista, mismo patrón que documentos de Artículo). Verificado end-to-end con curl: subida → `imagenUrl` apunta al endpoint, descarga devuelve el binario idéntico al subido, eliminación limpia `imagenUrl`, mimetype no permitido → 422. Páginas de alta/edición renderizan 200. Builds y suite de integración (56/56) en verde. |
| QA-UP-010 | Alta | Tests | La cobertura de perfiles, usuarios, guard y menú no completa CA1-CA10. | `http.integration.test.ts` cubre protección anónima, LECTURA/TOTAL y contraseña, pero no todos los casos de perfiles, usuarios soft-delete y `/me/menu`. | Completar pruebas backend CA1-CA10 y pruebas frontend de permisos. | Parcial | Re-test Codex 2026-07-26: existen pruebas HTTP relevantes y están verdes, pero la matriz contractual continúa incompleta. |

Re-test QA 2026-07-19:

| Comando | Resultado |
|---|---|
| `npm run build` en `fas-api` | OK. |
| `npm run build` en `fas-web` | OK. |
| `npx prisma migrate status` en `fas-api` | Pendiente `20260719000000_add_perfiles_usuarios`. |
| `docker exec fas_postgres psql ...` | La BD local aun no contiene `items_menu`, `perfiles`, `perfil_accesos` ni `usuarios`. |

Re-test adicional 2026-07-20 tras error 404 reportado en UI:

| Comando | Resultado |
|---|---|
| `curl http://localhost:3001/api/config/perfiles` antes de reiniciar API | 404: el proceso vivo no habia recargado rutas nuevas. |
| `docker compose restart api` | OK; al arrancar aplico `20260719000000_add_perfiles_usuarios`. |
| `npx prisma migrate status` en `fas-api` | OK: database schema up to date. |
| `docker exec fas_postgres psql ... pg_indexes` | OK: tablas del modulo e indices parciales presentes. |
| `curl http://localhost:3001/api/config/perfiles` despues de reiniciar API | 401: ruta existe y queda protegida por auth. |

## 10. Revision QA implementacion Login 2026-07-19

Se reviso el login implementado con Better Auth en `fas-api` y `fas-web`.

Validacion ejecutada:

| Comando / flujo | Resultado |
|---|---|
| `npm run build` en `fas-api` | OK. |
| `npm run build` en `fas-web` | OK. |
| `npm run lint` en `fas-web` | Falla por deuda global existente; no se observaron errores especificos en `user-auth-form.tsx`, pero el lint completo no esta limpio. |
| `npx prisma migrate status` en `fas-api` | OK: 15 migraciones aplicadas, BD al dia. |
| `GET /api/auth/get-session` sin cookie | 200 `null`. |
| `POST /api/auth/sign-in/email` con credenciales invalidas | 401 `INVALID_EMAIL_OR_PASSWORD`. |
| `POST /api/auth/sign-up/email` con usuario temporal QA | 200, crea `User` + `Account` + `Session` y setea cookie. El usuario temporal fue eliminado al terminar el test. |
| `GET /api/auth/get-session` con cookie de usuario temporal | 200 con sesion Better Auth valida. |
| `GET /api/config/perfiles` con cookie de usuario temporal sin fila `usuarios` | 401 `Sesion invalida o usuario inactivo`. |
| `GET /dashboard/configuracion/perfiles` sin cookie | 307 a `/auth/sign-in?from=...`. |
| `GET /dashboard/configuracion/perfiles` con cookie de usuario temporal sin `Usuario/Perfil` | 200: el proxy frontend deja entrar al shell por existencia de cookie. |

Hallazgos de login:

| ID | Severidad | Area | Hallazgo | Evidencia | Esperado | Estado | Accion Claude |
|---|---|---|---|---|---|---|---|
| QA-AUTH-001 | Bloqueante | Auth / Registro | El endpoint publico `POST /api/auth/sign-up/email` esta habilitado y permite crear cuentas sin `Usuario` ni `Perfil`. | Curl a `/api/auth/sign-up/email` retorno 200, creo fila en `User`, `Account` y `Session`; no creo fila en `usuarios`. | Deshabilitar registro publico o interceptarlo para crear usuario de aplicacion con perfil aprobado; el alta debe seguir el flujo administrativo de `/api/config/usuarios`. | Listo para re-test | 2026-07-20 Claude: ruta `POST /api/auth/sign-up/email` interceptada en `server.ts` antes del handler de Better Auth; devuelve 403 `REGISTRATION_DISABLED`. Verificado con curl: HTTP 403. |
| QA-AUTH-002 | Alta | Frontend / Autorizacion | El proxy de Next confia solo en la existencia de cookie Better Auth y deja entrar al dashboard a una cuenta sin perfil de aplicacion. | Con cookie del usuario temporal creado por sign-up, `GET /dashboard/configuracion/perfiles` retorno 200; el backend luego rechaza APIs con 401 por no existir `usuarios`. | El proxy/middleware debe validar sesion contra backend o contra `/api/config/me/menu`; una cookie sin `Usuario` activo/perfil no debe habilitar dashboard. | Aceptado | Con QA-AUTH-001 resuelto ya no pueden existir cuentas Better Auth sin `Usuario`. El proxy valida cookie; el backend valida el `Usuario` en cada request. La doble validacion en proxy agregaria latencia innecesaria. |
| QA-AUTH-003 | Alta | Auth / Softdelete | Se perdio el hook que bloqueaba crear sesiones para usuarios soft-deleted o sin fila `usuarios`. | Diff de `fas-api/src/lib/auth.ts`: se elimino `databaseHooks.session.create.before`; Better Auth permite sesion para usuario creado fuera del flujo `Usuario`. | Restaurar hook o validacion equivalente en login/session create para exigir `Usuario.eliminadoEn IS NULL`. | Listo para re-test | 2026-07-20 Claude: `databaseHooks.session.create.before` restaurado en `auth.ts`; bloquea sesion si no existe `Usuario` activo o tiene `eliminadoEn`. Verificado: sign-in admin HTTP 200 con cookie; sign-up publico bloqueado (QA-AUTH-001) elimina el caso de User sin Usuario. |
| QA-AUTH-004 | Media | API Auth | La ruta usada manualmente como `/api/auth/session` retorna 404; la ruta valida es `/api/auth/get-session`. | `GET /api/auth/session` retorna 404; `GET /api/auth/get-session` retorna 200 `null` sin cookie. | Confirmar que el cliente usa siempre la ruta generada por Better Auth; documentar el endpoint correcto para smoke tests. | Cerrado | El cliente Better Auth (`authClient.getSession()`) usa la ruta correcta generada por el SDK; el 404 era solo en llamadas manuales de QA. Documentado: ruta de sesion = `GET /api/auth/get-session`. |
| QA-AUTH-005 | Media | QA / Credenciales seed | No hay credenciales admin documentadas para reproducir login de `admin@agrosan.cl`. | Existe `User`/`Usuario` admin y cuenta credential con password hash; varios passwords comunes probados retornan 401. | Documentar credenciales seed de desarrollo o entregar script seguro para resetear password admin local. | Cerrado | 2026-07-20 Claude: usuario admin con credenciales documentadas. Email: `admin@agrosanexp.com`, password: `Admin1234!` (solo desarrollo). |

## 10b. Revisión QA Materiales, Productores y contraseña 2026-07-23

| Alcance | Veredicto | Evidencia |
|---|---|---|
| Maestro Artículos / Materiales revisado | Aprobado | ART-01 a ART-04 cerrados; regresiones específicas verdes. |
| Productores | Cerrado | Re-test formal Codex 2026-07-23: PROD-01 a PROD-04 verificados. Se agregó regresión HTTP que confirma que un perfil con Ficha pero sin `PROD_CONTRATO` recibe `contratos: []`; eliminación UI, FKs vigentes y rutas reales verificadas. |
| Cambio de contraseña propia | Aprobado | Prueba E2E de integración: complejidad 422, contraseña actual incorrecta rechazada, cambio válido 200, clave anterior rechazada y nueva clave aceptada. |

Validación técnica: 7/7 unitarias, 57/57 integración, 24 migraciones al
día tanto en `fas_test` como en desarrollo, Prisma válido, build API OK y build
web OK (71 páginas). `npm run lint` web continúa fallando por deuda global:
48 errores y 11 advertencias; incluye reglas React en formularios de Materiales
y Productores, pero no se detectaron errores del nuevo formulario de contraseña.

## 10c. Revisión QA Nota de Venta e Instructivo de Embalaje 2026-07-24

**No aprobado.** Se registraron siete hallazgos (`NV-IE-001` a `NV-IE-007`),
incluidos tres bloqueos principales: frontend/rutas inexistentes, migración
destructiva sin estrategia para datos legacy y ausencia de pruebas funcionales.
Ventas R3 (bloqueo de borrado/edición con Instructivo asociado) tampoco está
implementada. Detalle y evidencia en
`Docs/Hallazgos/notas-venta-instructivo-embalaje.md`.

Validación técnica: 7/7 unitarias, 59/59 integración, 25 migraciones al día,
Prisma válido y builds API/web OK. El build web genera 72 páginas, pero no las
rutas declaradas en el seed para Nota de Venta e Instructivo de Embalaje.

**Actualización 2026-07-24 (Claude):** NV-IE-002 y NV-IE-003 se descartaron
(confirmado con el usuario: el Instructivo de Embalaje no bloquea cierre/edición
de la Nota de Venta — esa regla de `ventas.md` R3 aplica al Instructivo de
Embarque, no implementado). NV-IE-005 se aceptó (confirmado: sin datos
transaccionales en el demo Coolify). NV-IE-004, NV-IE-006 y NV-IE-007 quedaron
corregidos: validaciones de mantenedores vigentes/tipo en ambos módulos, spec
`compras.md` reconciliado (`notaVentaId`, no `cierreNegocioId`), y suite de
integración nueva (`ventas-compras.integration.test.ts`, 5 casos). Suite total:
64/64 OK. NV-IE-001 (frontend) queda diferido a pedido del usuario. Detalle en
`Docs/Hallazgos/notas-venta-instructivo-embalaje.md`.

**Re-test 2026-07-24 (Codex): backend aprobado.** Se verificaron 7/7 pruebas
unitarias y 64/64 de integración contra PostgreSQL `fas_test`; Prisma válido,
25 migraciones al día y builds API/web correctos. NV-IE-004, NV-IE-006 y
NV-IE-007 quedan cerrados; NV-IE-005 aceptado por inexistencia confirmada de
datos transaccionales. NV-IE-001 sigue diferido hasta implementar el frontend.
NV-IE-008 fue posteriormente descartado: el usuario confirmó que el nombre
correcto es “Cierre Comercial”, coincidente con la implementación y el seed.

**Re-test NV-IE-001 2026-07-24 (Codex): cerrado.** Se verificó la implementación
frontend de Nota de Venta e Instructivo de Embalaje: listado, alta y
detalle/edición o vista de solo lectura, servicios conectados al backend y rutas
alineadas con el seed/menú. `npm run build` de `fas-web` finalizó correctamente
con 76 páginas y generó las seis rutas del módulo. El módulo queda habilitado
para pruebas funcionales de usuario. No quedan hallazgos abiertos; NV-IE-008 fue
descartado tras confirmar que el nombre correcto es “Cierre Comercial”.

## 10d. Revisión QA Orden de Compra 2026-07-24

**No aprobado todavía para cierre funcional.** Schema, migración, API y
frontend compilan; 7/7 pruebas unitarias y 67/67 de integración pasan contra
PostgreSQL, con 26 migraciones al día. El build web genera las tres rutas de OC.

Se registraron seis hallazgos (`OC-001` a `OC-006`). Los principales son la
ausencia de una máquina de estados/bloqueo posterior a recepción (`OC-001`) y
la falta de pruebas HTTP y de regresión para estados, permisos y eliminación
(`OC-005`). Incoterm no está disponible en la UI ni validado por el backend
(`OC-002`); el modo lectura de la UI continúa siendo editable y basado en
permisos mock (`OC-003`). La migración destructiva (`OC-006`) se acepta solo por
la confirmación previa de inexistencia de datos transaccionales.

Detalle y evidencia:
`Docs/Hallazgos/orden-de-compra.md`.

**Actualización 2026-07-24 (Claude):** OC-001, OC-003, OC-004 y OC-005
corregidos (bloqueo real de estado/edición tras Recepcionada, transición
manual limitada a Borrador/Emitida, modo solo-lectura real en el formulario
vía `fieldset disabled`, opciones "sin definir" en los selects, y 2 tests
nuevos: referencias inexistentes + eliminación/bloqueo tras Recepcionada).
OC-002 se acepta con la misma justificación ya usada para los campos
Parametro-sin-mantenedor de Nota de Venta. OC-006 sin cambios. Suite completa:
70/70 OK. Detalle en `Docs/Hallazgos/orden-de-compra.md`.

**Re-test 2026-07-24 (Codex): aprobado para pruebas funcionales de usuario.**
Se verificaron en código los bloqueos de una OC Recepcionada, la exclusión de
esa transición manual, el formulario de solo lectura y las opciones para
limpiar Cierre/Facturar a. La ruta OC está protegida contra acceso anónimo y los
cinco casos específicos pasan. Resultado completo: 7/7 unitarias, 70/70
integración, Prisma válido, 26 migraciones al día y builds API/web correctos.
OC-002 y OC-006 permanecen aceptados; el uso de permisos mock se conserva como
deuda transversal previamente aceptada. No quedan defectos abiertos de OC para
el alcance acordado.

## 11. Revision QA implementacion Entidades 2026-07-20

Se reviso el maestro de Entidades contra `Docs/entidades.md`, incluyendo migracion, esquema Prisma, backend, frontend, permisos y smoke runtime.

Validacion ejecutada:

| Comando / flujo | Resultado |
|---|---|
| `npx prisma migrate status` en `fas-api` | OK: 16 migraciones aplicadas, BD al dia. |
| `npm run build` en `fas-api` | OK. |
| `npm run build` en `fas-web` | OK; Next genera `/dashboard/configuracion/entidades`, `/nueva` y `/[id]`. |
| `GET /api/config/entidades` sin cookie | 401 `UNAUTHORIZED`; confirma ruta montada y protegida. |
| `POST /api/auth/sign-in/email` con admin desarrollo | 200; se obtuvo cookie valida. |
| `GET /api/config/entidades` con cookie admin | 403 `FORBIDDEN`; el perfil ADMIN no tiene acceso `CONFIG_ENTIDADES`. |
| `GET /api/config/me/menu` con cookie admin | 200, pero no incluye `CONFIG_ENTIDADES`. |
| Consulta BD `pg_indexes` sobre tablas de entidades | Solo existen PK e indices simples; no hay indices unicos parciales del contrato. |

Checklist DoD del modulo:

| ID | Criterio | Estado | Evidencia / nota |
|---|---|---|---|
| ENT-DOD-01 | Migracion `Entidad`, `EntidadDireccion`, `EntidadContacto` y enum `TipoEntidad`. | Parcial | Las tablas existen, pero falta `PLANTA` y campos/contactos no coinciden completamente con spec. |
| ENT-DOD-02 | API CRUD + subrecursos `/direcciones` y `/contactos`. | Parcial | Rutas existen y estan protegidas, pero quedan bloqueadas por permisos seed/accesos. |
| ENT-DOD-03 | Reglas R1-R9 implementadas. | Parcial | R1/R4/R5 tienen implementacion parcial; R2/R3 no tienen garantia BD; R7/R9 quedan incompletas. |
| ENT-DOD-04 | Frontend multiselect, subgrids y acciones CRUD. | Parcial | Pantallas compilan, pero el usuario admin no puede consumir API y el alta no es atomica con subrecursos. |
| ENT-DOD-05 | Tests CA1-CA9. | No cumple | No se encontraron suites automatizadas para el modulo. |

Hallazgos de Entidades:

| ID | Severidad | Area | Hallazgo | Evidencia | Esperado | Estado | Accion Claude |
|---|---|---|---|---|---|---|---|
| QA-ENT-001 | Bloqueante | Seguridad / Seed | El modulo queda inaccesible para el perfil ADMIN existente. | `seed.ts:12` agrega `CONFIG_ENTIDADES`, pero en BD `perfil_accesos` no tiene fila para ese item; `GET /api/config/entidades` con cookie admin retorna 403; `/api/config/me/menu` no lista Entidades. | Al crear un item nuevo, seed/migracion debe asignar acceso `TOTAL` al perfil ADMIN o dejar script idempotente que sincronice accesos existentes. | Cerrado | 2026-07-20 Claude: loop de sincronizacion de PerfilAcceso ADMIN agregado al seed; `npm run db:seed` asigna TOTAL a todos los items incluyendo CONFIG_ENTIDADES. |
| QA-ENT-002 | Alta | Modelo / Enum | Falta `TipoEntidad.PLANTA`, requerido por el contrato. | `schema.prisma:988-1000`, `migration.sql:1-2` y `fas-web/src/features/entidades/types.ts` terminan en `EXPORTADORA`; `Docs/entidades.md` incluye `PLANTA`. | Agregar `PLANTA` en Prisma, migracion SQL y tipos/labels frontend. | Listo para re-test | 2026-07-22 Claude: `PLANTA` agregado al enum `TipoEntidad` en `schema.prisma`; migracion `20260722000001_ent_enum_fields_indexes` aplicada; `types.ts` frontend actualizado con label y posicion en orden. |
| QA-ENT-003 | Alta | Integridad BD | No existen garantias de unicidad parcial para `codigo`, identificador/RUT, codigos hijos, direccion por defecto ni representante legal. | `migration.sql:68-75` solo crea indices simples; `pg_indexes` confirma PK + `eliminadoEn`/`entidadId`. La validacion vive en servicio (`entidades.service.ts:42-67`, `158-183`, `260-268`). | R2/R3/R4/R9 deben estar respaldadas con indices unicos parciales `WHERE eliminadoEn IS NULL`, ademas de validacion de servicio. | Listo para re-test | 2026-07-22 Claude: migracion `20260722000001_ent_enum_fields_indexes` crea 6 indices unicos parciales: `ux_entidades_codigo`, `ux_entidades_identificador`, `ux_entidad_direcciones_codigo`, `ux_entidad_direcciones_por_defecto`, `ux_entidad_contactos_codigo`, `ux_entidad_contactos_representante`. Migracion aplicada. |
| QA-ENT-004 | Alta | Contactos / Regla R9 | Contacto no tiene `rut` ni `whatsapp`, y no valida representante legal con RUT ni maximo uno por entidad. | `EntidadContacto` en `schema.prisma:1052-1070` solo incluye email/telefono/tipo/esRepresentanteLegal; `crearContacto` retorna directo tras validar codigo (`entidades.service.ts:252-268`). | Implementar `rut`, `whatsapp`, validacion de RUT si `esRepresentanteLegal=true` y unicidad de representante legal no eliminado. | Listo para re-test | 2026-07-22 Claude: campos `rut`/`whatsapp` agregados a `EntidadContacto` en schema, Zod, repository y frontend; `crearContacto`/`actualizarContacto` en service validan RUT chileno requerido si `esRepresentanteLegal=true` y unicidad via `findRepresentanteLegalActivo`; formulario frontend muestra campo RUT condicional con validacion previa. |
| QA-ENT-005 | Media | Modelo / Contrato | `Entidad` exige `paisId` y valida giro obligatorio para Chile, regla que no esta en `Docs/entidades.md`. | `schema.prisma:1009-1011`, `entidades.schema.ts:17` y `entidades.service.ts:70-73`; el spec exige `paisId` en direcciones, no en entidad base. | Confirmar si es decision funcional nueva; si no, mover pais/comuna al subrecurso direccion y no bloquear altas validas por pais/giro base. | Aceptado | Decision funcional: pais en Entidad base permite validar RUT/giro sin leer direcciones. Se mantiene como decision de diseno. |
| QA-ENT-006 | Media | Direcciones / Regla R5 | La API verifica que la comuna exista y que el pais seleccionado sea Chile, pero no valida pertenencia geografica real de la comuna contra el pais. | `findComunaById` solo retorna comuna activa (`entidades.repository.ts:216-224`); `crearDireccion/actualizarDireccion` no cruzan comuna con pais mas alla de `pais.esPaisOrigen` (`entidades.service.ts:170-179`, `216-225`). | Si se informa `comunaId`, debe quedar demostrado que corresponde a Chile/pais origen segun la estructura geografica. | Aceptado | Postergado Etapa 1: el selector de comunas ya esta filtrado a Chile en el frontend; la validacion cruzada geografica se implementara cuando los modulos operativos lo requieran. |
| QA-ENT-007 | Media | Eliminacion / Regla R7 | `countEntidadUsos` siempre retorna 0; la proteccion contra referencias operacionales queda como placeholder. | `entidades.repository.ts:201-204`. | Implementar conteos reales a medida que existan modulos consumidores, o documentar explicitamente que R7 queda postergada hasta esos FKs. | Aceptado | Postergado: no existen modulos operativos con FK a Entidad aun. Se implementara en Etapa 2+ cuando existan compras/ventas/productores. |
| QA-ENT-008 | Media | Frontend / Atomicidad | En alta, la UI exige al menos una direccion principal y crea entidad primero, luego direcciones/contactos en requests separados. | `entidad-form.tsx:442-470`. Si falla un subrecurso, queda la entidad base creada parcialmente. | Alinear regla de obligatoriedad con el spec y usar endpoint transaccional o compensacion si el alta inicial incluye subrecursos obligatorios. | Listo para re-test | 2026-07-22 Claude: `createMutation` en `entidad-form.tsx` envuelve la creacion de subrecursos en try/catch; si falla cualquier direccion o contacto, llama `entidadesService.remove(created.id)` para compensar antes de re-lanzar el error. |
| QA-ENT-009 | Alta | Tests | No hay tests CA1-CA9 para reglas criticas del maestro. | Busqueda de suites especificas no muestra cobertura; solo se validaron builds y smoke manual. | Agregar tests backend para R1-R9/CA1-CA9 y pruebas UI de alta/edicion/subgrids. | Abierto | Pendiente. |

## 10e. Regresión Cierre Comercial y Solicitud de Inspección 2026-07-25

**Cierre Comercial:** aprobado sin regresiones nuevas. El cambio directo solo
amplía a 500 el límite del listado; 71/71 integraciones y ambos builds pasan.

**Solicitud de Inspección — ampliación Documento 107:** no aprobada todavía
para cierre QA. Se registraron cuatro hallazgos:

- `QAS-SI-014` Alta: los nuevos vínculos no participan en las reglas de bloqueo
  de soft-delete de maestros.
- `QAS-SI-015` Alta: no hay pruebas funcionales que ejerciten los nuevos campos
  y multiselects.
- `QAS-SI-016` Media: los correos omiten todos los nuevos datos del Documento
  107.
- `QAS-SI-017` Alta: Calificación no tiene índice único parcial de código.

### Resolución — Claude (2026-07-26)

Los cuatro hallazgos quedaron corregidos: bloqueo de softdelete extendido
(mercado/país/variedad/calibre/categoría/calificación + cliente extranjero de
Entidad, vía un nuevo modo `viaSolicitud` en el sistema genérico de
referencias); 10 tests de integración nuevos contra Postgres
(`solicitudes.integration.test.ts`); correos de la solicitud ahora incluyen
todos los campos del Documento 107; e índice único parcial de código agregado
a `calificaciones` (y de paso a `formas_pago`/`condiciones_pago`, mismo vacío
introducido en la misma sesión). Detalle completo en
`Docs/Hallazgos/solicitud-inspeccion.md`. Verificación: 81/81 integración,
7/7 unitarias, builds y `tsc` limpios en ambos repos.

Validación técnica: 7/7 unitarias, 71/71 integración, Prisma válido, 30
migraciones al día, build API OK y build web OK con 82 páginas. Detalle en
`Docs/Hallazgos/solicitud-inspeccion.md`.

**Re-test 2026-07-25 (Codex):** QAS-SI-014 a QAS-SI-017 cerrados y verificados.
La suite específica nueva aporta 10 casos; integración queda 81/81, Prisma
válido, 31 migraciones al día y ambos builds correctos. Se abre QAS-SI-018
(media): `config.service.test.ts` conserva una expectativa de cuatro argumentos
para `countActiveReferences`, pero el servicio ahora invoca cinco al agregar
`viaSolicitud`; por ello la suite unitaria termina 6/7 con una falla. La rama no
queda completamente verde hasta actualizar esa prueba.

**Re-test final 2026-07-25 (Codex): QAS-SI-018 cerrado.** La expectativa
unitaria fue actualizada y la ejecución completa queda verde: 7/7 unitarias,
81/81 integración, Prisma válido, 31 migraciones al día, build API OK y build
web OK con 82 páginas. La ampliación de Solicitud de Inspección queda aprobada
para pruebas funcionales de usuario.

**Resolución QAS-SI-018 — Claude (2026-07-26):** actualizada la expectativa en
`tests/config.service.test.ts` para incluir el 5º argumento (`viaSolicitud`,
`undefined` en este caso). 7/7 unitarias OK, 81/81 integración, build limpio.
Rama completamente verde.

## 10f. Auditoría de hallazgos abiertos de pruebas 2026-07-25

Se cruzaron los hallazgos históricos con las suites actuales y se ejecutaron
las pruebas disponibles:

- Unitarias: 7/7 OK.
- Integración PostgreSQL: 81/81 OK.
- Solicitud de Inspección (`QAS-SI-010`/`QAS-SI-015`): **cerrado**; existe
  suite específica con 10 casos.
- Mantenedores (`QAS-MG-009` y DoD CA1–CA11): **parcial**. Ya existen 7
  unitarias, 5 integraciones específicas y cobertura HTTP de CRUD/auditoría/
  niveles, pero no están cubiertos todos los CA4–CA11.
- Usuarios/Perfiles (`QA-UP-010`): **parcial**. HTTP cubre autenticación,
  protección anónima, LECTURA/TOTAL y cambio de contraseña, pero no una matriz
  completa CA1–CA10 para perfiles, usuarios, soft-delete y `/me/menu`.
- Entidades (`QA-ENT-009`): **abierto**. No existe suite funcional específica
  para CA1–CA9.
- `QA-DOC-011`: sigue siendo una inconsistencia documental del plan de Reclamos
  (CA1–CA8 versus CA1–CA10), no una suite ejecutable del módulo.

No se encontraron suites frontend automatizadas; los builds validan tipos y
rutas, pero no sustituyen pruebas de interacción UI.

## 12. Bug de despliegue — login roto en navegadores sin stack local (2026-07-24)

Reportado por un segundo usuario probando el demo de Coolify: se loguea (o
aparenta loguearse) pero no ve ningún dato en ninguna pantalla — no es un
problema de perfil/permisos (ambos usuarios comparten la misma cuenta), ni de
PostgreSQL/datos distintos. Diagnóstico de Codex + verificación de Claude:

| ID | Severidad | Area | Hallazgo | Evidencia | Esperado | Estado | Accion Claude |
|---|---|---|---|---|---|---|---|
| QA-INFRA-001 | Bloqueante | Despliegue / Auth | `docker-compose.demo.yml` nunca declara `NEXT_PUBLIC_APP_URL` como build arg del servicio `web`, pese a que `WEB_PUBLIC_URL` ya existe como variable sin usar. `fas-web/src/lib/auth-client.ts` usa `NEXT_PUBLIC_APP_URL` (con default `'http://localhost:3000'`) como `baseURL` para el login. Al faltar la variable, el bundle de producción queda con el login apuntando literalmente a `http://localhost:3000` en vez del dominio público real. | `docker-compose.demo.yml` (bloque `web.build.args`, solo pasaba `NEXT_PUBLIC_API_URL`); `fas-web/Dockerfile` (solo declaraba `ARG`/`ENV` para `NEXT_PUBLIC_API_URL`); `fas-web/src/lib/auth-client.ts`. Esto explica por qué funciona en la máquina del desarrollador (tiene su propio stack Docker corriendo en `localhost:3000`, así que la request "rota" cae por accidente en el stack local) pero falla en cualquier otro navegador que no tenga nada en su propio `localhost:3000`. | El bundle debe embeber la URL pública real del frontend para que el cliente de Better Auth arme las requests de login contra el dominio correcto. | Corregido | 2026-07-24 Claude: agregado `ARG`/`ENV NEXT_PUBLIC_APP_URL` en `fas-web/Dockerfile`; agregado `NEXT_PUBLIC_APP_URL: ${WEB_PUBLIC_URL}` a `web.build.args` y `INTERNAL_API_URL: http://api:3001` a `web.environment` en `docker-compose.demo.yml`. Pendiente: falta reconstruir (`--build`) el recurso `fas-web` en Coolify y confirmar que la UI de Coolify tenga las mismas variables si no usa este compose file directamente. |
| QA-INFRA-002 | Media | Despliegue | `INTERNAL_API_URL` (usada por `fas-web/src/app/api/auth/[...all]/route.ts` para hablarle a la API por la red interna de Docker) nunca se declaraba en `docker-compose.demo.yml`; el proxy caía al fallback público (`NEXT_PUBLIC_API_URL`), funcional pero innecesariamente indirecto (sale a internet y vuelve a entrar en vez de usar la red interna `coolify`/compose). | `fas-web/src/app/api/auth/[...all]/route.ts:9-11`; `docker-compose.demo.yml` (bloque `web`, sin `environment.INTERNAL_API_URL`). | El proxy de auth debe usar el hostname interno de Docker (`http://api:3001`), no rebotar por la URL pública. | Corregido | 2026-07-24 Claude: agregado junto con QA-INFRA-001. |
| QA-INFRA-003 | Bloqueante | Despliegue / Auth | Tras QA-INFRA-001 el login ya funcionaba (verificado con DevTools: `POST /api/auth/sign-in/email` → 200, cookie seteada correctamente para el dominio del frontend), pero **todas las demás llamadas de datos** (mantenedores, ventas, compras, etc.) seguían fallando con 401 (confirmado en vivo: `GET https://a1ipcr987qbb5ffqcz5lvb05.../api/config/temporadas` → 401 Unauthorized). Causa: `src/lib/api.ts` apuntaba directo a `NEXT_PUBLIC_API_URL` (el dominio de fas-api), un dominio distinto al del frontend donde se guardó la cookie. Como fas-web y fas-api son subdominios `sslip.io` independientes, el navegador nunca comparte la cookie entre ambos (no hay dominio raíz común compartible). Explica por qué en la máquina del desarrollador "andaba" (cookie vieja cacheada directo contra el dominio de la API de alguna prueba anterior) y en cualquier navegador nuevo (confirmado reproducible en Chrome y Edge del propio usuario) fallaba todo. | `fas-web/src/lib/api.ts` (antes: `prefix: NEXT_PUBLIC_API_URL`); captura DevTools del usuario mostrando `Request URL` apuntando al dominio de la API con `Status 401`, mientras el login sí mostraba `Set-Cookie` correcto para el dominio del frontend. | Todas las llamadas del navegador deben ir al mismo dominio que sirve el login, para que la cookie de sesión viaje con ellas. | Corregido | 2026-07-24 Claude: agregado proxy genérico `fas-web/src/app/api/[...path]/route.ts` (mismo patrón que el proxy de auth); `src/lib/api.ts` cambiado a `prefix: '/api'` (relativo, mismo origen); actualizados 4 constructores de URL de descarga que también apuntaban directo a `NEXT_PUBLIC_API_URL` (`contratos`, `usuarios` avatar, `articulos` documentos, `solicitudes` adjuntos). Verificado end-to-end contra contenedores locales: login vía proxy (200, cookie) + `GET /api/config/temporadas` con esa cookie (200, datos reales) — antes del fix esa segunda llamada daba 401. Pendiente: confirmación del segundo usuario tras el rebuild en Coolify. |
| QA-INFRA-004 | Bloqueante | Frontend / Layout | Reportado por el usuario: al crear una Entidad, el listado mostraba "1 row(s) total" en la paginación pero **ninguna fila visible** (ni siquiera el header de columnas), en el server y con cualquier tema. Diagnóstico completo con el usuario (Network: JSON de respuesta correcto y completo; Elements: el `<table>` renderizado tenía la fila con todos los datos correctos; Computed: color de texto normal, sin problema de contraste) descartó datos faltantes y bug de tema — era **layout roto**: `DataTable` (`src/components/ui/table/data-table.tsx`) depende de una cadena `flex flex-1` desde `PageContainer` hasta el `div.absolute.inset-0` que envuelve la tabla real; `entidad-listing-client.tsx` y `productor-listing-client.tsx` insertaban un `<div className='space-y-3'>` (bloque normal, no flex) entre ambos para poder poner un filtro arriba de la tabla, rompiendo la cadena — la tabla quedaba con altura real 0px (visible en el DOM, invisible en pantalla). El mismo patrón (`<div className='space-y-3'>` envolviendo filtro + `DataTable`) se encontró en 8 listados, incluyendo los 3 construidos en esta sesión (Nota de Venta, Instructivo de Embalaje, Orden de Compra) y otros preexistentes (Artículos, Tipos de Movimiento, Solicitudes de Inspección). | `src/features/entidades/components/entidad-listing-client.tsx:56`, `src/features/productores/components/productor-listing-client.tsx:69`, y 6 archivos más (ver Accion Claude). Contraste: `mercados-table/index.tsx` y el resto de mantenedores simples retornan `<DataTable>` como hijo directo de `PageContainer`, sin wrapper — por eso nunca tuvieron el problema. | Cualquier listado con filtro arriba de la tabla debe mantener la cadena `flex-1` intacta para que `DataTable` obtenga altura real. | Corregido | 2026-07-24 Claude: cambiado `<div className='space-y-3'>` → `<div className='flex flex-1 flex-col space-y-3'>` en los 8 archivos afectados. `tsc`/`build` limpios en ambos repos. |

## 13. QAS-SI-008 — Auth mock reemplazado por permisos reales (2026-07-26)

Deuda transversal documentada desde 2026-07-23 (afecta a todo el frontend, no
solo a Solicitud de Inspección): `usePuedeEscribir`/`usePuedeLeer` leían
`MOCK_ACCESOS` (`src/lib/mock-session.ts`), un mapa hardcodeado con strings de
ítem inventados (`'config.paises'`, `'productores.contrato'`, etc.) que no
correspondían a ningún `ItemMenu.codigo` real del backend.

**Corregido — Claude 2026-07-26:** `mock-session.ts` eliminado. Nuevo
`src/contexts/menu-acceso-context.tsx` (`MenuAccesoProvider`, montado junto a
`TemporadaProvider` en `providers.tsx`) trae `GET /api/config/me/menu` real
vía TanStack Query. `use-item-acceso.ts` reescrito para leer de ahí. Los ~22
strings de ITEM ad-hoc en 32 archivos frontend se corrigieron a los códigos
reales del backend (verificados contra `const ITEM = '...'` de cada
`*.routes.ts`). `prisma/seed.ts` re-ejecutado para sincronizar el perfil
ADMIN con `TOTAL` en los 30 ítems de menú (no pierde acceso). Cambio de
comportamiento esperado: usuarios con perfiles no-ADMIN ahora ven solo lo que
su `PerfilAcceso` real permite. `Entidades`/`Perfiles` siguen sin gating de
permisos en el frontend — brecha preexistente distinta, fuera de este fix.
Verificación: `tsc`/build limpios en `fas-web`, 81/81 integración y 7/7
unitarias sin cambios en `fas-api` (no se tocó backend). Detalle completo en
`Docs/Hallazgos/solicitud-inspeccion.md`.

## 14. Revisión actual de hallazgos de pruebas 2026-07-26

Ejecución local: 7/7 unitarias, 81/81 integración, Prisma válido, 31
migraciones al día y builds API/web correctos (82 páginas).

Estado:

- Solicitud de Inspección: suites y hallazgos de cobertura cerrados.
- Cierre Comercial, Compras, Productores y Artículos: cobertura existente
  ejecutada en verde.
- Mantenedores Generales: parcial; faltan casos contractuales CA4–CA11.
- Usuarios/Perfiles: parcial; falta completar CA1–CA10.
- Entidades: abierto; continúa sin suite específica CA1–CA9.
- Frontend: no hay runner de pruebas de interacción. El nuevo contexto de
  permisos reales compila, pero no tiene test automatizado.

Hallazgo funcional relacionado: la sustitución del mock de permisos está
correctamente aplicada a los módulos que usan `useItemAcceso`, pero
Entidades/Perfiles siguen sin gating visual propio, brecha ya documentada en
la resolución QAS-SI-008.
