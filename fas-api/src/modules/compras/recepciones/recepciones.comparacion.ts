// Comparación pura Excel↔OC (compras.md §7.1/§7.2) — sin acceso a BD a
// propósito: se llama dos veces en el motor (recepciones.motor.ts,
// recepciones.repository.ts) con datos de la OC obtenidos en momentos
// distintos (lectura optimista antes de la transacción vs. relectura
// autoritativa dentro de ella, bajo lock — QA-RCV-007), y no puede vivir en
// ninguno de los dos módulos sin generar un import circular entre ambos.

export interface FilaParaComparar {
  fila: number
  numeroPallet: string
  especieId: number
  variedadId: number
  categoriaId: number
  articuloId: number
  calibreId: number
  calibreLabel: string
  cajas: number
  comboLabel: string
  comboKey: string
}

export interface LineaOcParaComparar {
  especieId: number
  variedadId: number
  categoriaId: number
  articuloId: number
  cantidadPallets: number
  cajas: number
  calibres: Array<{ calibreId: number }>
}

export function compararLineasOcConExcel(lineas: LineaOcParaComparar[], filas: FilaParaComparar[]): string[] {
  const errores: string[] = []

  // Agrupar filas del Excel por combo (especie+variedad+categoria+articulo).
  const porCombo = new Map<string, FilaParaComparar[]>()
  for (const f of filas) {
    const arr = porCombo.get(f.comboKey) ?? []
    arr.push(f)
    porCombo.set(f.comboKey, arr)
  }

  const combosDeLaOc = new Set(lineas.map((l) => `${l.especieId}-${l.variedadId}-${l.categoriaId}-${l.articuloId}`))

  // 1-3: cada línea de la OC contra su grupo del Excel (grupo vacío si la OC
  // trae una combinación que el Excel no trajo en absoluto).
  for (const linea of lineas) {
    const key = `${linea.especieId}-${linea.variedadId}-${linea.categoriaId}-${linea.articuloId}`
    const grupo = porCombo.get(key) ?? []
    const label = grupo[0]?.comboLabel ?? key

    const palletsExcel = new Set(grupo.map((f) => f.numeroPallet)).size
    if (palletsExcel !== linea.cantidadPallets) {
      errores.push(
        `N° de pallets de "${label}": la OC indica ${linea.cantidadPallets} y el Excel trae ${palletsExcel}`,
      )
    }

    const cajasExcel = grupo.reduce((a, f) => a + f.cajas, 0)
    if (cajasExcel !== linea.cajas) {
      const diff = cajasExcel - linea.cajas
      errores.push(
        `Cajas de "${label}": la OC indica ${linea.cajas} y el Excel trae ${cajasExcel} (${diff > 0 ? `${diff} de más` : `${-diff} de menos`})`,
      )
    }

    const calibresPermitidos = new Set(linea.calibres.map((c) => c.calibreId))
    const filasFueraDeLista = grupo.filter((f) => !calibresPermitidos.has(f.calibreId))
    if (filasFueraDeLista.length > 0) {
      const calibresInvalidos = [...new Set(filasFueraDeLista.map((f) => f.calibreLabel))].join(', ')
      const filasTxt = filasFueraDeLista.map((f) => f.fila).join(', ')
      errores.push(
        `Calibre ${calibresInvalidos} de las filas ${filasTxt} del Excel no está en la lista de calibres de "${label}"`,
      )
    }
  }

  // 4: cobertura — combos del Excel que no corresponden a ninguna línea de la OC.
  for (const [key, grupo] of porCombo) {
    if (!combosDeLaOc.has(key)) {
      const filasTxt = grupo.map((f) => f.fila).join(', ')
      errores.push(`"${grupo[0].comboLabel}" de las filas ${filasTxt} del Excel no está en la Orden de Compra`)
    }
  }

  return errores
}
