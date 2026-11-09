// Adaptadores de fuentes de tipo de cambio observado (CLP por 1 unidad de la
// moneda extranjera) — 2026-11-09. Cada fuente responde en su propio formato;
// todas devuelven { valor, fecha } del día hábil MÁS RECIENTE con fecha <= la
// pedida (o el más reciente publicado si no se pide fecha), o { error }.
//
// Integraciones (Configuración → Integraciones), codigo → parámetros:
//   TC_CMF        API_KEY (sensible)              — api.cmfchile.cl (CMF)
//   TC_BCENTRAL   USUARIO, PASSWORD (sensible)     — si3.bcentral.cl (API SIETE)
//   TC_MINDICADOR (sin parámetros)                 — mindicador.cl
// `url` de la Integración, si viene, reemplaza la URL base por defecto.

export interface TipoCambioObtenido {
  valor: number // pesos chilenos por 1 unidad de la moneda extranjera
  fecha: string // 'YYYY-MM-DD' de la paridad observada
}
export type ResultadoFuente = TipoCambioObtenido | { error: string }

export interface ContextoFuente {
  url: string | null
  parametro: (idExterno: string) => Promise<string | null>
}

const TIMEOUT_MS = 6_000
const VENTANA_DIAS = 10 // días hacia atrás para encontrar el último día hábil publicado

function iso(d: Date) {
  return d.toISOString().slice(0, 10)
}
function menosDias(d: Date, n: number) {
  return new Date(d.getTime() - n * 86_400_000)
}

async function getJson(url: string): Promise<unknown | { error: string }> {
  const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (!res.ok) return { error: `respondió ${res.status}` }
  const data = await res.json().catch(() => null)
  return data ?? { error: 'respuesta inválida' }
}
function esError(x: unknown): x is { error: string } {
  return !!x && typeof x === 'object' && 'error' in x && typeof (x as { error: unknown }).error === 'string'
}

// Toma el día hábil más reciente con fecha <= hastaIso de una lista normalizada,
// dentro de la ventana de VENTANA_DIAS (TCQA-R2-003: nunca un valor más antiguo,
// aunque la fuente devuelva la serie completa).
function ultimoHasta(obs: Array<{ fecha: string; valor: number }>, hastaIso: string): TipoCambioObtenido | null {
  const desdeIso = iso(menosDias(new Date(`${hastaIso}T00:00:00.000Z`), VENTANA_DIAS))
  const c = obs
    .filter((o) => o.fecha && Number.isFinite(o.valor) && o.valor > 0 && o.fecha <= hastaIso && o.fecha >= desdeIso)
    .sort((a, b) => (a.fecha < b.fecha ? 1 : -1))[0]
  return c ? { valor: c.valor, fecha: c.fecha } : null
}

// ─── mindicador.cl ──────────────────────────────────────────────────────────
const MINDICADOR_SERIE: Record<string, string> = { USD: 'dolar', EUR: 'euro' }
type SerieMindicador = { serie?: { fecha?: string; valor?: number }[] }

export async function fuenteMindicador(moneda: string, fecha: Date | undefined, ctx: ContextoFuente): Promise<ResultadoFuente> {
  const serie = MINDICADOR_SERIE[moneda]
  if (!serie) return { error: `sin serie para ${moneda}` }
  const base = (ctx.url || 'https://mindicador.cl/api').replace(/\/$/, '')
  const norm = (d: SerieMindicador) =>
    (d.serie ?? []).map((s) => ({ fecha: String(s.fecha ?? '').slice(0, 10), valor: Number(s.valor) }))
  if (!fecha) {
    const d = await getJson(`${base}/${serie}`)
    if (esError(d)) return d
    return ultimoHasta(norm(d as SerieMindicador), iso(new Date())) ?? { error: 'sin valor publicado en los últimos días' }
  }
  const hastaIso = iso(fecha)
  const anio = fecha.getUTCFullYear()
  const d = await getJson(`${base}/${serie}/${anio}`)
  if (esError(d)) return d
  let tc = ultimoHasta(norm(d as SerieMindicador), hastaIso)
  if (!tc) {
    // Borde de año: sin día hábil previo en el año pedido → año anterior.
    const p = await getJson(`${base}/${serie}/${anio - 1}`)
    if (!esError(p)) tc = ultimoHasta(norm(p as SerieMindicador), hastaIso)
  }
  return tc ?? { error: `sin valor publicado hasta ${hastaIso}` }
}

