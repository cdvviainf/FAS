import { type NextRequest, NextResponse } from 'next/server'

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api').replace('/api', '')

async function handler(req: NextRequest): Promise<NextResponse> {
  const path = req.nextUrl.pathname // e.g. /api/auth/sign-in/email
  const search = req.nextUrl.search
  const target = `${API_BASE}${path}${search}`

  const headers = new Headers(req.headers)
  // Next.js añade x-forwarded-for; aseguramos que el host no confunda a Better Auth
  headers.set('x-forwarded-host', req.nextUrl.host)

  const body = req.method !== 'GET' && req.method !== 'HEAD' ? await req.arrayBuffer() : undefined

  const upstream = await fetch(target, {
    method: req.method,
    headers,
    body: body ? Buffer.from(body) : undefined,
    // @ts-expect-error — Node fetch no tiene duplex, pero Next.js lo necesita en streaming
    duplex: 'half',
  })

  const responseHeaders = new Headers(upstream.headers)
  // Reescribir cookies que vengan con Domain del API para que funcionen en el frontend
  const setCookies = upstream.headers.getSetCookie?.() ?? []
  if (setCookies.length > 0) {
    responseHeaders.delete('set-cookie')
    for (const cookie of setCookies) {
      // Eliminar Domain=... para que el browser asigne el dominio del frontend
      const cleaned = cookie.replace(/;\s*domain=[^;]*/gi, '')
      responseHeaders.append('set-cookie', cleaned)
    }
  }

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  })
}

export const GET = handler
export const POST = handler
export const PUT = handler
export const PATCH = handler
export const DELETE = handler
export const OPTIONS = handler
