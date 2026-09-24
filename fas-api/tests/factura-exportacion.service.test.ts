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

import * as repo from '../src/modules/ventas/cobranza/factura-exportacion.repository.js'
import { siguienteCodigo } from '../src/modules/config/prefijos-codigo/prefijos-codigo.service.js'
import { validarYCompletarLineas } from '../src/modules/ventas/cobranza/proforma.service.js'
import * as dteService from '../src/modules/finanzas/facturacion/dte-emitidos.service.js'
import * as dteRepo from '../src/modules/finanzas/facturacion/dte-emitidos.repository.js'
import {
  actualizarBorrador,
  crearBorradorDesdeProforma,
  emitir,
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

beforeEach(() => vi.clearAllMocks())

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
    vi.mocked(validarYCompletarLineas).mockResolvedValue([
      { descripcion: 'x', especieId: 1, variedadId: null, articuloId: null, calibreId: null, categoriaId: null, etiquetaId: null, cantidadCajas: 10, precioUnitario: 5, montoLinea: 50 },
    ] as never)
    vi.mocked(repo.actualizarBorrador).mockResolvedValue({ id: 10 } as never)

    await actualizarBorrador(10, { dimensiones: [], lineas: [] as never }, 'u1')

    expect(repo.actualizarBorrador).toHaveBeenCalledWith(10, [], 50, expect.any(Array), 'u1')
  })
})

describe('emitir', () => {
  const facturaBorrador = {
    id: 10,
    estado: 'BORRADOR',
    empresaId: 1,
    embarqueId: 5,
    montoTotal: '1000.00',
    lineas: [{ descripcion: 'Uva', cantidadCajas: 100, precioUnitario: '10' }],
  }

  function armarMocksBase() {
    vi.mocked(repo.getFacturaActivaById).mockResolvedValue(facturaBorrador as never)
    vi.mocked(repo.getEmbarqueParaFacturaDte).mockResolvedValue(embarqueDespachado as never)
    vi.mocked(dteRepo.getEmpresaParaDte).mockResolvedValue({
      rut: '77089369-0', razonSocial: 'Agrosan', giro: 'Fruta', direccion: 'x', comuna: 'y',
    } as never)
  }

  it('rechaza si el timbrado (generarReal) falla y deja la Factura sin emitir', async () => {
    armarMocksBase()
    vi.mocked(dteService.emitirDteTemporal).mockResolvedValue({ estado: 'TEMPORAL_CREADO' } as never)
    vi.mocked(dteService.generarDteReal).mockResolvedValue({ estado: 'TEMPORAL_CREADO', errorMensaje: 'sin firma' } as never)

    await expect(emitir(10, 'u1')).rejects.toThrow(/sin firma/i)
    expect(repo.marcarEmitida).not.toHaveBeenCalled()
  })

  it('timbra y genera las Cuotas (CB5/CB6): 60/40 sumando el total, con folio', async () => {
    armarMocksBase()
    vi.mocked(dteService.emitirDteTemporal).mockResolvedValue({ estado: 'TEMPORAL_CREADO' } as never)
    vi.mocked(dteService.generarDteReal).mockResolvedValue({ estado: 'GENERADO', folio: 123, libredteCodigoTemporal: 'abc' } as never)
    vi.mocked(repo.getCuotasPagoNotaVenta).mockResolvedValue([
      { descripcion: null, fechaReferencia: 'FACTURA', plazoDias: 30, tipoValor: 'PORCENTAJE', porcentaje: 60, montoCalculado: null },
      { descripcion: null, fechaReferencia: 'ZARPE', plazoDias: 60, tipoValor: 'PORCENTAJE', porcentaje: 40, montoCalculado: null },
    ] as never)
    vi.mocked(repo.marcarEmitida).mockResolvedValue({ id: 10, estado: 'EMITIDA' } as never)

    await emitir(10, 'u1')

    expect(repo.marcarEmitida).toHaveBeenCalledTimes(1)
    const [id, datos] = vi.mocked(repo.marcarEmitida).mock.calls[0]
    expect(id).toBe(10)
    expect(datos.folio).toBe(123)
    expect(datos.cuotas).toHaveLength(2)
    expect(datos.cuotas[0].montoCuota).toBe(600)
    expect(datos.cuotas[1].montoCuota).toBe(400)
    expect(datos.cuotas[0].montoCuota + datos.cuotas[1].montoCuota).toBe(1000)
    // Cuota 1 (FACTURA) tiene vencimiento; Cuota 2 (ZARPE) usa fecha del Embarque.
    expect(datos.cuotas[0].fechaVencimiento).toBeInstanceOf(Date)
    expect(datos.cuotas[1].fechaVencimiento).toBeInstanceOf(Date)
  })
})
