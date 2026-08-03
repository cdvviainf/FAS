import { Prisma, type PrismaClient } from '@prisma/client'
import { empresaContext } from './empresa-context.js'
import { EmpresaRequeridaError } from '../shared/errors.js'

// Modelos con `empresaId` propio (Fase 2) — la lista crece a medida que Fase 3
// migre el resto de tablas raíz. Nombres tal como los expone el Prisma Client
// (camelCase del nombre del modelo, no el @@map de la tabla).
const MODELOS_TENANT = new Set([
  'Mercado',
  'GrupoMercado',
  'ConfiguracionCorreo',
  'PrefijoCodigo',
  'MercadoPais',
  // Fase 3, lote Config/Mantenedores:
  'TipoEmbarque',
  'FormaPago',
  'UnidadMedida',
  'TipoPallet',
  'Altura',
  'TipoProduccion',
  'TipoDefecto',
  'TipoParametro',
  'Puerto',
  'Temporada',
  'Bodega',
  'ConceptoCtaCte',
  'Especie',
  'GrupoVariedad',
  'Variedad',
  'Categoria',
  'Calibre',
  'Parametro',
  'Calificacion',
  // Fase 3, lote Entidades:
  'Entidad',
  // Fase 3, lote Calidad:
  'SolicitudInspeccion',
  // Fase 3, lote Materiales:
  'Articulo',
  'Receta',
  'TipoMovimiento',
  'SaldoArticulo',
  'Movimiento',
  // Fase 3, lote Productores:
  'Predio',
  'ProductorContrato',
  'MovimientoCuentaCorriente',
  'ConceptoLiquidacion',
  // Fase 3, lote Ventas:
  'NotaVenta',
  'Embarque',
  'InstructivoEmbalaje',
  // Fase 3, lote Compras (7/7, último):
  'OrdenCompra',
  'CondicionPago',
  'Recepcion',
  'Pallet',
  'TemplateCarga',
])

// Solo necesitan `where` (no tienen `data` propio que pudiera intentar
// cambiar el tenant). `update`/`updateMany` se manejan aparte porque además
// de `where` llevan `data`.
const OPERACIONES_SOLO_WHERE = new Set([
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'findUnique',
  'findUniqueOrThrow',
  'delete',
  'deleteMany',
  'count',
  'aggregate',
  'groupBy',
])

// FAS-EMP-F2-R2-004: createManyAndReturn es una operación de creación más
// (Prisma 5.15+) — mismo tratamiento que createMany. Se enumera aparte para
// que la lista de operaciones de creación quede explícita y completa.
const OPERACIONES_CREATE_MANY = new Set(['createMany', 'createManyAndReturn'])

// FAS-EMP-F2-R3-005: cualquier modelo con una relación hacia un modelo tenant
// puede, en teoría, escribirlo de forma anidada (ej. `pais.update({ data: {
// mercado: { update: {...} } } })`, `empresa.update({ data: { mercados: {
// create: {...} } } })`) sin que el modelo de nivel superior de esa operación
// sea uno tenant — Prisma nunca vuelve a invocar `$allOperations` para el
// modelo anidado. Mantener a mano una lista de "modelo.campo" a bloquear no
// escala (cada relación nueva hacia un modelo tenant fue apareciendo como un
// vector nuevo en rondas sucesivas de QA: Pais, SolicitudInspeccion,
// NotaVenta, Empresa). En vez de eso, `RELACIONES_POR_MODELO` deriva del
// DMMF que Prisma genera con el schema completo el mapa, por modelo, de qué
// campo es una relación y a qué modelo apunta.
const RELACIONES_POR_MODELO = new Map<string, Map<string, string>>(
  Prisma.dmmf.datamodel.models.map((m) => [
    m.name,
    new Map(m.fields.filter((f) => f.kind === 'object' && f.relationName).map((f) => [f.name, f.type])),
  ]),
)

// Recorre `valor` (el `data`/`create`/`update` de una operación sobre
// `modelo`) buscando si, por algún camino de relaciones, se alcanza un
// modelo tenant. Sin límite de profundidad: los payloads vienen de JSON
// (body HTTP parseado por Fastify/Zod), que es acíclico por construcción —
// no hay riesgo de recursión infinita, y un límite arbitrario dejaría sin
// inspeccionar relaciones legítimas más profundas (hallazgo de ronda 7).
//
// Solo avanza el `modelo` de contexto cuando la clave actual es una relación
// REAL de ese modelo (consultando `RELACIONES_POR_MODELO`) — si no lo es (ej.
// los verbos-envoltorio de Prisma `create`/`update`/`upsert`/`where`/`data`,
// o un campo escalar anidado sin relevancia), se sigue recorriendo con el
// MISMO modelo, porque todavía no se cruzó ninguna relación. Esto es lo que
// permite destapar envoltorios como `{ update: [{ where, data: {...} } ] }`
// sin perder de vista a qué modelo pertenece "data", y evita el falso
// positivo de ronda 7 (un campo escalar homónimo, ej. `Cliente.mercado`
// como enum, nunca aparece en el mapa de relaciones de `Cliente`).
function contieneEscrituraAnidadaTenant(modelo: string, valor: unknown): boolean {
  if (!valor || typeof valor !== 'object') return false

  if (Array.isArray(valor)) {
    return valor.some((el) => contieneEscrituraAnidadaTenant(modelo, el))
  }

  const relaciones = RELACIONES_POR_MODELO.get(modelo)
  if (!relaciones) return false

  for (const [campo, subvalor] of Object.entries(valor as Record<string, unknown>)) {
    if (!subvalor || typeof subvalor !== 'object') continue
    const modeloDestino = relaciones.get(campo)
    if (modeloDestino) {
      if (MODELOS_TENANT.has(modeloDestino)) return true
      if (contieneEscrituraAnidadaTenant(modeloDestino, subvalor)) return true
    } else if (contieneEscrituraAnidadaTenant(modelo, subvalor)) {
      return true
    }
  }
  return false
}

