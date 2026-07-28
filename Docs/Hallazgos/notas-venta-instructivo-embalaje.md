# QA — Nota de Venta e Instructivo de Embalaje

> Revisión Codex: 2026-07-24. Fuentes: `Docs/ventas.md` y
> `Docs/compras.md`.

## Resultado

**Aprobado para pruebas funcionales de usuario.** El backend mantiene sus 64
pruebas de integración aprobadas y el frontend ya incluye listado, alta y
detalle/edición para ambos módulos. El build genera correctamente las seis
rutas. No quedan hallazgos abiertos.

## Hallazgos

| ID | Severidad | Estado | Hallazgo / evidencia |
|---|---|---|---|
| NV-IE-001 | Bloqueante | Cerrado | Se implementaron listado, alta y detalle/edición para Nota de Venta y listado, alta y detalle de solo lectura para Instructivo de Embalaje. Las rutas coinciden con el seed/menú y son generadas por el build de Next. |
| NV-IE-002 | Alta | Descartado | La regla no corresponde al Instructivo de Embalaje. |
| NV-IE-003 | Alta | Descartado | El Instructivo de Embalaje no bloquea la edición ni eliminación de la NV; la restricción corresponde al futuro Instructivo de Embarque. |
| NV-IE-004 | Alta | Cerrado | Se verificaron validaciones de vigencia, tipo de cliente, pertenencia de dirección y puerto, artículo activo y consistencia de mantenedores por especie. |
| NV-IE-005 | Bloqueante para datos existentes | Aceptado | El responsable confirmó que todavía no existen datos transaccionales; la migración destructiva se acepta para este ambiente y momento del proyecto. |
| NV-IE-006 | Media | Cerrado | `Docs/compras.md` y la implementación usan `notaVentaId → NotaVenta`. |
| NV-IE-007 | Alta | Cerrado | Se incorporaron cinco pruebas funcionales en `ventas-compras.integration.test.ts`; suite de integración completa 64/64 OK. |
| NV-IE-008 | Baja | Descartado | El usuario confirmó que la denominación correcta es **“Cierre Comercial”**. La implementación visible y el seed ya utilizan ese nombre; la premisa original del hallazgo era incorrecta. |

## Resolución (Claude, 2026-07-24)

