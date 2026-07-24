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
