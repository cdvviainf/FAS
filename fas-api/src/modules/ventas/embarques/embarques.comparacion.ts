// Comparación pura Pallet↔detalle de NV (ventas.md R8: "la fruta asignada al
// contenedor debe estar ⊆ detalle de la NV") — solo catálogo (especie/
// variedad/categoría/artículo/calibre), sin tope de cantidad (decisión de
// negocio, Christian, 2026-09-02). Sin acceso a BD a propósito, mismo motivo
// que recepciones.comparacion.ts: se llama tanto en el listado de
// disponibles como en la reserva bajo lock, con datos leídos en momentos
// distintos.

export interface LineaPalletParaComparar {
  especieId: number
  variedadId: number
  categoriaId: number
  articuloId: number
  calibreId: number
}

export interface LineaNotaVentaParaComparar {
  especieId: number
  variedadId: number
  // null = la línea de la NV no exige una categoría puntual (categoriaId es
  // nullable en NotaVentaDetalle, a diferencia de OrdenCompraLinea).
  categoriaId: number | null
  articuloId: number
  calibres: Array<{ calibreId: number }>
  // Calidad / Condición "hasta" de la línea (2026-11-09, antes del encabezado):
  // orden máximo admitido. null/undefined = sin restricción en esa dimensión.
  calidadHastaOrden?: number | null
  condicionHastaOrden?: number | null
}

// Notas del pallet (orden de su Nota de Calidad / Condición). null = el
// pallet no tiene nota en esa dimensión.
export interface NotasPalletParaComparar {
  calidadOrden: number | null
  condicionOrden: number | null
}

// Regla "hasta" por línea: un pallet sin nota en una dimensión restringida no
// califica (mismo criterio que tenía la regla de encabezado).
export function lineaAdmiteNotas(ln: LineaNotaVentaParaComparar, notas: NotasPalletParaComparar): boolean {
  if (ln.calidadHastaOrden != null && (notas.calidadOrden == null || notas.calidadOrden > ln.calidadHastaOrden)) return false
  if (ln.condicionHastaOrden != null && (notas.condicionOrden == null || notas.condicionOrden > ln.condicionHastaOrden)) return false
  return true
}

function lineaCalzaCatalogo(ln: LineaNotaVentaParaComparar, lp: LineaPalletParaComparar): boolean {
  return (
    ln.especieId === lp.especieId &&
    ln.variedadId === lp.variedadId &&
    ln.articuloId === lp.articuloId &&
    (ln.categoriaId === null || ln.categoriaId === lp.categoriaId) &&
    ln.calibres.some((c) => c.calibreId === lp.calibreId)
  )
}

// Un pallet "calza" con el detalle de la NV si TODAS sus líneas encuentran
// alguna línea de la NV compatible (especie+variedad+artículo iguales,
// categoría igual o sin exigencia, calibre dentro de la lista de esa línea).
//
// `notas` (2026-11-09): si se pasa, la línea de la NV que calza debe además
// admitir la Nota de Calidad / Condición del pallet (regla "hasta" por línea).
// Sin `notas` se compara solo catálogo (usos que no reservan pallets).
export function palletCalzaConDetalleNV(
  lineasPallet: LineaPalletParaComparar[],
  detalleNV: LineaNotaVentaParaComparar[],
  notas?: NotasPalletParaComparar,
): boolean {
  return lineasPallet.every((lp) =>
    detalleNV.some((ln) => lineaCalzaCatalogo(ln, lp) && (!notas || lineaAdmiteNotas(ln, notas))),
  )
}

// Precio sugerido de la Proforma (cobranza.md, 2026-09-24): mismo criterio de
// calce que arriba, pero devuelve el `precio` (por caja) de la línea de NV
// que corresponde a esta línea de pallet en vez de un booleano — sugerencia
// editable, no una validación bloqueante. `null` si ninguna línea de la NV
// calza (ej. el detalle de la NV cambió después de reservar el pallet); en
// ese caso el service trata la línea como precio 0, no bloquea la emisión.
export interface LineaNotaVentaConPrecioParaComparar extends LineaNotaVentaParaComparar {
  precio: number
}

//
// `notas` (2026-11-09): con Calidad / Condición por línea, dos líneas pueden
// diferir solo en la calidad (y en el precio) — se prefiere la que admite las
// notas del pallet; si ninguna, cae a la primera que calza por catálogo.
export function precioNVParaLineaPallet(
  lineaPallet: LineaPalletParaComparar,
  detalleNV: LineaNotaVentaConPrecioParaComparar[],
  notas?: NotasPalletParaComparar,
): number | null {
  const candidatas = detalleNV.filter((ln) => lineaCalzaCatalogo(ln, lineaPallet))
  const match = (notas ? candidatas.find((ln) => lineaAdmiteNotas(ln, notas)) : undefined) ?? candidatas[0]
  return match ? match.precio : null
}

