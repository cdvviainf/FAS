import { chromium, type Browser } from 'playwright'
import { env } from '../../config/env.js'

// Motor de Documentos (Etapa 4, Docs/agrosan_etapa4_motor_documentos.md §4):
// una sola instancia de Chromium reutilizada entre requests — lanzarlo en
// frío por cada PDF es el costo dominante del render (decenas de ms extra),
// y en un VPS pequeño puede agotar memoria si se lanza uno por request bajo
// carga. Se lanza perezoso (al primer render) y se mantiene caliente.
let browserPromise: Promise<Browser> | null = null

async function launch(): Promise<Browser> {
  return chromium.launch({
    // undefined en desarrollo -> Playwright usa el Chromium que instaló
    // `npx playwright install chromium`. En producción (Alpine) apunta al
    // Chromium del sistema (Dockerfile, apk add chromium) — ver env.ts.
    executablePath: env.PLAYWRIGHT_EXECUTABLE_PATH,
    args: ['--font-render-hinting=none'],
  })
}

export async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = launch().catch((err) => {
      // Si el lanzamiento falla, no dejar la promesa rota en caché — el
      // próximo render debe reintentar en vez de fallar para siempre.
      browserPromise = null
      throw err
    })
  }
  const browser = await browserPromise
  // Un browser puede caerse solo (§10, riesgo "Chromium se degrada con el
  // uso"). Si ya no está conectado, se descarta y se relanza en el próximo
  // acceso en vez de seguir devolviendo un handle muerto.
  if (!browser.isConnected()) {
    browserPromise = null
    return getBrowser()
  }
  return browser
}

// Cierre ordenado — registrado como hook `onClose` de Fastify en app.ts.
export async function closeBrowser(): Promise<void> {
  if (!browserPromise) return
  const browser = await browserPromise.catch(() => null)
  browserPromise = null
  if (browser) await browser.close()
}
