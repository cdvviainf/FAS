import { Prisma } from '@prisma/client'
import { NotFoundError, ValidationError } from '../../../shared/errors.js'
import { precioNVParaLineaPallet } from '../embarques/embarques.comparacion.js'
import { siguienteCodigo } from '../../config/prefijos-codigo/prefijos-codigo.service.js'
import * as repo from './proforma.repository.js'
import type { DimensionProforma, ProformaEmitirInput, ProformaLineaInput, ProformasListFilters } from './proforma.types.js'

// Orden de armado de la descripción (decisión de negocio, Christian
// 2026-09-24): Especie siempre presente; el resto solo si el usuario lo
// eligió al pedir la sugerencia. Ej. "Uva de mesa" (solo Especie) o
// "Uva de mesa - Thompson - Categoría 1" (Especie+Variedad+Categoría).
interface GrupoAcumulado {
  especieId: number
  especieDesc: string
  variedadId: number | null
  variedadDesc: string | null
  articuloId: number | null
  articuloDesc: string | null
  calibreId: number | null
  calibreDesc: string | null
  categoriaId: number | null
  categoriaDesc: string | null
  etiquetaId: number | null
  etiquetaDesc: string | null
  cantidadCajas: number
  montoLinea: number
}

// Clave de agrupación — la MISMA función se usa para construir las líneas
// sugeridas (a partir de PalletLinea real) y para revalidar las líneas que
// manda el cliente al emitir (FAS-PROF-EXP-001, QA ronda 1): nunca se
// confía en los IDs/cajas que llegan en el body, solo se usan para
// encontrar a qué grupo canónico corresponden.
interface IdsAgrupables {
  especieId: number
  variedadId?: number | null
  articuloId?: number | null
  calibreId?: number | null
  categoriaId?: number | null
  etiquetaId?: number | null
}

function claveGrupo(ids: IdsAgrupables, dimensiones: DimensionProforma[]): string {
  const usa = (d: DimensionProforma) => dimensiones.includes(d)
  return [
    ids.especieId,
    usa('VARIEDAD') ? ids.variedadId : '-',
    usa('ARTICULO') ? ids.articuloId : '-',
    usa('CALIBRE') ? ids.calibreId : '-',
    usa('CATEGORIA') ? ids.categoriaId : '-',
    usa('MARCA') ? (ids.etiquetaId ?? 'sin-marca') : '-',
  ].join('|')
}

// FAS-PROF-EXP-005 (QA ronda 1): la UI solo ofrece Embarques despachados en
// el selector, pero eso no es una validación real — sin este chequeo en el
// backend, se podía pedir/emitir una Proforma para un Embarque que nunca
// zarpó (o cuyo despacho fue anulado) llamando al endpoint directo.
function requireEmbarqueDespachado(embarque: { despachadoEn: Date | null; despachoAnuladoEn: Date | null }) {
  const despachado = !!embarque.despachadoEn && !embarque.despachoAnuladoEn
  if (!despachado) {
    throw new ValidationError('Este Embarque debe estar despachado antes de emitir su Proforma')
  }
}

