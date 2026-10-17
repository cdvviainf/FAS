import type { PrismaClient } from '@prisma/client'
import { logger } from '../logger.js'
import { getEmpresaIdActual } from '../empresa-context.js'
import { auditoriaContext, getAuditoriaContext } from './auditoria-context.js'
import { MODELOS_EXCLUIDOS_AUDITORIA, enmascararModelo } from './config.js'
import type { EventoAuditoria } from '../../modules/auditoria/auditoria.types.js'

// Operaciones de escritura que generan un evento de auditoría.
const MUTACIONES = new Set([
  'create',
  'createMany',
  'createManyAndReturn',
  'update',
  'updateMany',
  'upsert',
  'delete',
  'deleteMany',
])

type Args = Record<string, unknown>

// Pre-lectura best-effort del estado previo (para diff de update / snapshot de
// delete). Usa el cliente base (sin extensiones): el `where` ya viene scoped por
// tenancy (extensión externa), así que es seguro para el tenant.
async function leerAntes(base: PrismaClient, model: string, where: unknown): Promise<Record<string, unknown> | null> {
  if (where == null) return null
  try {
    const delegate = (base as unknown as Record<string, { findFirst: (a: unknown) => Promise<unknown> }>)[
      prop(model)
    ]
    const row = await delegate.findFirst({ where })
    return (row as Record<string, unknown>) ?? null
  } catch {
    return null
  }
}

// Nombre de delegate del modelo: primera letra en minúscula (AuditLog → auditLog).
function prop(model: string): string {
  return model.charAt(0).toLowerCase() + model.slice(1)
}

function idDe(row: unknown): string | null {
  const id = (row as { id?: unknown } | null)?.id
  return id == null ? null : String(id)
}

export function withAuditoria(base: PrismaClient): PrismaClient {
  return base.$extends({
    name: 'auditoria',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!model || !MUTACIONES.has(operation) || MODELOS_EXCLUIDOS_AUDITORIA.has(model)) {
            return query(args)
          }

          // Sin store ALS → fuera de un request (seed, scripts, jobs de fondo):
          // no se audita. La auditoría registra acciones de usuario, no las del
          // sistema; además evita ruido y dependencia de Redis en esos flujos.
          if (!auditoriaContext.getStore()) {
            return query(args)
          }

          const a = args as Args

          // Pre-read solo para single update/delete/upsert (diff / snapshot previo).
          let antes: Record<string, unknown> | null = null
          if (operation === 'update' || operation === 'delete' || operation === 'upsert') {
            antes = await leerAntes(base, model, a.where)
          }

          // La operación REAL — sus errores propagan tal cual.
          const resultado = await query(args)

          // Logging best-effort: nunca propaga ni bloquea. NO se encola aquí —
          // se acumula en el buffer del request y se publica en `onResponse`
          // solo si la respuesta fue exitosa, para no auditar mutaciones que
          // una transacción posterior revierta (A-QA-004).
          try {
            const evento = construirEvento(model, operation, a, antes, resultado)
            const store = auditoriaContext.getStore()
            if (evento && store) store.pendientes.push(evento)
          } catch (err) {
            logger.error({ err, model, operation }, 'auditoría: fallo al construir el evento de mutación')
          }

          return resultado
        },
      },
    },
  }) as unknown as PrismaClient
}

function construirEvento(
  model: string,
  operation: string,
  a: Args,
  antes: Record<string, unknown> | null,
  resultado: unknown,
): EventoAuditoria | null {
  const ctx = getAuditoriaContext()
  const empresaId = getEmpresaIdActual()
  const base = {
    empresaId,
    usuarioId: ctx.usuarioId,
    usuarioEmail: ctx.usuarioEmail,
    entidad: model,
    ruta: ctx.ruta,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  }

  // ── Operaciones masivas: una entrada resumen (criterio + cantidad) ──
  if (operation === 'createMany' || operation === 'createManyAndReturn') {
    const cantidad = (resultado as { count?: number })?.count ?? (Array.isArray(resultado) ? resultado.length : 0)
    return { ...base, accion: 'CREAR', resumen: { operacion: operation, cantidad } }
  }
  if (operation === 'updateMany' || operation === 'deleteMany') {
    const cantidad = (resultado as { count?: number })?.count ?? 0
    const data = a.data as { eliminadoEn?: unknown } | undefined
    const esSoftDelete = operation === 'updateMany' && data?.eliminadoEn != null
    const accion = operation === 'deleteMany' || esSoftDelete ? 'ELIMINAR' : 'EDITAR'
    // enmascararModelo (no enmascarar) para que un criterio sobre un campo
    // sensible por-modelo (ej. IntegracionParametro.valorExterno) no se filtre
    // en el resumen — A-QA-001.
    return { ...base, accion, resumen: { operacion: operation, criterio: enmascararModelo(model, a.where), cantidad } }
  }

  // ── Operaciones de una fila ──
  const despues = resultado ? (enmascararModelo(model, resultado) as Record<string, unknown>) : null
  const antesMask = antes ? (enmascararModelo(model, antes) as Record<string, unknown>) : null
  const entidadId = idDe(resultado) ?? idDe(antes)

  if (operation === 'create') {
    return { ...base, accion: 'CREAR', entidadId, datosDespues: despues }
  }
  if (operation === 'delete') {
    return { ...base, accion: 'ELIMINAR', entidadId, datosAntes: antesMask }
  }
  if (operation === 'upsert') {
    // Si existía fila previa → EDITAR; si no → CREAR.
    const accion = antes ? 'EDITAR' : 'CREAR'
    return { ...base, accion, entidadId, datosAntes: antesMask, datosDespues: despues }
  }
  if (operation === 'update') {
    // Soft-delete: eliminadoEn pasó de vacío a con fecha → ELIMINAR, no EDITAR.
    const antesElim = (antes as { eliminadoEn?: unknown } | null)?.eliminadoEn
    const despElim = (resultado as { eliminadoEn?: unknown } | null)?.eliminadoEn
    const accion = antesElim == null && despElim != null ? 'ELIMINAR' : 'EDITAR'
    return { ...base, accion, entidadId, datosAntes: antesMask, datosDespues: despues }
  }
  return null
}