- **NV-IE-002 / NV-IE-003 — Descartado.** Confirmado con el usuario (product owner): *"Instructivo de embalaje no bloquea cierre de ventas"*. La regla R3 de `ventas.md` ("la NV solo puede borrarse/editarse sin restricciones si no tiene Instructivo asociado") se refiere al **Instructivo de Embarque** (`Embarque`, ventas.md §4.2 — no implementado, fuera de alcance por preguntas abiertas §10), no al **Instructivo de Embalaje** (`compras.md` §4.1, lo que sí se implementó). Ambos documentos comparten la palabra "Instructivo" pero son entidades distintas y sin relación de herencia definida entre sí (`compras.md` §3: "no confundir con el Instructivo de Embarque"). No existe ningún R# que defina campos heredados entre `NotaVenta` e `InstructivoEmbalaje`. Se agregó un test de regresión (`ventas-compras.integration.test.ts`) que confirma explícitamente que editar/eliminar una NV con Instructivo de Embalaje asociado está permitido, para dejar la decisión de negocio blindada ante refactors futuros.
- **NV-IE-004 — Corregido.** `notas-venta.repository.ts` e `instructivo-embalaje.repository.ts`: todas las consultas de mantenedores (`TipoEmbarque`, `Mercado`, `Pais`, `Puerto`, `Moneda`, `Especie`, `Variedad`, `Categoria`, `TipoPallet`, `Calibre`) pasaron de `findUnique` a `findFirst` filtrando `eliminadoEn: null, bloqueado: false`. `getEntidadTipos` ahora filtra `eliminadoEn: null, activo: true` y sí se usa en `validarReferenciasHeader` (nuevo, en `notas-venta.service.ts`): valida cliente/comprador/notify/clienteFinal existen y están activos, que el cliente tenga tipo `CLIENTE_NACIONAL`/`CLIENTE_EXTRANJERO`, que la dirección pertenezca al cliente, y que el puerto destino corresponda al país destino y al tipo de embarque seleccionados. `Articulo.activo` ahora se exige (antes se consultaba y se ignoraba) en ambos módulos. Cubierto por tests nuevos.
- **NV-IE-005 — Aceptado.** Confirmado con el usuario: *"No hay nada de datos transaccionales en la demo"* (Coolify). El riesgo señalado por Codex es válido como práctica general, pero no aplica a este despliegue: no hay filas reales en `NotaVenta`/`Cobranza`/`DocumentoDTE` legacy en ningún ambiente compartido. La migración destructiva es segura de aplicar tal como está.
- **NV-IE-006 — Corregido.** Se reconcilió `Docs/compras.md` (§3, §4.1, §4.2, §4.7, §10): todas las referencias a `cierreNegocioId`/`CierreNegocio` como nombre de campo/modelo se renombraron a `notaVentaId`/`NotaVenta`, dejando "Cierre de Negocio" como alias de negocio explícito (no como nombre de modelo Prisma). Decisión tomada junto con el usuario durante la sesión previa a la implementación.
- **NV-IE-007 — Corregido.** Se agregó `tests/integration/ventas-compras.integration.test.ts` (5 casos, contra `fas_test` real): folios correlativos, rechazo de cliente sin tipo Cliente, validación de especie/variedad/categoría/calibre y tipo Embalaje en detalle de NV, rechazo de rango de calibre invertido (compras.md §6.5), confirmación de que el Instructivo NO bloquea edición/borrado de NV, y rechazo de mantenedor bloqueado. Suite completa: `npm run test:integration` → 64/64 OK (antes 59/59).
- **NV-IE-001 — cerrado en re-test.** El frontend ya contiene las features,
  servicios y páginas esperadas. El build pasó y genera
  `/dashboard/ventas/notas`, `/nueva`, `/[id]` y
  `/dashboard/compras/instructivo-embalaje`, `/nueva`, `/[id]`.
- **NV-IE-008 — Descartado.** No existe ninguna "denominación acordada" de "Cierre de Ventas" en `Docs/` ni en el historial de esta sesión — se buscó explícitamente en `ventas.md`, `compras.md` y `seed.ts` y esa frase no aparece en ningún lado. Confirmado directamente con el usuario (2026-07-24): el nombre correcto es **"Cierre Comercial"**, tal como ya está en `seed.ts` (`VENTAS_NV`). No se modifica nada; el hallazgo de Codex parece basado en una premisa incorrecta.

## Re-test Codex (2026-07-24)

- **NV-IE-004 cerrado:** revisión estática de servicios/repositorios y casos de
  integración confirman las validaciones corregidas.
- **NV-IE-005 aceptado:** decisión de negocio basada en la inexistencia
  confirmada de datos transaccionales. Debe reevaluarse antes de aplicar esta
  migración en cualquier ambiente que ya tenga datos legacy.
- **NV-IE-006 cerrado:** el contrato técnico usa `notaVentaId`.
- **NV-IE-007 cerrado:** los cinco casos nuevos se ejecutaron satisfactoriamente.
- **NV-IE-008 descartado:** el usuario confirmó que el nombre correcto es
  “Cierre Comercial”, tal como aparece en la implementación.

## Re-test NV-IE-001 (2026-07-24)

| Verificación | Resultado |
|---|---|
| Listado, alta y detalle/edición de Nota de Venta | OK |
| Listado, alta y detalle de Instructivo de Embalaje | OK |
| Servicios frontend conectados a endpoints backend | OK |
| Rutas alineadas con seed y navegación | OK |
| `npm run build` (`fas-web`) | OK, 76 páginas; genera las 6 rutas del módulo |

