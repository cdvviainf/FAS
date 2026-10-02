import { describe, expect, it } from 'vitest'
import { mapFacturaExportacionA110 } from '../src/modules/finanzas/facturacion/mappers/factura-exportacion.mapper.js'

const base = {
  fechaEmision: new Date('2026-09-24T12:00:00Z'),
  monedaAduana: 'DOLAR USA',
  tipoCambio: null,
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
    montoFlete: null,
    montoSeguro: null,
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

  it('incluye MntFlete/MntSeguro cuando la cláusula los informa', () => {
    const dte = mapFacturaExportacionA110({
      ...base,
      aduana: { ...base.aduana, montoFlete: 4000, montoSeguro: 1000 },
    })
    const aduana = (dte.Encabezado as Record<string, unknown>).Aduana as Record<string, unknown>
    expect(aduana.MntFlete).toBe(4000)
    expect(aduana.MntSeguro).toBe(1000)
  })

  it('omite MntFlete/MntSeguro cuando son nulos (ej. FOB)', () => {
    const dte = mapFacturaExportacionA110(base)
    const aduana = (dte.Encabezado as Record<string, unknown>).Aduana as Record<string, unknown>
    expect(aduana).not.toHaveProperty('MntFlete')
    expect(aduana).not.toHaveProperty('MntSeguro')
  })

  it('emite Encabezado.OtraMoneda (PESO CL + TpoCambio) cuando hay tipo de cambio', () => {
    const dte = mapFacturaExportacionA110({ ...base, tipoCambio: 972.6 })
    const otraMoneda = (dte.Encabezado as Record<string, unknown>).OtraMoneda as Record<string, unknown>
    expect(otraMoneda).toMatchObject({ TpoMoneda: 'PESO CL', TpoCambio: 972.6 })
    // La moneda extranjera de la operación sigue en Totales.
    const totales = (dte.Encabezado as Record<string, unknown>).Totales as Record<string, unknown>
    expect(totales.TpoMoneda).toBe('DOLAR USA')
  })

  it('omite OtraMoneda cuando no hay tipo de cambio (ej. moneda base CLP)', () => {
    const dte = mapFacturaExportacionA110(base)
    expect(dte.Encabezado as Record<string, unknown>).not.toHaveProperty('OtraMoneda')
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

  it('emite transporte, pesos, bultos y Referencia cuando vienen', () => {
    const dte = mapFacturaExportacionA110({
      ...base,
      aduana: {
        ...base.aduana,
        nombreCiaTransp: 'MEDITERRANEAN SHIPPING COMPANY',
        nombreTransp: 'MSC EUGENIA',
        booking: 'EBKG16677344',
        pesoNeto: 18696,
        pesoBruto: 20976,
        totItems: 2,
        totBultos: 2280,
        tipoBulto: { codTpoBultos: '22', cantBultos: 2280, idContainer: 'MSDU9653670' },
      },
      referencias: [{ tpoDocRef: '808', folioRef: 'MEDUW9324551', fecha: '2026-05-09', razonRef: 'B/L' }],
    })
    const aduana = (dte.Encabezado as Record<string, unknown>).Aduana as Record<string, unknown>
    expect(aduana.NombreCiaTransp).toBe('MEDITERRANEAN SHIPPING COMPANY')
    expect(aduana.NombreTransp).toBe('MSC EUGENIA')
    expect(aduana.Booking).toBe('EBKG16677344')
    expect(aduana).toMatchObject({ PesoNeto: 18696, CodUnidPesoNeto: 'KN', PesoBruto: 20976, CodUnidPesoBruto: 'KB' })
    expect(aduana.TotBultos).toBe(2280)
    const bultos = aduana.TipoBultos as Array<Record<string, unknown>>
    expect(bultos[0]).toMatchObject({ CodTpoBultos: '22', CantBultos: 2280, IdContainer: 'MSDU9653670' })
    const refs = (dte as Record<string, unknown>).Referencia as Array<Record<string, unknown>>
    expect(refs[0]).toMatchObject({ NroLinRef: 1, TpoDocRef: '808', FolioRef: 'MEDUW9324551', FchRef: '2026-05-09' })
  })
})