// Sugerencia de líneas agrupadas (cobranza.md §7, 2026-09-24): agrupa las
// líneas de los pallets reservados al Embarque por Especie + las dimensiones
// elegidas, sumando cajas y cruzando cada línea contra el precio de la línea
// de Nota de Venta que calce (mismo criterio que palletCalzaConDetalleNV) —
// una línea de pallet sin línea de NV que calce aporta $0 (no bloquea, el
// monto queda editable). Es solo una sugerencia: no persiste nada.
export async function sugerirLineas(embarqueId: number, dimensiones: DimensionProforma[]) {
  const embarque = await repo.getEmbarqueParaProforma(embarqueId)
  if (!embarque) throw new NotFoundError('Embarque', String(embarqueId))
  requireEmbarqueDespachado(embarque)

  const [pallets, notaVenta] = await Promise.all([
    repo.getPalletsReservadosConDetalle(embarqueId),
    repo.getNotaVentaParaPrecios(embarque.notaVentaId),
  ])
  const detalleNV = (notaVenta?.detalles ?? []).map((d) => ({ ...d, precio: Number(d.precio) }))

  const grupos = new Map<string, GrupoAcumulado>()
  for (const pallet of pallets) {
    for (const l of pallet.lineas) {
      const precio =
        precioNVParaLineaPallet(
          {
            especieId: l.especieId,
            variedadId: l.variedadId,
            categoriaId: l.categoriaId,
            articuloId: l.articuloId,
            calibreId: l.calibreId,
          },
          detalleNV,
        ) ?? 0

      const key = claveGrupo(l, dimensiones)
      let g = grupos.get(key)
      if (!g) {
        g = {
          especieId: l.especieId,
          especieDesc: l.especie.descripcion,
          variedadId: dimensiones.includes('VARIEDAD') ? l.variedadId : null,
          variedadDesc: dimensiones.includes('VARIEDAD') ? l.variedad.descripcion : null,
          articuloId: dimensiones.includes('ARTICULO') ? l.articuloId : null,
          articuloDesc: dimensiones.includes('ARTICULO') ? l.articulo.descripcion : null,
          calibreId: dimensiones.includes('CALIBRE') ? l.calibreId : null,
          calibreDesc: dimensiones.includes('CALIBRE') ? l.calibre.descripcion : null,
          categoriaId: dimensiones.includes('CATEGORIA') ? l.categoriaId : null,
          categoriaDesc: dimensiones.includes('CATEGORIA') ? l.categoria.descripcion : null,
          etiquetaId: dimensiones.includes('MARCA') ? (l.etiquetaId ?? null) : null,
          etiquetaDesc: dimensiones.includes('MARCA') ? (l.etiqueta?.descripcion ?? null) : null,
          cantidadCajas: 0,
          montoLinea: 0,
        }
        grupos.set(key, g)
      }
      g.cantidadCajas += l.cajas
      g.montoLinea += l.cajas * precio
    }
  }

  return [...grupos.values()].map((g) => ({
    descripcion: [g.especieDesc, g.variedadDesc, g.articuloDesc, g.calibreDesc, g.categoriaDesc, g.etiquetaDesc]
      .filter(Boolean)
      .join(' - '),
    especieId: g.especieId,
    variedadId: g.variedadId,
    articuloId: g.articuloId,
    calibreId: g.calibreId,
    categoriaId: g.categoriaId,
    etiquetaId: g.etiquetaId,
    cantidadCajas: g.cantidadCajas,
    montoLinea: Math.round(g.montoLinea * 100) / 100,
    precioUnitario: g.cantidadCajas > 0 ? Math.round((g.montoLinea / g.cantidadCajas) * 10000) / 10000 : 0,
  }))
}

// FAS-PROF-EXP-001 (QA rondas 1-2, ALTA): re-deriva cada línea contra el
// grupo canónico recién recalculado — nunca confía en `cantidadCajas` ni en
// los IDs de especie/variedad/artículo/calibre/categoría/marca que manda el
// cliente (podrían no corresponder a los pallets reales del Embarque, o
// referenciar mantenedores de otra empresa). Solo `descripcion` (si vino) y
// `precioUnitario` son realmente editables; `montoLinea` = precioUnitario ×
// cantidadCajas (cajas canónicas) se deriva acá y se redondea a 2 decimales.
// Ronda 2: no basta con validar cada línea aislada — se exige además que el
// body cubra el multiconjunto EXACTO de grupos canónicos (ni de más, ni de
// menos, ni repetidos), o un consumidor directo podía omitir/duplicar fruta
// y alterar el total.
async function validarYCompletarLineas(embarqueId: number, dimensiones: DimensionProforma[], lineasCliente: ProformaLineaInput[]) {
  const canonicas = await sugerirLineas(embarqueId, dimensiones)
  const porClave = new Map(canonicas.map((c) => [claveGrupo(c, dimensiones), c]))

  const vistas = new Set<string>()
  const resultado = lineasCliente.map((l) => {
    const clave = claveGrupo(l, dimensiones)
    const canonica = porClave.get(clave)
    if (!canonica) {
      throw new ValidationError(
        'Una de las líneas no corresponde a la fruta real de este Embarque — recalcula la sugerencia e intenta de nuevo',
      )
    }
    if (vistas.has(clave)) {
      throw new ValidationError('Hay una línea repetida — cada combinación debe aparecer una sola vez (recalcula la sugerencia)')
    }
    vistas.add(clave)
    const precioUnitario = l.precioUnitario
    return {
      descripcion: l.descripcion?.trim() || canonica.descripcion,
      especieId: canonica.especieId,
      variedadId: canonica.variedadId,
      articuloId: canonica.articuloId,
      calibreId: canonica.calibreId,
      categoriaId: canonica.categoriaId,
      etiquetaId: canonica.etiquetaId,
      cantidadCajas: canonica.cantidadCajas,
      precioUnitario,
      montoLinea: Math.round(precioUnitario * canonica.cantidadCajas * 100) / 100,
    }
  })

  if (vistas.size !== porClave.size) {
    throw new ValidationError('Faltan líneas por incluir — recalcula la sugerencia para ver la fruta completa del Embarque')
  }

  return resultado
}