**Conclusión:** NV-IE-001 cerrado. La ejecución manual autenticada de los flujos
completos queda como prueba de aceptación de usuario y no como defecto abierto
de implementación.

## Verificación ejecutada

| Verificación | Resultado |
|---|---|
| `npm run test:run` (`fas-api`) | 7/7 OK |
| `npm run test:integration` | 64/64 OK; incluye 5 casos funcionales NV/IE |
| Protección anónima de ambas rutas | OK, 401 |
| Migración en `fas_test` | Aplicada; 25 migraciones al día |
| `npx prisma validate` | OK |
| `npx prisma migrate status` (desarrollo) | 25 migraciones al día |
| `npm run build` (`fas-api`) | OK |
| `npm run build` (`fas-web`) | OK, 76 páginas; incluye las seis rutas del módulo |

## Alcance diferido aceptado

Embarque, Instructivo de Embarque y Solicitud de Reserva permanecen fuera de
esta revisión, conforme a las preguntas abiertas declaradas en `ventas.md`.

## Regresión Cierre Comercial — Codex (2026-07-25)

El cambio directo del módulo amplía el límite máximo del listado de 100 a 500
registros para alimentar selectores dependientes. No altera creación, edición,
validaciones, correlativo ni permisos.

- Suite de integración completa: 71/71 OK.
- Prisma y 30 migraciones: OK.
- Builds API/web: OK.
- Las rutas de Cierre Comercial continúan presentes.

**Resultado:** sin regresiones nuevas detectadas en Cierre Comercial.

## Verificación runtime en Docker (Claude, 2026-07-24)

Al probar el flujo real contra los contenedores de desarrollo (`fas_api`,
`fas_web`, ya corriendo hace ~20h antes de esta sesión) se encontró y corrigió
un problema de **entorno, no de código**: `node_modules` de `fas_api` es un
volumen Docker nombrado (no bind-mount), por lo que el Prisma Client generado
adentro seguía correspondiendo al schema legacy anterior a esta migración.
`GET /api/ventas/notas-venta` devolvía 500 (`PrismaClientValidationError:
Unknown argument eliminadoEn`) hasta ejecutar `docker exec fas_api npx prisma
generate` + `docker restart fas_api`. Tras el fix, verificado con sesión real
autenticada (`admin@agrosanexp.com`):

```
POST /api/auth/sign-in/email          → 200
GET  /api/ventas/notas-venta          → 200 {"data":[],"meta":{...}}
GET  /api/compras/instructivos-embalaje → 200 {"data":[],"meta":{...}}
```

No es un hallazgo de código — es un recordatorio operativo: tras cambios de
schema Prisma, cualquier contenedor con `node_modules` en volumen propio
necesita `prisma generate` + restart, no solo el bind-mount de `src/`.

Pendiente de verificación visual en navegador (sin datos de Cliente/Mercado/
Artículo-Embalaje en la BD de desarrollo todavía) — queda para cuando el
usuario retome la sesión con la extensión de Chrome conectada.

## Regresión Cierre Comercial — Mercado → País (Codex, 2026-07-26)

| ID | Severidad | Estado | Hallazgo / evidencia | Resultado esperado |
|---|---|---|---|---|
| NV-IE-009 | Alta | Validado | Backend y frontend comprueban/filtran la pertenencia mercado–país. El nuevo caso automatizado confirma que un país de otro mercado es rechazado con 422. | Mantener la regresión en la suite. |
| NV-IE-010 | Alta | Validado | Fixture adaptado: crea Mercado y luego País con `mercadoId`. Los 11 casos del archivo pasan, incluyendo la nueva regresión NV-IE-009. | Resuelto. |

**Ejecución:** build API y web correctos; suite unitaria 7/7; integración
global 61/81, con 20 fallas concentradas en los fixtures de Cierre
Comercial/Orden de Compra y Solicitud de Inspección. La regresión no está
aprobada todavía.

### Corrección (Claude, 2026-07-27)

