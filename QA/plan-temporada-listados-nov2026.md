# Plan — Temporada en Cierre Comercial, OC, Instructivos, Embarques, Recepciones/Stock (nov-2026)

Fecha: 2026-11-06 · Alcance QA: `temporada-listados-nov2026`

## Contexto

- `Temporada` es por empresa (`empresaId`, `fechaInicio`, `fechaTermino`, `predeterminada`).
- Hoy solo `SolicitudInspeccion` y `ProductorContrato` tienen `temporadaId`. Cierre Comercial y el resto
  no tienen temporada: cambiar la temporada activa no cambia sus tablas (no es un bug de refresco).
- Decisión del usuario (2026-11-06): **campo temporada** (no rango de fechas), asignado con la temporada
  activa al crear y **editable**; los existentes se asignan por fecha. Los listados filtran por la
  temporada activa. Pantallas: Cierre Comercial, Instructivos, Órdenes de Compra, Embarques,
  Recepciones/Stock.

## Fix previo incluido (ya implementado, sin commit)

Cambio de empresa: `EmpresaProvider` usa `resetQueries` (salvo `config/me/*`, que solo se invalida),
`TemporadaProvider` keyea la predeterminada por empresa y espera datos frescos antes de inicializar,
y el listado de Solicitudes no consulta mientras la temporada se reinicializa. Causa: la temporada
se reinicializaba con la predeterminada cacheada de la otra empresa → listados en blanco / datos ajenos.

## Volver al Dashboard al cambiar de contexto (ya implementado, sin commit)

Si el usuario está DENTRO de un documento (ver/editar/crear: sub-ruta de una pantalla del menú, p. ej.
`/nueva`, `/[id]`) y cambia de empresa o de temporada → `router.push('/dashboard')`
(`hooks/use-salir-de-documento.ts`, llamado desde `EmpresaSelector` y `TemporadaSelector`). En un
listado no navega (la tabla se refresca). Elegir la misma empresa/temporada no hace nada.
Lo no guardado del formulario se pierde (comportamiento pedido).

## Modelo de datos

Campo propio `temporadaId Int?` + FK compuesta `[empresaId, temporadaId] → Temporada[empresaId, id]`
+ `@@index([temporadaId])` en los documentos raíz:

| Modelo | Backfill por | Al crear |
|---|---|---|
| `NotaVenta` (Cierre) | `fecha` | temporada activa (editable en el form) |
| `OrdenCompra` (fruta) | `fecha` | temporada activa (editable) |
| `InstructivoEmbalaje` | `fechaInicioPrograma` | temporada activa (editable) |
| `Recepcion` | OC (si tiene) → si no `creadoEn` | de la OC si tiene; si no, temporada activa (editable) |

Heredan (sin columna nueva, se filtra por la relación):
- `Embarque` → `notaVenta.temporadaId` (el listado de Embarques; Instructivo de Embarque y Packing viven dentro del Embarque). Facturas/Proformas: fuera de alcance (no se filtran).
- `Pallet` / Stock → `recepcion.temporadaId`.

Backfill (migración SQL) — **decisión del usuario 2026-11-06: todos los documentos existentes son de
prueba y van a la temporada `25-26` de SU empresa** (código exacto; supersede el backfill por fecha de la
tabla de arriba). Si una empresa no tuviera `25-26`, cae a su predeterminada; si no hay, queda NULL.
La resolución por fecha se mantiene solo para altas por API que omitan `temporadaId`. Columna nullable (registros sin
temporada siguen visibles al elegir "todas"/sin temporada).

## Backend

- Schemas Zod create/update: `temporadaId` opcional (int positivo); validar que exista, sea de la
  empresa activa (lookup tenant-filtrado) y no esté eliminada.
- Listados: query param `temporadaId` opcional → `where.temporadaId` (raíces) o
  `where.notaVenta.temporadaId` / `where.recepcion.temporadaId` (heredados).
- Duplicar Cierre: copia la temporada del original (editable después).
- Recepción con OC: si no se envía temporada, toma la de la OC.

## Frontend

- Listados (7): Cierre, Embarques, OC, Instructivos de Embalaje, Recepciones, Gestión de Pallets y Reporte Stock de Fruta: leer `useTemporada()`, enviar `temporadaId` en filtros (entra a la
  query key → refresca al cambiar), `enabled: !temporadaCargando` (mismo patrón que Solicitudes).
- Forms de Cierre, OC, Instructivo de Embalaje, Recepción: selector "Temporada" (temporadas activas de
  la empresa), default = temporada activa en alta; en edición muestra la guardada.
- Sin temporada activa seleccionada: el listado muestra todo (comportamiento actual de Solicitudes).

## Riesgos

- Migración toca 4 tablas grandes (UPDATE por rango); revisar en copia antes de Coolify.
- Registros cuya fecha no cae en ninguna temporada quedan con la predeterminada → revisar rangos reales.
- Reportes/exports que hoy no filtran por temporada no cambian (fuera de alcance).

## Estado de implementación (2026-11-06)

Implementado por Claude, pendiente QA Codex. Archivos clave: `fas-api/src/shared/temporada-documento.ts`,
`config.repository.ts` (`getTemporadaAsignable`, `resolverTemporadaPorFecha`), services/repos de
notas-venta, ordenes-compra, instructivo-embalaje, recepciones, embarques (listado), stock (listado);
`fas-web/src/components/shared/temporada-select.tsx`, forms y listings de las pantallas, contexts de
empresa/temporada, `hooks/use-salir-de-documento.ts`. Migración `20261106150000_temporada_documentos`.
