import { describe, expect, it } from 'vitest'
import { mapFacturaExportacionA110 } from '../src/modules/finanzas/facturacion/mappers/factura-exportacion.mapper.js'

const base = {
  fechaEmision: new Date('2026-09-24T12:00:00Z'),
  monedaAduana: 'DOLAR USA',
  emisor: {
    rut: '77089369-0',
    razonSocial: 'Frutera Agrosan Export SpA',
    giro: 'Exportación de fruta',
    direccion: 'Camino Rural 123',
    comuna: 'Rancagua',
  },
  receptor: {
    razonSocial: 'Global Fruit Importers LLC',
    identificador: '99-1234567',
    giro: 'Import',
    direccion: null,
    nacionalidadCodigo: '563',
  },
  lineas: [
    { descripcion: 'Uva de mesa - Thompson', cantidadCajas: 100, precioUnitario: 12.5 },
    { descripcion: 'Uva de mesa - Crimson', cantidadCajas: 50, precioUnitario: 14 },
  ],
  aduana: {
    codModVenta: '1',
    codClauVenta: '3',
    totalClausulaVenta: 1950,
    codViaTransp: '1',
    codPtoEmbarque: '901',
    codPtoDesembarque: '999',
    paisDestinoCodigo: '563',
  },
}

describe('mapFacturaExportacionA110', () => {
  it('arma el encabezado del DTE 110 con emisor, receptor extranjero y moneda', () => {
    const dte = mapFacturaExportacionA110(base)
    expect(dte.Encabezado.IdDoc.TipoDTE).toBe(110)
    expect(dte.Encabezado.IdDoc.FchEmis).toBe('2026-09-24')
    expect(dte.Encabezado.Emisor.RUTEmisor).toBe('77089369-0')
    // Receptor de exportación usa el RUT genérico de extranjeros.
    expect(dte.Encabezado.Receptor.RUTRecep).toBe('55555555-5')
    const extranjero = (dte.Encabezado.Receptor as Record<string, unknown>).Extranjero as Record<string, unknown>
    expect(extranjero.NumId).toBe('99-1234567')
    expect(extranjero.Nacionalidad).toBe('563')
    const totales = (dte.Encabezado as Record<string, unknown>).Totales as Record<string, unknown>
    expect(totales.TpoMoneda).toBe('DOLAR USA')
  })

  it('incluye la sección Aduana con los códigos provistos', () => {
    const dte = mapFacturaExportacionA110(base)
    const aduana = (dte.Encabezado as Record<string, unknown>).Aduana as Record<string, unknown>
    expect(aduana.CodModVenta).toBe('1')
    expect(aduana.CodClauVenta).toBe('3')
    expect(aduana.TotClauVenta).toBe(1950)
    expect(aduana.CodPtoEmbarque).toBe('901')
    expect(aduana.CodPtoDesemb).toBe('999')
  })

  it('mapea cada línea a Detalle con cantidad, precio e IndExe=1 (exento)', () => {
    const dte = mapFacturaExportacionA110(base)
    expect(dte.Detalle).toHaveLength(2)
    expect(dte.Detalle[0]).toMatchObject({ NmbItem: 'Uva de mesa - Thompson', QtyItem: 100, PrcItem: 12.5, IndExe: 1 })
    expect(dte.Detalle[1]).toMatchObject({ QtyItem: 50, PrcItem: 14 })
  })

  it('omite los códigos de Aduana nulos en vez de enviarlos vacíos', () => {
    const dte = mapFacturaExportacionA110({
      ...base,
      aduana: { ...base.aduana, codModVenta: null, codClauVenta: null, codPtoEmbarque: null },
    })
    const aduana = (dte.Encabezado as Record<string, unknown>).Aduana as Record<string, unknown>
    expect(aduana).not.toHaveProperty('CodModVenta')
    expect(aduana).not.toHaveProperty('CodClauVenta')
    expect(aduana).not.toHaveProperty('CodPtoEmbarque')
    // El total de la cláusula siempre va.
    expect(aduana.TotClauVenta).toBe(1950)
  })
})
