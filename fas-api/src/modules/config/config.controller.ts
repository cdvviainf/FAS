import type { FastifyRequest, FastifyReply } from 'fastify'
import * as service from './config.service.js'
import { prisma } from '../../lib/prisma.js'
import {
  mantenedorListQuerySchema,
  mantenedorParamsSchema,
  mantenedorBaseSchema,
  mantenedorUpdateSchema,
  paisBodySchema,
  paisUpdateSchema,
  provinciaBodySchema,
  provinciaUpdateSchema,
  comunaBodySchema,
  comunaUpdateSchema,
  grupoVariedadBodySchema,
  grupoVariedadUpdateSchema,
  variedadBodySchema,
  variedadUpdateSchema,
  especieBodySchema,
  especieUpdateSchema,
  categoriaBodySchema,
  categoriaUpdateSchema,
  calibreBodySchema,
  calibreUpdateSchema,
  parametroBodySchema,
  parametroUpdateSchema,
  mercadoBodySchema,
  mercadoUpdateSchema,
  puertoBodySchema,
  puertoUpdateSchema,
  monedaBodySchema,
  monedaUpdateSchema,
  conceptoCtaCteBodySchema,
  conceptoCtaCteUpdateSchema,
  temporadaBodySchema,
  temporadaUpdateSchema,
  bodegaBodySchema,
  bodegaUpdateSchema,
} from './config.schema.js'
import type { MantenedorModelo, MantenedorCreateInput } from './config.types.js'
import type { ZodTypeAny } from 'zod'

// Map of schema key → [createSchema, updateSchema]
const schemaRegistry: Record<string, [ZodTypeAny, ZodTypeAny]> = {
  pais: [paisBodySchema, paisUpdateSchema],
  provincia: [provinciaBodySchema, provinciaUpdateSchema],
  comuna: [comunaBodySchema, comunaUpdateSchema],
  especie: [especieBodySchema, especieUpdateSchema],
  grupoVariedad: [grupoVariedadBodySchema, grupoVariedadUpdateSchema],
  variedad: [variedadBodySchema, variedadUpdateSchema],
  categoria: [categoriaBodySchema, categoriaUpdateSchema],
  calibre: [calibreBodySchema, calibreUpdateSchema],
  parametro: [parametroBodySchema, parametroUpdateSchema],
  mercado: [mercadoBodySchema, mercadoUpdateSchema],
  puerto: [puertoBodySchema, puertoUpdateSchema],
  moneda: [monedaBodySchema, monedaUpdateSchema],
  conceptoCtaCte: [conceptoCtaCteBodySchema, conceptoCtaCteUpdateSchema],
  temporada: [temporadaBodySchema, temporadaUpdateSchema],
  bodega: [bodegaBodySchema, bodegaUpdateSchema],
}

export async function getTemporadaPredeterminada(_req: FastifyRequest, reply: FastifyReply) {
  const temporada = await service.obtenerTemporadaPredeterminada()
  return reply.send(temporada ?? null)
}

// Retorna los ítems de menú accesibles para el perfil del usuario autenticado
export async function getMiMenu(req: FastifyRequest, reply: FastifyReply) {
  const perfilId = req.fasUserPerfilId
  if (!perfilId) return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Sin sesión.' } })

  const accesos = await prisma.perfilAcceso.findMany({
    where: { perfilId, nivel: { not: 'SIN_ACCESO' } },
    include: {
      itemMenu: { select: { codigo: true, nombre: true, seccion: true, ruta: true, esAccion: true, orden: true } },
    },
    orderBy: { itemMenu: { orden: 'asc' } },
  })

  const items = accesos.map((a) => ({
    ...a.itemMenu,
    nivel: a.nivel,
  }))

  return reply.send(items)
}

export function makeControllers(modelo: MantenedorModelo, schemaKey?: string) {
  const [createSchema, updateSchema] = schemaKey && schemaRegistry[schemaKey]
    ? schemaRegistry[schemaKey]
    : [mantenedorBaseSchema, mantenedorUpdateSchema]

  return {
    async list(req: FastifyRequest, reply: FastifyReply) {
      const query = mantenedorListQuerySchema.parse(req.query)
      const result = await service.listarMantenedor(modelo, query)
      return reply.send(result)
    },

    async getById(req: FastifyRequest, reply: FastifyReply) {
      const { id } = mantenedorParamsSchema.parse(req.params)
      const item = await service.obtenerMantenedor(modelo, id)
      return reply.send(item)
    },

    async create(req: FastifyRequest, reply: FastifyReply) {
      const data = createSchema.parse(req.body) as MantenedorCreateInput
      const item = await service.crearMantenedor(modelo, data, req.fasUserId!)
      return reply.status(201).send(item)
    },

    async update(req: FastifyRequest, reply: FastifyReply) {
      const { id } = mantenedorParamsSchema.parse(req.params)
      const data = updateSchema.parse(req.body) as Partial<MantenedorCreateInput>
      const item = await service.actualizarMantenedor(modelo, id, data, req.fasUserId!)
      return reply.send(item)
    },

    async remove(req: FastifyRequest, reply: FastifyReply) {
      const { id } = mantenedorParamsSchema.parse(req.params)
      await service.eliminarMantenedor(modelo, id, req.fasUserId!)
      return reply.status(204).send()
    },
  }
}
