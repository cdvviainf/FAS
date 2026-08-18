import { getBrowser } from './browser.js'

export interface OpcionesPaginaPdf {
  formato: 'A4' | 'Letter'
  orientacion: 'portrait' | 'landscape'
  margen: string // formato CSS, ej. '14mm 12mm 18mm 12mm'
}

// Motor de Documentos — Etapa 4 §1: "el preview es el PDF". Esta función NO
// recibe una URL a navegar (no hay nada que servir/exponer aparte) — recibe
// el HTML ya armado por la plantilla y lo carga directo en la página con
// `setContent`. Es la misma foto que vería un usuario si ese HTML se
// mostrara en un iframe (documentos.service.ts expone el HTML crudo en el
// endpoint de preview para eso mismo).
export async function renderPdf(html: string, pagina: OpcionesPaginaPdf): Promise<Buffer> {
  const browser = await getBrowser()
  const context = await browser.newContext({ locale: 'es-CL', timezoneId: 'America/Santiago' })
  try {
    const page = await context.newPage()
    // 'load' (no 'networkidle'): el HTML es autocontenido — CSS y fuentes
    // van embebidas/inline, sin fetch a red — esperar red inactiva solo
    // agregaría latencia sin motivo.
    await page.setContent(html, { waitUntil: 'load' })
    await page.evaluate(() => document.fonts.ready)

    const pdf = await page.pdf({
      format: pagina.formato,
      landscape: pagina.orientacion === 'landscape',
      printBackground: true,
      // El @page del CSS manda sobre format/landscape/margin si los define
      // (print.css) — permite que una plantilla puntual pida algo distinto
      // (ej. la futura etiqueta térmica 100×150mm) sin tocar esta función.
      preferCSSPageSize: true,
      margin: parseMargen(pagina.margen),
    })
    return pdf
  } finally {
    await context.close()
  }
}

function parseMargen(margen: string): { top: string; right: string; bottom: string; left: string } {
  const partes = margen.trim().split(/\s+/)
  const [top, right = top, bottom = top, left = right] = partes
  return { top, right, bottom, left }
}