- **NV-IE-009:** `validarReferenciasHeader` (`notas-venta.service.ts`) ahora
  compara `paisDestino.mercadoId` (repo `getPais` ya lo selecciona) contra
  `r.mercadoId` efectivo y lanza `ValidationError('El país destino no
  pertenece al mercado seleccionado')` si no coinciden — aplica tanto en
  creación como en edición, porque ambas ya pasaban por el mismo objeto
  `efectivo`/`body` fusionado con el registro existente.
- **NV-IE-010:** no corregido — requiere editar
  `ventas-compras.integration.test.ts`, y Claude no edita archivos de test
  bajo ninguna circunstancia. Pendiente para Codex o el usuario.

### Re-test Codex (2026-07-27)

La implementación de NV-IE-009 es coherente por revisión estática, pero no se
cierra sin prueba ejecutable. La suite del archivo queda **0/10** por
NV-IE-010. Resultado global: unitarias 7/7, integración 61/81 y builds
API/web correctos. Cierre Comercial todavía no queda aprobado.

### Ejecución tras actualizar tests — Codex (2026-07-27)

`ventas-compras.integration.test.ts`: **11/11 OK**, incluyendo rechazo 422
para Mercado–País incompatible. NV-IE-009 y NV-IE-010 quedan validados.

### Re-verificación (Claude, 2026-07-27)

Confirmado sin tocar la suite: `ventas-compras.integration.test.ts` +
`solicitudes.integration.test.ts` → **23/23 OK**. NV-IE-009/010 se dan por
cerrados. (Ver `mantenedores-generales.md` — QAS-MG-MP-005 — para una
regresión distinta que este mismo cambio introdujo en otras 3 suites de
integración no relacionadas con Cierre Comercial.)

## Cierre Comercial v1 — CondicionPago + rango de calibre (Codex, 2026-07-27)

Alcance: reemplazo de `formaPagoId`/`saldoPagoId` (sueltos) por
`condicionPagoId` (FK a `CondicionPago`, snapshot inmutable de cuotas) y del
multiselect de calibres por rango `calibreInicioId`/`calibreFinId`;
`modalidadVentaId`/`clausulaVentaId`/`tipoFleteId` pasan a FK real de
`Parametro`. Detalle completo de la decisión y del contrato en `ventas.md`
§4.1 (supersesión) y R12. 4 rondas QA + 1 arbitraje.

| ID | Severidad | Estado | Hallazgo / evidencia |
|---|---|---|---|
| CCOM-QA-001 | Alta | Postergado (decisión de negocio) | La suite `ventas-compras.integration.test.ts` no cubre las invariantes nuevas (condición de pago, pertenencia de parámetros a su `TipoParametro`, rango de calibre invertido en NV, inmutabilidad del snapshot). Arbitrado como `AMBIGUO` en ronda 2 (el contrato aún no estaba formalizado en el spec); tras formalizarlo, el usuario decidió explícitamente **"spec ahora, tests después"** — queda como gap conocido y aceptado, no como defecto de código. Pendiente para Codex o el usuario, igual que NV-IE-010. |
| CCOM-QA-002 | Media | Corregido | El preview de cuotas de la Forma de Pago no reaccionaba a cambios en modo edición y no se ocultaba al limpiar la selección ("Sin definir"). Corregido en `nota-venta-form.tsx`: prioriza la condición actualmente seleccionada, cae al snapshot persistido solo si no cambió, y produce `[]` si `condicionPagoId` es `null`. |
| CCOM-QA-003 | Alta | Corregido | El repository regeneraba el snapshot de cuotas en cualquier PATCH que incluyera `condicionPagoId`, aunque no hubiera cambiado — rompiendo la inmutabilidad de R12. Corregido en `notas-venta.repository.ts`: compara contra el valor persistido dentro de la transacción y solo regenera si difiere. |

