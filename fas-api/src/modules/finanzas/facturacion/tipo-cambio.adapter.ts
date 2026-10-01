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

export async function obtenerTipoCambio(
  monedaCodigo: string,
): Promise<TipoCambioObtenido | { error: string }> {
  const serie = SERIE_POR_MONEDA[monedaCodigo?.toUpperCase?.() ?? '']
  if (!serie) {
    return { error: `No hay una fuente automática de tipo de cambio para la moneda ${monedaCodigo}. Ingrésalo manualmente.` }
  }
  try {
    const res = await fetch(`${MINDICADOR_BASE}/${serie}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) {
      return { error: `El servicio de tipo de cambio respondió ${res.status}. Intenta de nuevo o ingrésalo manualmente.` }
    }
    const data = (await res.json().catch(() => null)) as { serie?: { fecha?: string; valor?: number }[] } | null
    const ultimo = data?.serie?.[0]
    if (!ultimo?.valor || !Number.isFinite(Number(ultimo.valor))) {
      return { error: 'El servicio de tipo de cambio no devolvió un valor válido. Ingrésalo manualmente.' }
    }
    return { valor: Number(ultimo.valor), fecha: String(ultimo.fecha ?? '').slice(0, 10) }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error de red al obtener el tipo de cambio' }
  }
}
