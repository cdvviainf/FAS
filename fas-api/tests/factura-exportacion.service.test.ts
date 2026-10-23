import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../src/modules/ventas/cobranza/factura-exportacion.repository.js', () => ({
  getProformaEmitidaParaFactura: vi.fn(),
  getEmbarqueParaFacturaDte: vi.fn(),
  getFacturaActivaPorEmbarque: vi.fn(),
  getFacturaByIdConHistorial: vi.fn(),
  getFacturaActivaById: vi.fn(),
  getCuotasPagoNotaVenta: vi.fn(),
  getLineasPalletParaPeso: vi.fn(),
  crearBorrador: vi.fn(),
  actualizarBorrador: vi.fn(),
  marcarFirmada: vi.fn(),
  marcarRechazada: vi.fn(),
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
  obtenerDocumentoDte: vi.fn(),
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
import * as dteService from '../src/modules/finanzas/facturacion/dte-emitidos.service.js'
import * as dteRepo from '../src/modules/finanzas/facturacion/dte-emitidos.repository.js'
import {
  actualizarBorrador,
  crearBorradorDesdeProforma,
  enviarBorradorSii,
  firmar,
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

// El flujo de timbrado se partió en dos pasos (2026-10): enviarBorradorSii crea
// el DTE temporal en LibreDTE (payload FOB + Aduana) y firmar hace el timbrado
// real (folio) y genera las cuotas. Las reglas críticas que antes cubría el test
// de `emitir` (ahora eliminado) se validan aquí contra las funciones vigentes.
describe('firmar', () => {
  const facturaBorrador = {
    id: 10,
    estado: 'BORRADOR' as const,
    embarqueId: 5,
    empresaId: 1,
    montoTotal: 1000,
    fechaDocumento: new Date('2026-09-22'),
  }
  const emisor = { rut: '77.089.369-6', razonSocial: 'Agrosan SpA', giro: 'Exportación', direccion: 'Av X 1', comuna: 'Santiago' }

  it('NO marca firmada y marca RECHAZADA si el timbrado del SII falla', async () => {
    vi.mocked(repo.getFacturaActivaById).mockResolvedValue(facturaBorrador as never)
    vi.mocked(dteService.obtenerDocumentoDte).mockResolvedValue({ estado: 'TEMPORAL_CREADO', folio: null } as never)
    vi.mocked(repo.getEmbarqueParaFacturaDte).mockResolvedValue(embarqueDespachado as never)
    vi.mocked(dteRepo.getEmpresaParaDte).mockResolvedValue(emisor as never)
    vi.mocked(dteService.generarDteReal).mockResolvedValue({ estado: 'RECHAZADO', errorMensaje: 'CAF agotado' } as never)

    await expect(firmar(10, 'u1')).rejects.toThrow(/CAF agotado/)
    expect(repo.marcarRechazada).toHaveBeenCalledWith(10, 'CAF agotado')
    expect(repo.marcarFirmada).not.toHaveBeenCalled()
  })

  it('timbra (folio) y genera las cuotas 60/40 sobre el montoTotal', async () => {
    vi.mocked(repo.getFacturaActivaById).mockResolvedValue(facturaBorrador as never)
    vi.mocked(dteService.obtenerDocumentoDte).mockResolvedValue({ estado: 'TEMPORAL_CREADO', folio: null } as never)
    vi.mocked(repo.getEmbarqueParaFacturaDte).mockResolvedValue(embarqueDespachado as never)
    vi.mocked(dteRepo.getEmpresaParaDte).mockResolvedValue(emisor as never)
    vi.mocked(dteService.generarDteReal).mockResolvedValue({ estado: 'GENERADO', folio: 123, libredteCodigoTemporal: 'TRK-1' } as never)
    vi.mocked(repo.getCuotasPagoNotaVenta).mockResolvedValue([
      { tipoValor: 'PORCENTAJE', porcentaje: 60, montoCalculado: null, fechaReferencia: 'FACTURA', plazoDias: 0 },
      { tipoValor: 'PORCENTAJE', porcentaje: 40, montoCalculado: null, fechaReferencia: 'FACTURA', plazoDias: 30 },
    ] as never)
    vi.mocked(repo.marcarFirmada).mockResolvedValue({ id: 10 } as never)

    await firmar(10, 'u1')

    expect(repo.marcarRechazada).not.toHaveBeenCalled()
    expect(repo.marcarFirmada).toHaveBeenCalledWith(
      10,
      expect.objectContaining({
        folio: 123,
        trackIdSii: 'TRK-1',
        cuotas: [
          expect.objectContaining({ numeroCuota: 1, montoCuota: 600 }),
          expect.objectContaining({ numeroCuota: 2, montoCuota: 400 }),
        ],
      }),
      'u1',
    )
  })

  it('reconcilia sin re-timbrar si el DTE ya está GENERADO (idempotencia)', async () => {
    vi.mocked(repo.getFacturaActivaById).mockResolvedValue(facturaBorrador as never)
    vi.mocked(dteService.obtenerDocumentoDte).mockResolvedValue({ estado: 'GENERADO', folio: 555, libredteCodigoTemporal: 'TRK-9' } as never)
    vi.mocked(repo.getEmbarqueParaFacturaDte).mockResolvedValue(embarqueDespachado as never)
    vi.mocked(repo.getCuotasPagoNotaVenta).mockResolvedValue([] as never)
    vi.mocked(repo.marcarFirmada).mockResolvedValue({ id: 10 } as never)

    await firmar(10, 'u1')

    expect(dteService.generarDteReal).not.toHaveBeenCalled()
    expect(repo.marcarFirmada).toHaveBeenCalledWith(10, expect.objectContaining({ folio: 555, trackIdSii: 'TRK-9' }), 'u1')
  })
})

describe('enviarBorradorSii → payload DTE 110 (valor FOB + Aduana)', () => {
  // Cláusula CIF: el flete y el seguro restan al valor de venta; el detalle se
  // timbra a FOB (factor = (1000−100−100)/1000 = 0.8 → PrcItem 10 × 0.8 = 8),
  // mientras TotClauVenta mantiene el total CIF y MntFlete/MntSeguro van en Aduana.
  const facturaCif = {
    id: 20,
    estado: 'BORRADOR' as const,
    embarqueId: 5,
    empresaId: 1,
    montoTotal: 1000,
    montoFlete: 100,
    montoSeguro: 100,
    tipoCambio: 950,
    fechaDocumento: new Date('2026-09-22'),
    idioma: 'ES' as const,
    condicionPago: null,
    observaciones: null,
    actualizadoEn: new Date('2026-09-22'),
    lineas: [
      { especie: { descripcion: 'Uva de mesa', descripcionExtranjera: null }, variedad: null, articulo: null, calibre: null, categoria: null, etiqueta: null, cantidadCajas: 100, precioUnitario: '10' },
    ],
  }
  const embarqueCif = {
    ...embarqueDespachado,
    naviera: { razonSocial: 'Maersk' },
    naveManual: 'NAVE X',
    numeroBookingManual: 'BK1',
    numeroContenedorManual: 'CONT1',
    numeroSelloManual: 'SELLO1',
    awbBl: 'BL-123',
    notaVenta: {
      ...embarqueDespachado.notaVenta,
      moneda: { codigo: 'USD', descripcion: 'DOLAR USA', descripcionExtranjera: null, esMonedaBase: false },
      cliente: { id: 3, razonSocial: 'Importer LLC', identificador: '99-1', taxId: '99-1', giro: 'Import', direcciones: [{ direccion: 'Main St 1' }] },
      clausulaVenta: { codigo: '3', descripcion: 'CIF', codigoAduana: '3', requiereFlete: true, requiereSeguro: true },
      modalidadVenta: { codigo: '1', descripcion: 'A firme', codigoAduana: '1' },
      tipoEmbarque: { codigo: '1', descripcion: 'Marítimo', codigoAduana: '1' },
      puertoDestino: { codigo: '999', descripcion: 'Shanghai', codigoAduana: '999' },
      paisDestino: { codigo: '563', descripcion: 'China', codigoAduana: '563' },
    },
    puertoZarpe: { codigo: '901', descripcion: 'Valparaíso', codigoAduana: '901' },
  }

  it('timbra el detalle a valor FOB y manda Flete/Seguro en el bloque Aduana', async () => {
    vi.mocked(repo.getFacturaActivaById).mockResolvedValue(facturaCif as never)
    vi.mocked(repo.getEmbarqueParaFacturaDte).mockResolvedValue(embarqueCif as never)
    vi.mocked(dteRepo.getEmpresaParaDte).mockResolvedValue({ rut: '77.089.369-6', razonSocial: 'Agrosan SpA', giro: 'Exportación', direccion: 'Av X 1', comuna: 'Santiago' } as never)
    vi.mocked(repo.getCuotasPagoNotaVenta).mockResolvedValue([] as never)
    vi.mocked(repo.getLineasPalletParaPeso).mockResolvedValue([] as never)
    vi.mocked(dteService.emitirDteTemporal).mockResolvedValue({ estado: 'TEMPORAL_CREADO' } as never)

    await enviarBorradorSii(20, 'u1')

    const { payload } = vi.mocked(dteService.emitirDteTemporal).mock.calls[0][0] as { payload: Record<string, unknown> }
    const detalle = payload.Detalle as Array<Record<string, unknown>>
    expect(detalle[0].PrcItem).toBe(8)
    const transporte = (payload.Encabezado as Record<string, unknown>).Transporte as Record<string, unknown>
    const aduana = transporte.Aduana as Record<string, unknown>
    expect(aduana.TotClauVenta).toBe(1000)
    expect(aduana.MntFlete).toBe(100)
    expect(aduana.MntSeguro).toBe(100)
  })
})
