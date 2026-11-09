import { prisma } from '../../../lib/prisma.js'

// Fuentes de tipo de cambio = Integraciones activas con codigo TC_* (2026-11-09),
// en orden de prioridad ascendente (null al final) y luego por id.
export async function getFuentesTipoCambio() {
  const filas = await prisma.integracion.findMany({
    where: { codigo: { startsWith: 'TC_' }, activo: true, eliminadoEn: null },
    select: { id: true, codigo: true, descripcion: true, url: true, prioridad: true },
  })
  return filas.sort((a, b) => (a.prioridad ?? Number.MAX_SAFE_INTEGER) - (b.prioridad ?? Number.MAX_SAFE_INTEGER) || a.id - b.id)
}

// ─── Respaldo local (tabla global tipos_cambio_historico) ───────────────────

function dia(iso: string) {
  return new Date(`${iso}T00:00:00.000Z`)
}

export async function getHistoricoExacto(monedaCodigo: string, fechaConsultaIso: string) {
  return prisma.tipoCambioHistorico.findUnique({
    where: { monedaCodigo_fechaConsulta: { monedaCodigo, fechaConsulta: dia(fechaConsultaIso) } },
  })
}

// Último valor guardado con paridad <= fecha (o el más reciente si no hay fecha),
// dentro de una ventana de `diasMax` días — último recurso si fallan las fuentes.
export async function getHistoricoCercano(monedaCodigo: string, hastaIso: string | null, diasMax = 10) {
  const hasta = hastaIso ? dia(hastaIso) : new Date()
  const desde = new Date(hasta.getTime() - diasMax * 86_400_000)
  return prisma.tipoCambioHistorico.findFirst({
    where: { monedaCodigo, fechaParidad: { lte: hasta, gte: desde } },
    orderBy: [{ fechaParidad: 'desc' }, { id: 'desc' }],
  })
}

export async function guardarHistorico(data: { monedaCodigo: string; fechaConsultaIso: string; fechaParidadIso: string; valor: number; fuente: string }) {
  const fechaConsulta = dia(data.fechaConsultaIso)
  return prisma.tipoCambioHistorico.upsert({
    where: { monedaCodigo_fechaConsulta: { monedaCodigo: data.monedaCodigo, fechaConsulta } },
    create: { monedaCodigo: data.monedaCodigo, fechaConsulta, fechaParidad: dia(data.fechaParidadIso), valor: data.valor, fuente: data.fuente },
    update: { fechaParidad: dia(data.fechaParidadIso), valor: data.valor, fuente: data.fuente },
  })
}