// ─── CMF (api.cmfchile.cl, API SBIF v3) ─────────────────────────────────────
// /{recurso}/periodo/{a}/{m}/dias_i/{d}/{a}/{m}/dias_f/{d}?apikey=..&formato=json
// Respuesta: { "Dolares": [{ "Valor": "945,32", "Fecha": "2026-11-06" }] } (Euros para EUR).
const CMF_RECURSO: Record<string, { recurso: string; clave: string }> = {
  USD: { recurso: 'dolar', clave: 'Dolares' },
  EUR: { recurso: 'euro', clave: 'Euros' },
}
function numeroCmf(v: unknown) {
  // "1.045,32" → 1045.32
  return Number(String(v ?? '').replace(/\./g, '').replace(',', '.'))
}

export async function fuenteCmf(moneda: string, fecha: Date | undefined, ctx: ContextoFuente): Promise<ResultadoFuente> {
  const r = CMF_RECURSO[moneda]
  if (!r) return { error: `sin serie para ${moneda}` }
  const apiKey = await ctx.parametro('API_KEY')
  if (!apiKey) return { error: 'falta el parámetro API_KEY' }
  const base = (ctx.url || 'https://api.cmfchile.cl/api-sbifv3/recursos_api').replace(/\/$/, '')
  const hasta = fecha ?? new Date()
  const desde = menosDias(hasta, VENTANA_DIAS)
  const seg = (d: Date) => `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`
  const url =
    `${base}/${r.recurso}/periodo/${seg(desde)}/dias_i/${String(desde.getUTCDate()).padStart(2, '0')}` +
    `/${seg(hasta)}/dias_f/${String(hasta.getUTCDate()).padStart(2, '0')}?apikey=${encodeURIComponent(apiKey)}&formato=json`
  const d = await getJson(url)
  if (esError(d)) return d
  const lista = (d as Record<string, unknown>)[r.clave]
  if (!Array.isArray(lista)) return { error: 'respuesta sin datos' }
  const obs = lista.map((o: Record<string, unknown>) => ({ fecha: String(o.Fecha ?? '').slice(0, 10), valor: numeroCmf(o.Valor) }))
  return ultimoHasta(obs, iso(hasta)) ?? { error: `sin valor publicado hasta ${iso(hasta)}` }
}

// ─── Banco Central de Chile (API SIETE) ─────────────────────────────────────
// SieteRestWS.ashx?user=..&pass=..&firstdate=..&lastdate=..&timeseries=..&function=GetSeries
// Respuesta: { Codigo: 0, Series: { Obs: [{ indexDateString: "06-11-2026", value: "945.32", statusCode: "OK" }] } }
const BCENTRAL_SERIE: Record<string, string> = {
  USD: 'F073.TCO.PRE.Z.D', // dólar observado
  EUR: 'F072.CLP.EUR.N.O.D', // euro
}

export async function fuenteBancoCentral(moneda: string, fecha: Date | undefined, ctx: ContextoFuente): Promise<ResultadoFuente> {
  const serie = BCENTRAL_SERIE[moneda]
  if (!serie) return { error: `sin serie para ${moneda}` }
  const [usuario, password] = await Promise.all([ctx.parametro('USUARIO'), ctx.parametro('PASSWORD')])
  if (!usuario || !password) return { error: 'faltan los parámetros USUARIO y/o PASSWORD' }
  const base = ctx.url || 'https://si3.bcentral.cl/SieteRestWS/SieteRestWS.ashx'
  const hasta = fecha ?? new Date()
  const desde = menosDias(hasta, VENTANA_DIAS)
  const q = new URLSearchParams({ user: usuario, pass: password, firstdate: iso(desde), lastdate: iso(hasta), timeseries: serie, function: 'GetSeries' })
  const d = await getJson(`${base}?${q.toString()}`)
  if (esError(d)) return d
  const o = d as { Codigo?: number; Descripcion?: string; Series?: { Obs?: Array<{ indexDateString?: string; value?: string; statusCode?: string }> } }
  if (o.Codigo != null && o.Codigo !== 0) return { error: o.Descripcion || `código ${o.Codigo}` }
  const obs = (o.Series?.Obs ?? [])
    .filter((x) => (x.statusCode ?? 'OK') === 'OK')
    .map((x) => {
      const [dd, mm, aa] = String(x.indexDateString ?? '').split('-')
      return { fecha: aa && mm && dd ? `${aa}-${mm}-${dd}` : '', valor: Number(x.value) }
    })
  return ultimoHasta(obs, iso(hasta)) ?? { error: `sin valor publicado hasta ${iso(hasta)}` }
}

export const FUENTES_TIPO_CAMBIO: Record<string, { nombre: string; consultar: typeof fuenteMindicador }> = {
  TC_CMF: { nombre: 'CMF', consultar: fuenteCmf },
  TC_BCENTRAL: { nombre: 'Banco Central', consultar: fuenteBancoCentral },
  TC_MINDICADOR: { nombre: 'mindicador.cl', consultar: fuenteMindicador },
}