**Excepción documentada:** para CCOM-QA-001, el usuario autorizó explícitamente
un arreglo *mínimo* del archivo de test (quitar el `TRUNCATE` de la tabla
eliminada y migrar `calibreIds` → `calibreInicioId`/`calibreFinId`, sin lo
cual la suite ni siquiera corría) como excepción puntual a la regla "Claude no
edita archivos de test". La cobertura *nueva* que pide Codex no se agregó — se
mantiene la regla por defecto para ese trabajo, igual que en NV-IE-010.

**Verificación:** `npx tsc --noEmit` (API y web) OK; `npm run build` (API y
web) OK; `npx prisma validate` OK; `npm run test:integration` → 84/84 OK tras
cada corrección. Migraciones `20260727185626_...` y
`20260727193500_...` aplicadas en `fas_db` y `fas_test`.

**Resultado:** ciclo cerrado sin aprobación formal de Codex — bloqueado
únicamente por CCOM-QA-001, que es un gap de cobertura aceptado
conscientemente, no un defecto. Reabrir cuando se decida agregar esa
cobertura.

### Intento de Tests finales (Codex, 2026-07-27)

`qa-ejecutar-tests` se ejecutó solicitado explícitamente por el usuario pese
al `NO_APROBADO` de ronda 4. Resultado: **`TESTS_BLOQUEADOS`** — Codex detectó
la contradicción entre el prompt ("ronda 4 fue aprobada") y el dictamen real
del informe, y se negó a correr suites bajo una aprobación inexistente. 0
pruebas ejecutadas, ningún archivo modificado. Confirma que la fase de tests
finales permanece bloqueada mientras `CCOM-QA-001` siga abierto como hallazgo
formal.

### Arbitraje ronda 4 — CCOM-QA-001 (Codex, 2026-07-27)

Solicitado por el usuario, enfocado en CCOM-QA-001, con el contexto explícito
de que la falta de cobertura adicional fue aceptada como decisión de negocio.
Veredicto: **`AMBIGUO`** — el árbitro confirma la brecha de cobertura pero
señala que `ventas.md` §9 (plan de tests) no exigía expresamente probar R12,
por lo que no puede clasificarlo como incumplimiento contractual ni como
`NO_ES_BUG`. Acción sugerida: decidir si §9 debe exigir esa cobertura.

**Resolución (Claude, 2026-07-27):** se actualiza `ventas.md` §9 con una nota
explícita — la cobertura de integración de R12 (Cierre Comercial v1) **no es
exigida** por esta sección; queda formalmente diferida por decisión del
usuario. Con esto, `CCOM-QA-001` deja de ser una ambigüedad de spec: es un gap
de cobertura conscientemente aceptado, documentado en el spec mismo. No
requiere una quinta ronda QA — el estado del código no cambió, solo se cerró
la ambigüedad documental que impedía clasificarlo con precisión.

### Tests finales — TESTS_OK (Codex, 2026-07-27)

Tras habilitar acceso real a Docker en el sandbox de la fase de tests y pedir
comparación de lint contra `main` (ajuste a `run-codex-stage.sh`), se repitió
la validación final. Resultado: **`TESTS_OK`**.

- Integración API/PostgreSQL: 84/84 OK (6 suites).
- Unitarios API: 7/7 OK.
- Total: 91/91, 0 fallidas, 0 omitidas.
- `prisma validate`, typecheck API/web, `git diff --check`: OK.
- `fas_postgres` activo y saludable; ningún archivo modificado por la validación.
- Único hallazgo de lint (`react-hooks/set-state-in-effect`,
  `nota-venta-form.tsx`) comparado línea por línea contra `main`: ya existía
  antes de esta implementación — deuda preexistente, no regresión del
  alcance.

**Cierre del ciclo:** Cierre Comercial v1 (CondicionPago + snapshot de cuotas
+ rango de calibre + Parametro real para Flete/Modalidad/Incoterm) queda
validado de punta a punta — 4 rondas QA, 2 arbitrajes, Tests finales `OK`. El
único ítem pendiente es la cobertura de integración específica para el
contrato nuevo (`CCOM-QA-001`), diferida por decisión de negocio y ya
documentada en `ventas.md` §9.
