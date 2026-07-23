# Productores — Spec vigente + Notas de implementación

> Implementado: 2026-07-23. Autor: Claude. Spec fuente: `Docs/productores.md`.

## 1. Alcance implementado

La ficha central del productor, sin dependencias pendientes:

1. **Predios** (`Predio`) — mantenedor por productor (R1/R2).
2. **Contrato** (`ProductorContrato` + PDF) — múltiples por productor, condiciones controladas, bloqueado por representante legal (R3).
3. **Cuenta Corriente** (`MovimientoCuentaCorriente`) — informe con saldo, movimientos inmutables, naturaleza validada contra el concepto (R5/R6).
4. **Conceptos de Liquidación** (`ConceptoLiquidacion` + matriz por especie) — bajo `/api/config/conceptos-liquidacion`, con "Nuevo Productor" duplicando el patrón del resto de mantenedores.

**No implementado (diferido, dependencias no construidas):**
- **§4.2 Solicitud de Pago** — depende de `CuotaDocumentoCompra` (Compras, no construido).
- **§4.3 Proforma de Servicios a Productores** — depende de `cobranza.md` (Ventas Nacionales, no construido).
- Tests automatizados (CA1-CA10) — a cargo de Codex.

## 2. Decisiones tomadas durante la implementación

| # | Tema | Decisión |
|---|---|---|
| P1 | `TipoCuentaCorriente` → `ConceptoCtaCte` | El spec de `productores.md` referencia un modelo `TipoCuentaCorriente`, pero ese maestro ya fue renombrado a `ConceptoCtaCte` en el Lote 3 de Mantenedores Generales. `MovimientoCuentaCorriente.tipoId` FK a `ConceptoCtaCte` (el modelo vigente), no al nombre que aparece en el spec. |
| P2 | PDF del contrato | Mismo patrón que adjuntos de Solicitud de Inspección y documentos de Materiales: metadatos (`pdfNombre`/`pdfMime`/`pdfTamano`) en `ProductorContrato`, binario en tabla separada `ProductorContratoPdf` (`Bytes`). Límite 15 MB, solo `application/pdf`. |
| P3 | R3 — Representante legal | Se interpretó "bloquear operaciones que lo requieran" como: **crear un Contrato** exige que el productor tenga ≥1 `EntidadContacto` con `esRepresentanteLegal=true` (validación de RUT ya existe en el módulo Entidades, R9). No se bloqueó la creación de Predios ni la Cuenta Corriente, ya que el spec no lo exige explícitamente para esas operaciones. |
| P4 | Predio.codigo único por productor | Sin `@unique` a nivel de columna Prisma (sería global); se agregó índice único parcial `ux_predios_entidad_codigo` sobre `(entidadId, codigo) WHERE eliminadoEn IS NULL`, mismo patrón que el resto de mantenedores. |
| P5 | Ítems de menú | Se reutilizaron `PROD_FICHA`, `PROD_CONTRATO`, `PROD_CTA_CTE`, `PROD_CONCEPTOS_LIQ` — ya existían en el seed apuntando a rutas de Productores. |
| P6 | Conciliación ruta ficha vs. nav plano | El spec define rutas anidadas (`/:entidadId/predios`, etc.) y el nav ya tenía una entrada plana `/dashboard/productores/cuenta-corriente`. Se implementó la ficha completa (con pestañas Predios/Contrato/Cuenta Corriente) en `/dashboard/configuracion/productores/[id]`, y la ruta plana del nav es un selector de productor que redirige a la ficha con `?tab=cuenta-corriente` — mismo patrón conciliador usado en Materiales/Recetas. |

## 3. Implementación

**Backend (`fas-api`):**
- `prisma/schema.prisma`: enums `UnidadVolumen`, `NaturalezaMovimientoCC`, `FormaAplicacionConcepto`, `NaturalezaConcepto`; modelos `Predio`, `ProductorContrato`(+`Pdf`), `MovimientoCuentaCorriente`, `ConceptoLiquidacion`(+`Especie`). Back-relations en `Entidad`, `Comuna`, `TipoProduccion`, `Zona`, `Temporada`, `Moneda`, `ConceptoCtaCte`, `Especie`. Migraciones `20260723220909_add_productores_module` + índice parcial `20260723221000_add_unique_partial_index_predio_codigo`.
- `src/modules/productores/{predios,contratos,cuenta-corriente}/` + `productores.routes.ts` (ficha + listado).
- `src/modules/config/conceptos-liquidacion/` (prefijo `/api/config`, como indica el spec).
- Todas las FKs a Entidad validan `tipos.includes('PRODUCTOR')` antes de cualquier operación.

**Frontend (`fas-web`):**
- `features/productores/` (ficha, listado) + subfeatures `predios/`, `contratos/`, `cuenta-corriente/`.
- `features/conceptos-liquidacion/` (mantenedor con matriz por especie).
- Ficha con pestañas (Predios / Contrato / Cuenta Corriente), banner de advertencia si falta representante legal.
- Todos los triggers de creación verifican `usePuedeEscribir` (lección aplicada de ART-03 en Materiales).

## 4. Verificación

