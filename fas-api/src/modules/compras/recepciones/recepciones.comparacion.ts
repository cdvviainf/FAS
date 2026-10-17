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
  etiquetaId: number
  etiquetaLabel?: string
  cajas: number
  comboLabel: string
  comboKey: string
}

export interface LineaOcParaComparar {
  especieId: number
  variedadId: number
  categoriaId: number
  articuloId: number
  // Etiqueta de la línea de OC (2026-10-15): null en OCs históricas → no se
  // valida acá (el motor igual exige que la etiqueta esté en el set del artículo).
  etiquetaId: number | null
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

  const comboKeyLinea = (l: LineaOcParaComparar) => `${l.especieId}-${l.variedadId}-${l.categoriaId}-${l.articuloId}`

  // Agrupar líneas de OC por combo (especie/variedad/categoría/artículo).
  const lineasPorCombo = new Map<string, LineaOcParaComparar[]>()
  for (const l of lineas) {
    const k = comboKeyLinea(l)
    const arr = lineasPorCombo.get(k) ?? []
    arr.push(l)
    lineasPorCombo.set(k, arr)
  }

  // Evalúa un conjunto de líneas INDISTINGUIBLES (mismo combo+etiqueta, o varias
  // históricas del combo) contra su conjunto de filas: compara TOTALES agregados
  // (suma de pallets/cajas, unión de calibres). Esto resuelve de forma unificada:
  // dos líneas de distinta etiqueta no se pisan (FAS-EOCSP-002); legacy + nueva
  // del mismo combo no se solapan (FAS-EOCSP-005); y líneas duplicadas
  // indistinguibles no se rechazan por el orden (FAS-EOCSP-006).
  const evaluarGrupo = (grupoLineas: LineaOcParaComparar[], filasGrupo: FilaParaComparar[], label: string) => {
    const palletsEsperados = grupoLineas.reduce((a, l) => a + l.cantidadPallets, 0)
    const cajasEsperadas = grupoLineas.reduce((a, l) => a + l.cajas, 0)

    const palletsExcel = new Set(filasGrupo.map((f) => f.numeroPallet)).size
    if (palletsExcel !== palletsEsperados) {
      errores.push(`N° de pallets de "${label}": la OC indica ${palletsEsperados} y el Excel trae ${palletsExcel}`)
    }
    const cajasExcel = filasGrupo.reduce((a, f) => a + f.cajas, 0)
    if (cajasExcel !== cajasEsperadas) {
      const diff = cajasExcel - cajasEsperadas
      errores.push(
        `Cajas de "${label}": la OC indica ${cajasEsperadas} y el Excel trae ${cajasExcel} (${diff > 0 ? `${diff} de más` : `${-diff} de menos`})`,
      )
    }
    const calibresPermitidos = new Set(grupoLineas.flatMap((l) => l.calibres.map((c) => c.calibreId)))
    const filasFueraDeLista = filasGrupo.filter((f) => !calibresPermitidos.has(f.calibreId))
    if (filasFueraDeLista.length > 0) {
      const calibresInvalidos = [...new Set(filasFueraDeLista.map((f) => f.calibreLabel))].join(', ')
      const filasTxt = filasFueraDeLista.map((f) => f.fila).join(', ')
      errores.push(`Calibre ${calibresInvalidos} de las filas ${filasTxt} del Excel no está en la lista de calibres de "${label}"`)
    }
  }

  const disponible = new Set(filas) // filas aún no asignadas a ningún grupo