// Suma en centavos (enteros) para que `montoTotal` sea exactamente Σ
// montoLinea sin arrastre de error de punto flotante (FAS-PROF-EXP-007, QA
// ronda 2) — `montoLinea` ya viene validado a 2 decimales por el schema Zod.
function sumarMontos(montos: number[]): number {
  const centavos = montos.reduce((acc, m) => acc + Math.round(m * 100), 0)
  return centavos / 100
}

// Emisión en un solo paso (D12: documento interno, no tributario — sin
// BORRADOR previo, decisión de negocio Christian 2026-09-24). Cliente/moneda/
// condición de pago se heredan de la Nota de Venta del Embarque, no editables.
export async function emitirProforma(embarqueId: number, body: ProformaEmitirInput, userId: string) {
  const embarque = await repo.getEmbarqueParaProforma(embarqueId)
  if (!embarque) throw new NotFoundError('Embarque', String(embarqueId))
  requireEmbarqueDespachado(embarque)

  const existente = await repo.getProformaActivaPorEmbarque(embarqueId)
  if (existente) {
    throw new ValidationError('Este Embarque ya tiene una Proforma emitida — anúlala antes de emitir una nueva (CB2)')
  }

  const codigo = await siguienteCodigo('proforma')
  if (!codigo) throw new ValidationError('No hay un prefijo de código configurado para Proforma (Configuración › Prefijos de Código)')

  const lineas = await validarYCompletarLineas(embarqueId, body.dimensiones, body.lineas)
  const montoTotal = sumarMontos(lineas.map((l) => l.montoLinea))

  try {
    return await repo.crearProforma(
      {
        embarqueId,
        codigo,
        clienteId: embarque.notaVenta.clienteId,
        monedaId: embarque.notaVenta.monedaId,
        condicionPagoId: embarque.notaVenta.condicionPagoId,
        montoTotal,
      },
      { idioma: body.idioma, dimensiones: body.dimensiones, lineas },
      userId,
    )
  } catch (err) {
    // Carrera concurrente: el índice único parcial (empresaId, embarqueId
    // WHERE eliminadoEn IS NULL) es la defensa real contra dos emisiones
    // simultáneas — el check de arriba no es atómico.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ValidationError('Este Embarque ya tiene una Proforma emitida — recarga e intenta de nuevo')
    }
    throw err
  }
}

export async function obtenerProformaPorEmbarque(embarqueId: number) {
  return repo.getProformaActivaPorEmbarque(embarqueId)
}

// Detalle: incluye ANULADAS (FAS-PROF-EXP-003, QA ronda 1) — el historial
// debe poder consultarse; solo el PDF (resolver del Motor de Documentos, que
// usa getProformaActivaSoloOId) queda bloqueado para una Proforma anulada,
// mismo criterio ya usado para InstructivoHijo tras "Anular Despacho".
export async function obtenerProforma(id: number) {
  const proforma = await repo.getProformaByIdConHistorial(id)
  if (!proforma) throw new NotFoundError('Proforma', String(id))
  return proforma
}

export async function listarProformas(filters: ProformasListFilters) {
  const { page = 1, limit = 20 } = filters
  const { data, total } = await repo.listProformas(filters)
  return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } }
}

export async function anularProforma(id: number, userId: string) {
  const proforma = await repo.getProformaByIdConHistorial(id)
  if (!proforma) throw new NotFoundError('Proforma', String(id))
  if (proforma.estado === 'ANULADA') throw new ValidationError('Esta Proforma ya está anulada')
  return repo.anularProforma(id, userId)
}