// ─── Comparación pura Packing List ↔ Stock (compras.md §9.3, cierra
// EP-QA-003) — mismo motivo que arriba (sin acceso a BD): el motor la llama
// después de leer tanto los pallets reservados como el Excel ya resuelto.

// Paso 1: los N° de Pallet del PL deben ser EXACTAMENTE los reservados al
// Embarque (compras.md §9.3: "los números de pallet del PL = los números de
// pallet reservados al embarque") — ni de más ni de menos.
export function compararNumerosPalletConReserva(numerosExcel: string[], numerosReservados: string[]): string[] {
  const enExcel = new Set(numerosExcel)
  const reservados = new Set(numerosReservados)
  const errores: string[] = []

  const faltantes = [...reservados].filter((n) => !enExcel.has(n))
  if (faltantes.length > 0) {
    errores.push(`Pallets reservados a este Embarque que no vienen en el Packing List: ${faltantes.join(', ')}`)
  }
  const sobrantes = [...enExcel].filter((n) => !reservados.has(n))
  if (sobrantes.length > 0) {
    errores.push(`N° de Pallet del Packing List que no están reservados a este Embarque: ${sobrantes.join(', ')}`)
  }
  return errores
}

// Packing List parcializado (2026-09-28): un archivo puede cubrir SOLO un
// subconjunto de los pallets reservados, así que NO se exige que estén todos
// (eso se valida a nivel de la unión, al despachar). Solo son error los
// "ajenos" (N° de Pallet que no están reservados a este Embarque).
export function compararSubconjuntoConReserva(numerosExcel: string[], numerosReservados: string[]): string[] {
  const reservados = new Set(numerosReservados)
  const ajenos = [...new Set(numerosExcel)].filter((n) => !reservados.has(n))
  if (ajenos.length === 0) return []
  return [`N° de Pallet del Packing List que no están reservados a este Embarque: ${ajenos.join(', ')}`]
}

export interface FilaPackingListParaComparar {
  fila: number
  numeroPallet: string
  especieId: number
  variedadId: number
  categoriaId: number
  articuloId: number
  calibreId: number
  cajas: number
  productorId: number
  comboLabel: string
}

export interface PalletStockParaComparar {
  numeroPallet: string
  productorId: number
  lineas: Array<{
    especieId: number
    variedadId: number
    categoriaId: number
    articuloId: number
    calibreId: number
    cajas: number
  }>
}

// Paso 2: el detalle de cada pallet que SÍ calza en el paso 1 (mismo N° a
// ambos lados) debe coincidir con el Stock real — productor y, agrupado por
// combo (especie/variedad/categoría/artículo/calibre), las cajas. Pallets
// solo del Excel o solo reservados ya se reportaron en el paso 1 — no se
// duplican acá.
export function compararDetallePalletsConStock(
  filasExcelPorPallet: Map<string, FilaPackingListParaComparar[]>,
  palletsStock: PalletStockParaComparar[],
): string[] {
  const errores: string[] = []
  const stockPorNumero = new Map(palletsStock.map((p) => [p.numeroPallet, p]))

  for (const [numeroPallet, filas] of filasExcelPorPallet) {
    const stock = stockPorNumero.get(numeroPallet)
    if (!stock) continue

    const productorExcel = filas[0].productorId
    if (productorExcel !== stock.productorId) {
      errores.push(`Pallet "${numeroPallet}": el Packing List trae un Productor distinto al registrado en Stock`)
    }

    const comboKey = (l: { especieId: number; variedadId: number; categoriaId: number; articuloId: number; calibreId: number }) =>
      `${l.especieId}-${l.variedadId}-${l.categoriaId}-${l.articuloId}-${l.calibreId}`

    const cajasExcelPorCombo = new Map<string, number>()
    const labelPorCombo = new Map<string, string>()
    for (const f of filas) {
      const key = comboKey(f)
      cajasExcelPorCombo.set(key, (cajasExcelPorCombo.get(key) ?? 0) + f.cajas)
      labelPorCombo.set(key, f.comboLabel)
    }

    const cajasStockPorCombo = new Map<string, number>()
    for (const l of stock.lineas) {
      const key = comboKey(l)
      cajasStockPorCombo.set(key, (cajasStockPorCombo.get(key) ?? 0) + l.cajas)
    }

    const combos = new Set([...cajasExcelPorCombo.keys(), ...cajasStockPorCombo.keys()])
    for (const key of combos) {
      const cajasExcel = cajasExcelPorCombo.get(key) ?? 0
      const cajasStock = cajasStockPorCombo.get(key) ?? 0
      if (cajasExcel !== cajasStock) {
        const label = labelPorCombo.get(key) ?? key
        errores.push(`Pallet "${numeroPallet}" (${label}): el Packing List trae ${cajasExcel} cajas y Stock tiene ${cajasStock}`)
      }
    }
  }

  return errores
}
