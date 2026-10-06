// Tipo de cambio observado (paridad peso chileno / moneda extranjera) para el
// DTE 110 de exportación. Fuente: mindicador.cl, que publica el "dólar/euro
// observado" del Banco Central de Chile — el mismo valor que el SII espera en el
// Encabezado.OtraMoneda del documento. API pública sin credenciales (a
// diferencia de LibreDTE/AGL360, que usan el mantenedor de Integraciones).
//
// Se mapea la moneda por su `codigo` ISO (Moneda.codigo = 'USD'/'EUR'/...). Si
// no hay serie para la moneda, el caller cae a ingreso manual del valor.

const MINDICADOR_BASE = 'https://mindicador.cl/api'

// Moneda.codigo (ISO 4217) -> código de serie de mindicador.cl.
const SERIE_POR_MONEDA: Record<string, string> = {
  USD: 'dolar',
  EUR: 'euro',
}

export interface TipoCambioObtenido {
  valor: number // pesos chilenos por 1 unidad de la moneda extranjera
  fecha: string // 'YYYY-MM-DD' de la paridad observada
}

type SerieMindicador = { serie?: { fecha?: string; valor?: number }[] }

async function fetchJson(url: string): Promise<SerieMindicador | { error: string }> {
  const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(6_000) })
  if (!res.ok) {
    return { error: `El servicio de tipo de cambio respondió ${res.status}. Intenta de nuevo o ingrésalo manualmente.` }
  }
  return ((await res.json().catch(() => null)) as SerieMindicador | null) ?? { error: 'Respuesta inválida del servicio de tipo de cambio' }
}

function fechaIsoUtc(d: Date): string {
  return d.toISOString().slice(0, 10)
}

// Dentro de la serie del año `anio`, el valor del día hábil MÁS RECIENTE cuya
// fecha sea <= `hastaIso` (2026-10-06, "día hábil anterior más cercano"). Las
// fechas ISO comparan lexicográficamente.
function valorHastaFecha(data: SerieMindicador, hastaIso: string): TipoCambioObtenido | null {
  const candidatos = (data.serie ?? [])
    .map((s) => ({ fecha: String(s.fecha ?? '').slice(0, 10), valor: Number(s.valor) }))
    .filter((s) => s.fecha && Number.isFinite(s.valor) && s.fecha <= hastaIso)
    .sort((a, b) => (a.fecha < b.fecha ? 1 : -1))
  const top = candidatos[0]
  return top ? { valor: top.valor, fecha: top.fecha } : null
}

export async function obtenerTipoCambio(
  monedaCodigo: string,
  // Fecha del documento (2026-10-06): si se entrega, se toma la paridad de esa
  // fecha o la del día hábil anterior más cercano. Sin fecha → valor más reciente.
  fecha?: Date,
): Promise<TipoCambioObtenido | { error: string }> {
  const serie = SERIE_POR_MONEDA[monedaCodigo?.toUpperCase?.() ?? '']
  if (!serie) {
    return { error: `No hay una fuente automática de tipo de cambio para la moneda ${monedaCodigo}. Ingrésalo manualmente.` }
  }
  try {
    if (!fecha) {
      // Sin fecha: valor más reciente publicado (comportamiento previo).
      const data = await fetchJson(`${MINDICADOR_BASE}/${serie}`)
      if ('error' in data) return data
      const ultimo = data.serie?.[0]
      if (!ultimo?.valor || !Number.isFinite(Number(ultimo.valor))) {
        return { error: 'El servicio de tipo de cambio no devolvió un valor válido. Ingrésalo manualmente.' }
      }
      return { valor: Number(ultimo.valor), fecha: String(ultimo.fecha ?? '').slice(0, 10) }
    }

    // Con fecha: se consulta la serie del año y se toma el día hábil <= fecha más
    // reciente. Si la fecha cae a comienzos de año sin día hábil previo en ese
    // año, se consulta el año anterior (borde de año).
    const hastaIso = fechaIsoUtc(fecha)
    const anio = fecha.getUTCFullYear()
    const dataAnio = await fetchJson(`${MINDICADOR_BASE}/${serie}/${anio}`)
    if ('error' in dataAnio) return dataAnio
    let tc = valorHastaFecha(dataAnio, hastaIso)
    if (!tc) {
      const dataPrev = await fetchJson(`${MINDICADOR_BASE}/${serie}/${anio - 1}`)
      if (!('error' in dataPrev)) tc = valorHastaFecha(dataPrev, hastaIso)
    }
    if (!tc) {
      return { error: `No se encontró tipo de cambio publicado para la fecha ${hastaIso} ni días hábiles anteriores. Ingrésalo manualmente.` }
    }
    return tc
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error de red al obtener el tipo de cambio' }
  }
}
