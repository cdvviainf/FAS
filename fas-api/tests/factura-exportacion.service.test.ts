import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../src/modules/ventas/cobranza/factura-exportacion.repository.js', () => ({
  getProformaEmitidaParaFactura: vi.fn(),
  getEmbarqueParaFacturaDte: vi.fn(),
  getFacturaActivaPorEmbarque: vi.fn(),
  getFacturaByIdConHistorial: vi.fn(),
  getFacturaActivaById: vi.fn(),
  getCuotasPagoNotaVenta: vi.fn(),
  crearBorrador: vi.fn(),
  actualizarBorrador: vi.fn(),
  marcarEmitida: vi.fn(),
  anularFactura: vi.fn(),
  listFacturas: vi.fn(),
}))
vi.mock('../src/modules/config/prefijos-codigo/prefijos-codigo.service.js', () => ({
  siguienteCodigo: vi.fn(),
}))
vi.mock('../src/modules/ventas/cobranza/proforma.service.js', () => ({
  validarYCompletarLineas: vi.fn(),
}))
vi.mock('../src/modules/finanzas/facturacion/dte-emitidos.service.js', () => ({
  emitirDteTemporal: vi.fn(),
  generarDteReal: vi.fn(),
}))
vi.mock('../src/modules/finanzas/facturacion/dte-emitidos.repository.js', () => ({
  getEmpresaParaDte: vi.fn(),
}))
// Tipo de cambio (2026-10-06): se mockea para que crearBorrador no pegue contra
// mindicador.cl real (red externa → timeouts intermitentes en la suite).
vi.mock('../src/modules/finanzas/facturacion/tipo-cambio.adapter.js', () => ({
  obtenerTipoCambio: vi.fn(),
}))

import * as repo from '../src/modules/ventas/cobranza/factura-exportacion.repository.js'
import { obtenerTipoCambio } from '../src/modules/finanzas/facturacion/tipo-cambio.adapter.js'
import { siguienteCodigo } from '../src/modules/config/prefijos-codigo/prefijos-codigo.service.js'
import { validarYCompletarLineas } from '../src/modules/ventas/cobranza/proforma.service.js'
import {
  actualizarBorrador,
  crearBorradorDesdeProforma,
} from '../src/modules/ventas/cobranza/factura-exportacion.service.js'

const embarqueDespachado = {
  id: 5,
  numeroInstructivo: 'MAR-0001',
  notaVentaId: 9,
  despachadoEn: new Date('2026-09-20'),
  despachoAnuladoEn: null,
  reservaManual: true,
  fechaZarpeManual: new Date('2026-09-22'),
  fechaArribo: null,
  solicitudReserva: null,
  puertoZarpe: { codigo: '901' },
  notaVenta: {
    clienteId: 3,
    cliente: { id: 3, razonSocial: 'Importer LLC', identificador: '99-1', giro: 'Import' },
    monedaId: 2,
    moneda: { codigo: 'USD', descripcion: 'DOLAR USA', descripcionExtranjera: null },
    condicionPagoId: 7,
    tipoEmbarque: { codigo: '1' },
    paisDestino: { codigo: '563' },
    puertoDestino: { codigo: '999' },
    modalidadVenta: { codigo: '1' },
    clausulaVenta: { codigo: '3' },
  },
}

beforeEach(() => {
  vi.clearAllMocks()
  // Default determinista del tipo de cambio (sin red). Los tests que no usan
  // moneda extranjera igual no lo invocan.
  vi.mocked(obtenerTipoCambio).mockResolvedValue({ valor: 950, fecha: '2026-09-20' })
})

