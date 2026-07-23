# Materiales — Spec vigente + Notas de implementación

> Implementado: 2026-07-23. Autor: Claude. Spec fuente: `Docs/materiales.md`.
> Construido como dependencia bloqueante de `Docs/compras.md` (Articulo es requerido por InstructivoEmbalaje/OrdenCompraLinea/PalletLinea).

## 1. Alcance implementado

Los 4 sub-módulos del §2 de `materiales.md`:

1. **Maestro de artículos** (`Articulo` + `DocumentoArticulo`) — CRUD, tipo, costeo, stock crítico, documentos adjuntos.
2. **Maestro de recetas** (`Receta` + `RecetaDetalle`) — por embalaje, componentes Material de Embalaje/Servicio.
3. **Movimientos** (`TipoMovimiento` mantenedor + `Movimiento`/`MovimientoDetalle`) — motor transaccional con PMP.
4. **Consulta de stock por receta** — analizador con estados OK/Stock Crítico/Sin Stock/Trasladar.

**No implementado (diferido, fuera del alcance pedido ahora):**
- **§4.8 Proforma de Venta de Materiales** — depende de `cobranza.md` (Ventas Nacionales / FacturaNacional), que no existe. Se deja para cuando ese módulo se construya.
- Tests automatizados (CA1-CA19) — a cargo de Codex, no de Claude (ver `feedback-qa-workflow`).

## 2. Decisiones tomadas durante la implementación

| # | Tema | Decisión |
|---|---|---|
| M1 | Documentos adjuntos (D10) | Igual que adjuntos de Solicitud de Inspección: metadatos y binario (`Bytes`) en tablas separadas dentro de la BD, no en disco. Límite 10 MB, allowlist PDF/Excel/Word/imágenes. |
| M2 | Auditoría/softdelete en Articulo/Receta/TipoMovimiento | El spec de `materiales.md` **no** define `creadoPor`/`eliminadoEn` para estos modelos (solo `activo`), a diferencia de Mantenedores Generales. Se respetó tal cual el spec (autoritativo). |
| M3 | R5 — PMP en Entrada sin precio | Si `tipoMovimiento.requierePrecio = false`, una Entrada solo suma cantidad sin recalcular el PMP (no hay precio con qué recalcular). |
| M4 | R6 — Traslado y PMP | El PMP "viaja" con la cantidad: el costo de origen se usa como precio de entrada para recalcular el PMP ponderado del destino (blend), igual que una Entrada. El origen conserva su PMP intacto (solo baja cantidad). |
| M5 | R10 — Campos obligatorios de DTE | Se exige: empresa de transporte, RUT chofer, nombre chofer, placa camión, hora de salida. Placa remolque y hora estimada de llegada quedan opcionales (no todo transporte tiene remolque o ETA conocida). |
| M6 | Ítem de menú | Se reutiliza `OPER_MATERIALES` (ya existía en el seed) para los 4 sub-módulos completos (artículos, recetas, tipos de movimiento, movimientos, saldos) — un solo nivel de acceso para todo el módulo. |
| M7 | Rutas de navegación | Se descartaron 2 páginas huérfanas basadas en mocks (`/dashboard/operaciones/materiales`, `/dashboard/operaciones/recetas`, sin link de nav) y se construyeron las páginas reales en las rutas que el nav ya tenía cableadas: `/dashboard/configuracion/articulos(+[id])`, `/dashboard/configuracion/recetas`, `/dashboard/configuracion/tipos-movimiento`, `/dashboard/operaciones/movimientos`, `/dashboard/reportes/stock-materiales`. |
| M8 | Pantalla de Recetas | El spec original define la ruta como `/articulos/[id]/recetas` (anidada bajo un embalaje). El nav de este proyecto ya apuntaba a una ruta plana `/dashboard/configuracion/recetas`. Se implementó como "selector de embalaje → recetas de ese embalaje", conciliando ambos: una sola pantalla, con el embalaje como filtro inicial en vez de ir en la URL. |

## 3. Implementación

**Backend (`fas-api`):**
- `prisma/schema.prisma`: enums `TipoArticulo`, `TipoCosteo`, `ModuloSistema`, `ClaseMovimiento`; modelos `Articulo`, `DocumentoArticulo`(+`Contenido`), `Receta`, `RecetaDetalle`, `TipoMovimiento`, `SaldoArticulo`, `Movimiento`, `MovimientoDetalle`. Back-relations agregadas a `UnidadMedida`, `Bodega`, `Entidad`. Migración `20260723214041_add_materiales_module`.
- `src/modules/materiales/{articulos,recetas,tipos-movimiento,movimientos}/` (routes/controller/service/repository/schema/types).
- Motor transaccional en `movimientos.repository.ts`: `createMovimientoTransaccional` aplica R2/R5/R6/R7/R8/R11 dentro de una única `$transaction`; `StockInsuficienteError` se traduce a 422 en el service.
- `consultarStockReceta` (R15) en `movimientos.service.ts`: expande demanda por componente (D5), siempre devuelve stock de **todas** las bodegas, el filtro solo afecta el motivo "Trasladar".
- Seed: `OPER_MATERIALES.ruta` actualizado a `/dashboard/configuracion/articulos` (apuntaba a una página eliminada).