  for (const [combo, lineasCombo] of lineasPorCombo) {
    const filasCombo = (porCombo.get(combo) ?? []).filter((f) => disponible.has(f))
    const comboLabel = filasCombo[0]?.comboLabel ?? combo

    // Líneas específicas (con etiqueta): un grupo por etiquetaId.
    const porEtiqueta = new Map<number, LineaOcParaComparar[]>()
    for (const l of lineasCombo) {
      if (l.etiquetaId == null) continue
      const arr = porEtiqueta.get(l.etiquetaId) ?? []
      arr.push(l)
      porEtiqueta.set(l.etiquetaId, arr)
    }
    const etiquetasReclamadas = new Set<number>()
    for (const [etq, grupoLineas] of porEtiqueta) {
      etiquetasReclamadas.add(etq)
      const filasGrupo = filasCombo.filter((f) => f.etiquetaId === etq)
      for (const f of filasGrupo) disponible.delete(f)
      const etqLabel = filasGrupo[0]?.etiquetaLabel ?? `etiqueta ${etq}`
      evaluarGrupo(grupoLineas, filasGrupo, `${comboLabel} [${etqLabel}]`)
    }

    // Líneas históricas (sin etiqueta): toman el remanente del combo cuyas
    // etiquetas no fueron reclamadas por una línea específica.
    const historicas = lineasCombo.filter((l) => l.etiquetaId == null)
    if (historicas.length > 0) {
      const filasRem = filasCombo.filter((f) => !etiquetasReclamadas.has(f.etiquetaId))
      for (const f of filasRem) disponible.delete(f)
      evaluarGrupo(historicas, filasRem, comboLabel)
    }
  }

  // 4: cobertura — filas del Excel que ningún grupo consumió (combo o etiqueta
  // sin correspondencia en la OC). Agrupadas por combo+etiqueta para el mensaje.
  const filasNoCubiertas = filas.filter((f) => disponible.has(f))
  const porNoCubierta = new Map<string, FilaParaComparar[]>()
  for (const f of filasNoCubiertas) {
    const k = `${f.comboKey}|${f.etiquetaId}`
    const arr = porNoCubierta.get(k) ?? []
    arr.push(f)
    porNoCubierta.set(k, arr)
  }
  for (const grupo of porNoCubierta.values()) {
    const filasTxt = grupo.map((f) => f.fila).join(', ')
    const etqTxt = grupo[0].etiquetaLabel ? ` [${grupo[0].etiquetaLabel}]` : ''
    errores.push(`"${grupo[0].comboLabel}${etqTxt}" de las filas ${filasTxt} del Excel no está en la Orden de Compra`)
  }

  return errores
}

// ─── Comparación pura Excel↔Instructivo de Embalaje (2026-09-02) ──────────
// Reemplaza la validación por folios de Calidad (Calidad ya no emite
// veredicto ni aprueba folios, ver calidad.md): cada N° de Pallet del Excel
// se compara directamente contra el detalle combinado de los Instructivos
// seleccionados en la Recepción. Ya no hay folio que exista o no — solo se
// evalúa si las características calzan. El resultado es una lista de
// ADVERTENCIAS (no errores): el motor decide si abortar o seguir según si el
// usuario ya las aceptó (todo o nada, ver recepciones.motor.ts).

export interface FilaInstructivoParaComparar {
  numeroPallet: string
  especieId: number
  variedadId: number
  categoriaId: number
  articuloId: number
  calibreId: number
}

export interface LineaInstructivoParaComparar {
  especieId: number
  variedadId: number
  categoriaId: number
  articuloId: number
  calibres: Array<{ calibreId: number }>
}

export function compararInstructivoConExcel(detalle: LineaInstructivoParaComparar[], filas: FilaInstructivoParaComparar[]): string[] {
  const filasPorPallet = new Map<string, FilaInstructivoParaComparar[]>()
  for (const f of filas) {
    const arr = filasPorPallet.get(f.numeroPallet) ?? []
    arr.push(f)
    filasPorPallet.set(f.numeroPallet, arr)
  }

  const advertencias: string[] = []
  for (const [numero, filasDelPallet] of filasPorPallet) {
    const calzaAlguna = filasDelPallet.every((fila) =>
      detalle.some(
        (l) =>
          l.especieId === fila.especieId &&
          l.variedadId === fila.variedadId &&
          l.categoriaId === fila.categoriaId &&
          l.articuloId === fila.articuloId &&
          l.calibres.some((c) => c.calibreId === fila.calibreId),
      ),
    )
    if (!calzaAlguna) {
      advertencias.push(
        `N° de Pallet "${numero}": sus características (especie/variedad/categoría/artículo/calibre) no coinciden con ninguna línea de los Instructivos de Embalaje seleccionados`,
      )
    }
  }
  return advertencias
}
