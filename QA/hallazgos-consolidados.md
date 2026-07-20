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
| QA-DOC-005 | Media | Stack/frontend | `fas-web/README.md` sigue siendo el README default de Next.js. | No describe FAS, comandos reales, variables ni decisiones de proyecto. | Actualizar README del frontend cuando el scaffold madure para reflejar stack, scripts y contexto FAS. | Pendiente | README fuera de alcance; se actualizara con el scaffold. |
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
| UP-DOD-05 | Tests CA1-CA10 en verde. | No cumple | No se encontraron tests del modulo. |
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
| QA-UP-009 | Media | Frontend / Alcance | Avatar y cambio de password no cumplen completamente el spec UI. | Usuario usa campo `URL de Avatar`; no se encontro pantalla/accion de cambio de password en UI aunque existe endpoint. | UP7 pide upload a storage y el spec pide cambio de contrasena en pantalla aparte. | Abierto | Re-test Codex 2026-07-19: sigue pendiente; continua URL manual de avatar y no hay pantalla de cambio de contrasena. |
| QA-UP-010 | Alta | Tests | No hay tests CA1-CA10 para perfiles, usuarios, guard ni menu. | Busqueda en `fas-api/src`/`fas-web/src` no muestra suites del modulo; builds pasan, pero no cubren reglas de seguridad. | Agregar tests de backend para CA1-CA10 y, al menos, pruebas de UI/servicios para flujos principales. | Abierto | Re-test Codex 2026-07-19: sigue sin suites para perfiles, usuarios, guard o `/me/menu`. |

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
| QA-AUTH-005 | Media | QA / Credenciales seed | No hay credenciales admin documentadas para reproducir login de `admin@agrosan.cl`. | Existe `User`/`Usuario` admin y cuenta credential con password hash; varios passwords comunes probados retornan 401. | Documentar credenciales seed de desarrollo o entregar script seguro para resetear password admin local. | Cerrado | 2026-07-20 Claude: usuario admin creado con credenciales conocidas durante implementacion de login. Email: `admin@agrosan.cl`, password: `Admin1234!` (solo desarrollo). |
