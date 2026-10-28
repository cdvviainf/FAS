import { describe, expect, it } from 'vitest'
import { mapFacturaExportacionA110 } from '../src/modules/finanzas/facturacion/mappers/factura-exportacion.mapper.js'
import { mapFacturaNacionalADte } from '../src/modules/finanzas/facturacion/mappers/factura-nacional.mapper.js'

// Nota de Crédito de anulación (Ciclo 4): reusa los mappers de factura con
// tipoDte 112/61 + una Referencia a la factura con CodRef=1 (anula documento).

const baseExport = {
  tipoDte: 112,
  fechaEmision: new Date('2026-10-28T12:00:00Z'),
  monedaAduana: 'DOLAR USA',
  tipoCambio: null,
  emisor: { rut: '77089369-0', razonSocial: 'Agrosan', giro: 'Export', direccion: 'Calle 1', comuna: 'Rancagua' },
  receptor: { razonSocial: 'Importer LLC', taxId: '99-1', giro: 'Import', direccion: null, nacionalidadCodigo: '563' },
  lineas: [{ descripcion: 'Uva', cantidadCajas: 100, precioUnitario: 12.5 }],
  aduana: { totalClausulaVenta: 1250, montoFlete: null, montoSeguro: null, paisDestinoCodigo: '563' },
  referencias: [{ tpoDocRef: '110', folioRef: '42', fecha: '2026-10-01', codRef: 1, razonRef: 'Anula factura FEX0042' }],
}

describe('Nota de Crédito de Exportación (DTE 112)', () => {
  it('emite TipoDTE 112 y una Referencia de anulación (CodRef=1) a la factura 110', () => {
    const dte = mapFacturaExportacionA110(baseExport)
    expect(dte.Encabezado.IdDoc.TipoDTE).toBe(112)
    const refs = (dte as Record<string, unknown>).Referencia as Array<Record<string, unknown>>
    expect(refs).toHaveLength(1)
    expect(refs[0]).toMatchObject({ TpoDocRef: '110', FolioRef: '42', CodRef: 1, RazonRef: 'Anula factura FEX0042' })
  })

  it('no emite MntPagos (una NC no lleva programación de pagos)', () => {
    const dte = mapFacturaExportacionA110(baseExport)
    expect(dte.Encabezado.IdDoc).not.toHaveProperty('MntPagos')
  })
})

describe('Nota de Crédito nacional (DTE 61)', () => {
  const baseNacional = {
    tipoDte: 61,
    fechaEmision: new Date('2026-10-28T12:00:00Z'),
    emisor: { rut: '77089369-0', razonSocial: 'Agrosan', giro: 'Venta', direccion: 'Calle 1', comuna: 'Rancagua' },
    receptor: { rut: '76111111-1', razonSocial: 'Cliente Nacional SpA', giro: 'Comercio', direccion: 'Av 2', comuna: 'Santiago' },
    lineas: [{ descripcion: 'Servicio', cantidad: 1, precioUnitario: 100000, exento: false }],
    observaciones: 'Anula factura FNA0007',
    referencias: [{ tpoDocRef: '33', folioRef: '7', fecha: '2026-10-01', codRef: 1, razonRef: 'Anula factura FNA0007' }],
  }

  it('emite TipoDTE 61 y una Referencia de anulación (CodRef=1) a la factura 33/34', () => {
    const dte = mapFacturaNacionalADte(baseNacional)
    expect(dte.Encabezado.IdDoc.TipoDTE).toBe(61)
    const refs = (dte as Record<string, unknown>).Referencia as Array<Record<string, unknown>>
    expect(refs).toHaveLength(1)
    expect(refs[0]).toMatchObject({ TpoDocRef: '33', FolioRef: '7', CodRef: 1 })
  })
})
