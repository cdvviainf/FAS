import { describe, expect, it } from 'vitest'

const rawApiUrl = process.env.TEST_API_URL
if (!rawApiUrl) {
  throw new Error(
    'Falta TEST_API_URL. Ejemplo: TEST_API_URL=https://api-test.ejemplo.cl npm run test:remote',
  )
}

const apiUrl = rawApiUrl.replace(/\/+$/, '')

describe('API desplegada en Coolify', () => {
  it('reporta API, PostgreSQL y Redis saludables', async () => {
    const response = await fetch(`${apiUrl}/health`)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      status: 'ok',
      checks: {
        api: 'ok',
        database: 'ok',
        redis: 'ok',
      },
    })
  })

  it('mantiene deshabilitado el registro público', async () => {
    const response = await fetch(`${apiUrl}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Prueba remota',
        email: 'no-crear@example.invalid',
        password: 'NoDebeCrearse123!',
      }),
    })

    expect(response.status).toBe(403)
  })

  it('protege los mantenedores sin una sesión autenticada', async () => {
    const response = await fetch(`${apiUrl}/api/config/temporadas`)

    expect(response.status).toBe(401)
  })
})
