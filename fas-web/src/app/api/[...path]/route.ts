import { type NextRequest, NextResponse } from 'next/server'

// Proxy genérico de datos: el navegador solo conoce el dominio del frontend,
// nunca el de fas-api directamente. Sin esto, la cookie de sesión (seteada
// para el dominio del frontend por /api/auth/[...all]/route.ts) no llega a
// un dominio distinto -- crítico cuando fas-web y fas-api viven en
// subdominios separados (ej. sslip.io en el demo de Coolify, que el
// navegador trata como sitios completamente independientes). Ver
// QA/hallazgos-consolidados.md §12 (QA-INFRA-001/002).
//
// Next.js resuelve app/api/auth/[...all]/route.ts antes que este catch-all
// para cualquier URL que empiece con /api/auth/*, así que ese proxy
// (con su lógica propia de reescritura de cookies) sigue intacto.
const API_BASE =
  process.env.INTERNAL_API_URL ??
  (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api').replace(/\/api$/, '')

async function handler(req: NextRequest): Promise<NextResponse> {
  const path = req.nextUrl.pathname // e.g. /api/config/temporadas
  const search = req.nextUrl.search
  const target = `${API_BASE}${path}${search}`

  const headers = new Headers(req.headers)
  headers.set('x-forwarded-host', req.nextUrl.host)

  const body = req.method !== 'GET' && req.method !== 'HEAD' ? await req.arrayBuffer() : undefined

  const upstream = await fetch(target, {
    method: req.method,
    headers,
    body: body ? Buffer.from(body) : undefined,
    // @ts-expect-error — Node fetch no tiene duplex, pero Next.js lo necesita en streaming
    duplex: 'half',
  })

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: upstream.headers,
  })
}

export const GET = handler
export const POST = handler
export const PUT = handler
export const PATCH = handler
export const DELETE = handler
export const OPTIONS = handler