describe('crearBorradorDesdeProforma', () => {
  const proforma = {
    id: 1,
    estado: 'EMITIDA' as const,
    embarqueId: 5,
    clienteId: 3,
    monedaId: 2,
    condicionPagoId: 7,
    dimensionesAgrupacion: ['VARIEDAD'],
    lineas: [
      { descripcion: 'Uva Thompson', especieId: 1, variedadId: 2, articuloId: null, calibreId: null, categoriaId: null, etiquetaId: null, cantidadCajas: 100, precioUnitario: '12.5', montoLinea: '1250.00' },
      { descripcion: 'Uva Crimson', especieId: 1, variedadId: 3, articuloId: null, calibreId: null, categoriaId: null, etiquetaId: null, cantidadCajas: 50, precioUnitario: '14', montoLinea: '700.00' },
    ],
  }

  it('rechaza si la Proforma no está EMITIDA', async () => {
    vi.mocked(repo.getProformaEmitidaParaFactura).mockResolvedValue({ ...proforma, estado: 'ANULADA' } as never)
    await expect(crearBorradorDesdeProforma(1, 'u1')).rejects.toThrow(/emitida/i)
  })

  it('rechaza si el Embarque ya tiene Factura (CB2)', async () => {
    vi.mocked(repo.getProformaEmitidaParaFactura).mockResolvedValue(proforma as never)
    vi.mocked(repo.getEmbarqueParaFacturaDte).mockResolvedValue(embarqueDespachado as never)
    vi.mocked(repo.getFacturaActivaPorEmbarque).mockResolvedValue({ id: 77 } as never)
    await expect(crearBorradorDesdeProforma(1, 'u1')).rejects.toThrow(/ya tiene una Factura/i)
  })

  it('crea el borrador con montoTotal = Σ montoLinea', async () => {
    vi.mocked(repo.getProformaEmitidaParaFactura).mockResolvedValue(proforma as never)
    vi.mocked(repo.getEmbarqueParaFacturaDte).mockResolvedValue(embarqueDespachado as never)
    vi.mocked(repo.getFacturaActivaPorEmbarque).mockResolvedValue(null as never)
    vi.mocked(siguienteCodigo).mockResolvedValue('FEX0001')
    vi.mocked(repo.crearBorrador).mockResolvedValue({ id: 10 } as never)

    await crearBorradorDesdeProforma(1, 'u1')

    expect(repo.crearBorrador).toHaveBeenCalledWith(
      expect.objectContaining({ codigo: 'FEX0001', proformaId: 1, embarqueId: 5, montoTotal: 1950 }),
      'u1',
    )
  })
})

describe('actualizarBorrador', () => {
  it('rechaza si la Factura no está en BORRADOR', async () => {
    vi.mocked(repo.getFacturaActivaById).mockResolvedValue({ id: 10, estado: 'EMITIDA', embarqueId: 5 } as never)
    await expect(actualizarBorrador(10, { dimensiones: [], lineas: [] }, 'u1')).rejects.toThrow(/Borrador/i)
  })

  it('deriva montoTotal desde las líneas revalidadas', async () => {
    vi.mocked(repo.getFacturaActivaById).mockResolvedValue({ id: 10, estado: 'BORRADOR', embarqueId: 5 } as never)
    vi.mocked(repo.getEmbarqueParaFacturaDte).mockResolvedValue(embarqueDespachado as never)
    vi.mocked(validarYCompletarLineas).mockResolvedValue([
      { descripcion: 'x', especieId: 1, variedadId: null, articuloId: null, calibreId: null, categoriaId: null, etiquetaId: null, cantidadCajas: 10, precioUnitario: 5, montoLinea: 50 },
    ] as never)
    vi.mocked(repo.actualizarBorrador).mockResolvedValue({ id: 10 } as never)

    await actualizarBorrador(10, { dimensiones: [], lineas: [] as never }, 'u1')

    // Firma actual de repo.actualizarBorrador(id, {objeto}, userId) — 2026-10.
    // Cláusula sin flete/seguro (FOB): ambos montos nulos; montoTotal derivado = 50.
    expect(repo.actualizarBorrador).toHaveBeenCalledWith(
      10,
      expect.objectContaining({ montoTotal: 50, montoFlete: null, montoSeguro: null }),
      'u1',
    )
  })

  it('exige Flete cuando la cláusula lo requiere', async () => {
    vi.mocked(repo.getFacturaActivaById).mockResolvedValue({ id: 10, estado: 'BORRADOR', embarqueId: 5 } as never)
    vi.mocked(repo.getEmbarqueParaFacturaDte).mockResolvedValue({
      ...embarqueDespachado,
      notaVenta: { ...embarqueDespachado.notaVenta, clausulaVenta: { codigo: '9', descripcion: 'CIF', requiereFlete: true, requiereSeguro: true } },
    } as never)
    vi.mocked(validarYCompletarLineas).mockResolvedValue([
      { descripcion: 'x', especieId: 1, variedadId: null, articuloId: null, calibreId: null, categoriaId: null, etiquetaId: null, cantidadCajas: 10, precioUnitario: 5, montoLinea: 50 },
    ] as never)

    await expect(actualizarBorrador(10, { dimensiones: [], lineas: [] as never }, 'u1')).rejects.toThrow(/Flete/i)
  })
})