- `fas-api` build OK, `fas-web` build OK (`tsc --noEmit` limpio).
- Servidor arranca: `/health` 200, rutas nuevas 401 sin sesión.
- Páginas nuevas renderizan 200 con sesión autenticada.
- **Smoke test funcional vía API (datos de prueba quedan en la BD de desarrollo):**
  - Creada entidad PRODUCTOR `PROD-001`.
  - **R1/R2:** Predio creado; predio con código duplicado → 422. ✅
  - **R3:** Contrato sin representante legal → 422; se agrega contacto representante legal con RUT válido → contrato se crea (201). ✅
  - **R6:** Movimiento HABER con concepto `ANTICIPO` (naturaleza HABER) → OK; movimiento DEBE con el mismo concepto → 422. ✅
  - **R5b:** Informe de cuenta corriente devuelve saldo = 1000 tras el HABER. ✅

## 5. Pendiente

- Tests automatizados CA8-CA10. CA1-CA6 quedaron cubiertas en
  `fas-api/tests/integration/productores.integration.test.ts`; CA7 se verificó
  estructuralmente porque no existen rutas PATCH/DELETE para movimientos de
  cuenta corriente.
- Solicitud de Pago y Proforma de Servicios — depende de Compras y Cobranza (no construidos).
- Decisiones de Etapa 3 (§3 del spec): semántica final de "Valores de facturación" vs "Condiciones de facturación", unidad/fuente del volumen real comprometido (depende de Compras), moneda de conceptos.

## 6. Revisión QA — Maestro Productores (2026-07-23)

### Resultado

**Aprobado para cierre funcional.** Los cuatro hallazgos fueron corregidos y
revalidados formalmente por Codex en código, integración y build frontend.

> Revalidación posterior al aviso de corrección: PROD-01 a PROD-04 corregidos
> el 2026-07-23 (segunda pasada, tras el aviso "Siguen habiendo hallazgos").

| ID | Severidad | Estado | Hallazgo / evidencia |
|---|---|---|---|
| PROD-01 | Alta | **Corregido** | `productores.controller.ts#getFicha` ahora lee `req.fasAccesos.get('PROD_CONTRATO')`; si el perfil no tiene ni `LECTURA`, la respuesta devuelve `contratos: []` en vez de los datos completos. Frontend: `ContratosTab` cambió su ítem de `productores.ficha` a `productores.contrato` (permiso propio); `ProductorFichaClient` oculta la pestaña "Contrato" por completo si no hay `LECTURA` en ese ítem. Verificado con curl bajando temporalmente `PROD_CONTRATO` del perfil ADMIN a `SIN_ACCESO`: la ficha devuelve `contratos: []` mientras la ruta directa `/contratos` sigue dando 403. |
| PROD-02 | Media | **Corregido** | `ContratosTab` agrega botón de eliminar (ícono trash) por contrato + `AlertModal` de confirmación, usando `contratosService.remove` (ya existía en el backend). Gateado por el mismo permiso de escritura que crear/editar. |
| PROD-03 | Media | **Corregido** | Agregadas validaciones "FK vigente" (mismo patrón que ART-04 de Materiales: `eliminadoEn: null, bloqueado: false`) en: `predios.service.ts` (comunaId/tipoProduccionId/zonaId), `contratos.service.ts` (temporadaId), `cuenta-corriente.service.ts` (monedaId/temporadaId). Verificado con curl: cada FK con id inexistente → 422 `VALIDATION_ERROR`; con FK válida → 201. |
| PROD-04 | Media | **Corregido** | `prisma/seed.ts`: `PROD_FICHA` → `/dashboard/configuracion/productores`, `PROD_CONTRATO` → `/dashboard/productores/contrato` (página nueva), `PROD_CONCEPTOS_LIQ` → `/dashboard/configuracion/conceptos-liquidacion` (también estaba mal apuntado, aunque no se mencionó explícitamente en el hallazgo). Se creó `/dashboard/productores/contrato` como selector de productor → redirige a la ficha `?tab=contrato` (mismo patrón que Cuenta Corriente, generalizado en `ProductorTabSelectorClient`). Se agregó el link "Contrato" al nav estático (`nav-config.ts`), que antes no existía. Seed re-ejecutado contra la BD de desarrollo; rutas verificadas en `items_menu`. |

### Pruebas ejecutadas

| Verificación | Resultado |
|---|---|
| Nueva suite `productores.integration.test.ts` | 6/6 OK: CA1-CA6 |
| Inmutabilidad CA7 | OK por contrato de rutas: CC solo expone GET/POST |
| Protección anónima `/api/productores` | OK, responde 401 |
| Regresión HTTP de autorización PROD-01 | OK: sin `PROD_CONTRATO` retorna `contratos: []` |
| `npm run test:integration` final | 57/57 OK |
| `npx prisma validate` | OK |
| `npm run build` (`fas-api`) | OK |
| `npm run build` (`fas-web`) | OK |

> Re-test formal Codex completado: Productores sin hallazgos abiertos.

### Corrección Claude — 2026-07-23 (segunda pasada)

`fas-api` build OK, `fas-web` build OK (71 páginas), `npx tsc --noEmit` limpio en
ambos repos, suite de integración 56/56 OK tras el fix (sin regresiones). Seed
re-ejecutado en desarrollo. Smoke test manual de los 4 hallazgos vía curl,
incluyendo alternar temporalmente el nivel de `PROD_CONTRATO` del perfil ADMIN
para reproducir y confirmar el cierre de la fuga de PROD-01.