**Frontend (`fas-web`):**
- `features/materiales/{articulos,recetas,tipos-movimiento,movimientos,stock}/` — service, queries, types, componentes.
- `ArticuloFormSheet` con validación R3/R4 y quick-create de Unidad de Medida.
- `MovimientoFormSheet`: campos condicionales según `clase` (bodega origen/destino), bloque DTE condicional (`emiteDTE`), entidad relacionada condicional, precio condicional (`requierePrecio`).
- `ConsultaStockClient`: multiselección de embalajes+cantidad, filtro de bodegas por chips, tabla de resultado con badges de estado.

## 4. Verificación

- `fas-api` build OK (`tsc`), `fas-web` build OK (`tsc --noEmit`).
- Servidor arranca: `/health` 200, todas las rutas nuevas responden 401 sin sesión.
- Las 5 páginas nuevas renderizan 200 con sesión autenticada.
- **Smoke test funcional (vía API, datos de prueba quedan en la BD de desarrollo):**
  - Creado: Unidad de Medida `UN`, Artículo `MAT-001` (Material de Embalaje, Promedio Ponderado → `controlaStock=true` confirmado, R3), Bodega `PRINCIPAL`.
  - **CA3 (R5):** Entrada 10 @ $100, luego Entrada 10 @ $200 → saldo 20, PMP **150** exacto. ✅
  - **CA5/CA19 (R2/R7):** Salida de 120 sobre saldo 20 → 422 `VALIDATION_ERROR`, saldo permanece intacto en 20 (rollback transaccional confirmado). ✅

## 5. Pendiente

- Tests automatizados CA3-CA19. CA1/CA2 y las transiciones de costeo del maestro
  Artículos quedaron cubiertas en
  `fas-api/tests/integration/articulos.integration.test.ts`.
- Proforma de Venta de Materiales (§4.8) — depende de `cobranza.md`, no construido.
- Revisar duplicación de entradas de navegación "Materiales"/"Recetas" en `nav-config.ts` (aparecen tanto bajo "Gestión Comercial" como bajo "Operaciones" — preexistente, no introducido por este trabajo, no se tocó).

## 6. Revisión QA — Maestro Artículos (2026-07-23)

### Resultado

**Aprobado para cierre funcional del Maestro Artículos.** Revalidado después de
las correcciones: los cuatro hallazgos quedaron cerrados y cuentan con regresión
automatizada.

| ID | Severidad | Estado | Hallazgo / evidencia |
|---|---|---|---|
| ART-01 | Alta | **Corregido** | `articuloCreateSchema.descripcionExtranjera` ahora acepta `.optional().nullable()`; `articuloUpdateSchema` hereda el fix vía `.partial()`. |
| ART-02 | Media | **Corregido** | Se agregó el filtro de estado (Activo/Inactivo) a `articulo-listing-client.tsx`. Backend: `activo` (y `soloActivos` en config, y `bajoCritico` en saldos) cambiado de `z.coerce.boolean()` a `z.enum(['true','false']).transform(v => v === 'true')` — el bug era sistémico (cualquier string no vacío, incluido `"false"`, se coerciona a `true`); se corrigió en las 3 ubicaciones donde aparecía, no solo en Artículos. |
| ART-03 | Media | **Corregido** | `ArticuloFormSheetTrigger` ahora verifica `usePuedeEscribir` antes de renderizar el botón "Nuevo Artículo". En `articulo-detalle-client.tsx`, "Agregar documento" y el botón de eliminar adjunto también quedan condicionados a `puedeEscribir`. |
| ART-04 | Media | **Corregido** | Nuevo `repo.getUnidadMedidaActiva()` valida `eliminadoEn:null, bloqueado:false`; se llama en `crearArticulo` (siempre) y `actualizarArticulo` (cuando `unidadId` cambia) → 422 si la unidad no está vigente. |

### Pruebas ejecutadas

| Verificación | Resultado |
|---|---|
| `npm run test:run` (`fas-api`) | 7/7 OK |
| `npm run test:integration` antes de agregar cobertura | 40/40 OK; no cubría Materiales |
| Nueva suite `articulos.integration.test.ts` | 5/5 OK: CA1, CA2, control de stock y edición |
| Nueva regresión ART-01/ART-02/ART-04 | 2/2 OK |
| `npm run test:integration` final | 56/56 OK |
| `npx prisma validate` | OK |
| `npm run build` (`fas-api`) | OK |
| `npm run build` (`fas-web`) | OK; 68 páginas generadas |

> Revalidación final Codex: Artículos sin hallazgos abiertos.

### Corrección Claude — 2026-07-23

Los 4 hallazgos (ART-01 a ART-04) fueron corregidos. Al revisar ART-02 se detectó que el bug de `z.coerce.boolean()` no era exclusivo de Artículos: el mismo patrón (`z.coerce.boolean()` convierte cualquier string no vacío, incluido `"false"`, a `true`) existía también en `tipos-movimiento.schema.ts` (`activo`), `config.schema.ts` (`soloActivos`, usado por **todos** los mantenedores generales) y `movimientos.controller.ts` (`bajoCritico`). Se corrigieron las 4 ubicaciones con el mismo patrón (`z.enum(['true','false']).transform(...)`).

Verificación: `fas-api` build OK, `fas-web` build OK (`tsc --noEmit` limpio). Pendiente de re-test por Codex.