// Riesgo residual conocido (documentado en Docs/empresas.md §2.c): esta
// extensión solo intercepta operaciones de nivel superior del Prisma Client.
// Las LECTURAS anidadas (`include`/`select` de un modelo tenant a través de
// otro) no pasan por `$allOperations` para el modelo anidado — no se les
// inyecta el filtro ahí. Las ESCRITURAS anidadas sí quedan cubiertas por
// `contieneEscrituraAnidadaTenant` de arriba.
export function withTenancy(client: PrismaClient): PrismaClient {
  return client.$extends({
    name: 'tenancy',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const store = empresaContext.getStore()

          // Se ejecuta con cualquier store presente, incluso si `empresaId`
          // es null (modo soft de Fase 1): una escritura anidada hacia un
          // modelo tenant sin empresa resuelta es exactamente el mismo caso
          // que una operación directa sin empresa — debe fallar igual, no
          // pasar silenciosamente sin aislamiento.
          if (store && model) {
            const a0 = args as { data?: unknown; create?: unknown; update?: unknown }
            const traeAnidada = [a0.data, a0.create, a0.update].some((v) =>
              contieneEscrituraAnidadaTenant(model, v),
            )
            if (traeAnidada) {
              if (store.empresaId == null) {
                throw new EmpresaRequeridaError(
                  `La operación sobre ${model ?? 'desconocido'} requiere una empresa activa (escritura anidada hacia un modelo tenant).`,
                )
              }
              throw new Error(
                `prisma-tenancy: no se permiten escrituras anidadas hacia modelos tenant desde ${model} ` +
                  'mientras haya una empresa activa — usa una operación directa sobre el modelo tenant correspondiente.',
              )
            }
          }

          if (!model || !MODELOS_TENANT.has(model)) return query(args)

          // Sin store ALS: fuera de un request (seed, scripts, tests con
          // prisma crudo) — no se enforce, el caller debe pasar empresaId
          // explícito en `data`/`where` si corresponde.
          if (!store) return query(args)

          if (store.empresaId == null) {
            throw new EmpresaRequeridaError(`La operación sobre ${model} requiere una empresa activa.`)
          }
          const empresaId = store.empresaId

          const a = args as Record<string, unknown>

          // empresaId siempre al final del spread: el valor resuelto por el
          // servidor prevalece sobre cualquier empresaId que el caller haya
          // podido incluir (nunca debería, pero así ninguna llamada puede
          // hijackear el tenant de la fila).
          if (operation === 'create') {
            a.data = { ...(a.data as object), empresaId }
          } else if (OPERACIONES_CREATE_MANY.has(operation)) {
            const data = a.data
            a.data = Array.isArray(data)
              ? data.map((d) => ({ ...(d as object), empresaId }))
              : { ...(data as object), empresaId }
          } else if (operation === 'upsert') {
            a.where = { ...(a.where as object), empresaId }
            a.create = { ...(a.create as object), empresaId }
            // FAS-EMP-F2-R1-002: sin esto, `update` de un upsert podía
            // secuestrar el tenant de una fila propia pasando otro empresaId.
            a.update = { ...(a.update as object), empresaId }
          } else if (operation === 'update' || operation === 'updateMany') {
            a.where = { ...(a.where as object), empresaId }
            // Mismo motivo: el `data` de un update no debe poder cambiar el
            // tenant de la fila, aunque el caller lo incluya explícitamente.
            a.data = { ...(a.data as object), empresaId }
          } else if (OPERACIONES_SOLO_WHERE.has(operation)) {
            a.where = { ...(a.where as object), empresaId }
          } else {
            // FAS-EMP-F2-R2-004: fail-closed — una operación no reconocida
            // sobre un modelo tenant nunca debe ejecutarse sin aislamiento.
            throw new Error(
              `prisma-tenancy: operación "${operation}" sobre ${model} no está clasificada en prisma-tenancy.ts — clasifícala antes de usarla.`,
            )
          }

          return query(a as typeof args)
        },
      },
    },
  }) as unknown as PrismaClient
}
