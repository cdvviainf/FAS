// Emisión del Packing List (reporte Excel, 2026-10-25). Mismas columnas que el
// Packing List de Edge2 pero con layout propio de FAS (una sola hoja: cabecera
// arriba, tabla de pallets, totales calculados acá). Sin VLOOKUP/SUMIF ni las 3
// hojas del archivo original. Los datos vienen de getDatosEmisionPackingList.
import ExcelJS from 'exceljs'
import { Prisma } from '@prisma/client'
import type * as repo from './embarques.repository.js'

type DatosEmision = NonNullable<Awaited<ReturnType<typeof repo.getDatosEmisionPackingList>>>

const fmtFecha = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : '')

const COLUMNAS = [
  'N° Pallet', 'Container', 'Tº', 'Termógrafo', 'CSG', 'GGN',
  'Productor', 'Comuna Prod.', 'Provincia Prod.',
  'CSP', 'Packing', 'Comuna Pack.', 'Provincia Pack.',
  'Especie', 'Variedad', 'Categoría', 'Calibre', 'Fecha Embalaje',
  'Artículo', 'Kg Neto Envase', 'Etiqueta', 'Cajas', 'Net Kg',
  'N° Guía', 'Emisor Guía',
]

export async function generarPackingListExcel(
  datos: DatosEmision,
  empresa: { razonSocial: string; rut: string | null },
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Packing List')

  // Container/nave/ETD: según reservaManual, del Embarque o de la Solicitud de
  // Reserva (AGL360) — mismo criterio que el resto del módulo.
  const nave = datos.reservaManual ? datos.naveManual : datos.solicitudReserva?.nave ?? null
  const etd = datos.reservaManual ? datos.fechaZarpeManual : datos.solicitudReserva?.fechaZarpe ?? null
  const container = datos.numeroContenedorManual ?? datos.solicitudReserva?.numeroContenedor ?? null
  const cliente = datos.notaVenta.cliente

  // Exporter + RUT (FAS-PLE-R2-003): manda el exportador de la Nota de Venta
  // (EXPORTADORA, con su propio RUT = identificador). Si la NV no tiene
  // exportador ("Sin exportador"), cae a la Empresa activa (decisión 2026-10-25).
  const exportador = datos.notaVenta.exportador
  const exporterNombre = exportador?.razonSocial ?? empresa.razonSocial
  const exporterRut = exportador ? exportador.identificador ?? '' : empresa.rut ?? ''

  // ── Cabecera (pares etiqueta/valor) ──
  const cabecera: Array<[string, string]> = [
    ['Exporter', exporterNombre],
    ['Exporter RUT', exporterRut],
    ['Customer', cliente.razonSocial],
    ['S.I.I. Receptor', cliente.taxId ?? cliente.identificador ?? ''],
    ['Consignee', datos.notaVenta.consignatario?.razonSocial ?? ''],
    ['Instructive', datos.numeroInstructivo],
    ['Vessel', nave ?? ''],
    ['Departure Port', datos.puertoZarpe?.descripcion ?? ''],
    ['Arrival Port', datos.notaVenta.puertoDestino?.descripcion ?? ''],
    ['ETD', fmtFecha(etd)],
    ['ETA', fmtFecha(datos.fechaArribo)],
    ['Container(s)', container ?? ''],
    ['BL/AWB', datos.awbBl ?? ''],
  ]
  for (const [k, v] of cabecera) {
    const row = ws.addRow([k, v])
    row.getCell(1).font = { bold: true }
  }
  ws.addRow([])

  // ── Tabla de pallets (una fila por línea de pallet) ──
  const headerRow = ws.addRow(COLUMNAS)
  headerRow.font = { bold: true }
  headerRow.eachCell((c) => {
    c.border = { bottom: { style: 'thin' } }
  })

  let totalCajas = 0
  let totalNetKg = new Prisma.Decimal(0)
  const palletsDistintos = new Set<string>()

  for (const p of datos.pallets) {
    palletsDistintos.add(p.numeroPallet)
    // CSG/GGN/comuna del productor: best-effort — solo si tiene un único Predio.
    const predioUnico = p.productor.predios.length === 1 ? p.productor.predios[0] : null
    const comunaPack = p.recepcion.planta.direcciones[0]?.comuna ?? null

    for (const l of p.lineas) {
      const kgEnv = l.articulo.kgNetoEnvase ? new Prisma.Decimal(l.articulo.kgNetoEnvase) : new Prisma.Decimal(0)
      const netKg = kgEnv.mul(l.cajas)
      totalCajas += l.cajas
      totalNetKg = totalNetKg.plus(netKg)
      ws.addRow([
        p.numeroPallet,
        container ?? '',
        p.temperatura != null ? Number(p.temperatura) : '',
        p.termografo ?? '',
        predioUnico?.codigoCsg ?? '',
        predioUnico?.codigoGgn ?? '',
        p.productor.razonSocial,
        predioUnico?.comuna?.descripcion ?? '',
        predioUnico?.comuna?.provincia?.descripcion ?? '',
        p.recepcion.planta.csp ?? '',
        p.recepcion.planta.razonSocial,
        comunaPack?.descripcion ?? '',
        comunaPack?.provincia?.descripcion ?? '',
        l.especie.descripcion,
        l.variedad.descripcion,
        l.categoria.descripcion,
        l.calibre.descripcion,
        fmtFecha(l.fechaEmbalaje),
        l.articulo.codigo,
        kgEnv.toNumber(),
        l.etiqueta?.descripcion ?? '',
        l.cajas,
        netKg.toNumber(),
        p.numeroGuiaDespacho ?? '',
        p.emisorGuia?.razonSocial ?? '',
      ])
    }
  }

  // ── Totales ──
  const totales: (string | number)[] = new Array(COLUMNAS.length).fill('')
  totales[0] = 'Total'
  totales[21] = totalCajas // Cajas
  totales[22] = totalNetKg.toNumber() // Net Kg
  const totalRow = ws.addRow(totales)
  totalRow.font = { bold: true }
  const palletsRow = ws.addRow(['Total pallets', palletsDistintos.size])
  palletsRow.getCell(1).font = { bold: true }

  // Anchos de columna razonables.
  ws.columns.forEach((c) => {
    c.width = Math.max(c.width ?? 10, 14)
  })

  const buf = await wb.xlsx.writeBuffer()
  return Buffer.from(buf)
}
