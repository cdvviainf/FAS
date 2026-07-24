import ky, { isHTTPError, type BeforeErrorHook } from 'ky'

interface ApiErrorBody {
  error?: {
    message?: string
    // El error handler de fas-api serializa ZodError con error.flatten(), que
    // deja el mensaje específico de cada campo aquí en vez de en `message`
    // (`message` siempre es el genérico "Datos inválidos" para VALIDATION_ERROR).
    details?: {
      formErrors?: string[]
      fieldErrors?: Record<string, string[]>
    }
  }
}

// ky v2: response body is pre-consumed into error.data before beforeError hooks run.
// error.response.json() / clone().json() will not work — use error.data instead.
const beforeErrorHook: BeforeErrorHook = ({ error }) => {
  if (isHTTPError(error)) {
    const data = error.data as ApiErrorBody | undefined
    const details = data?.error?.details
    const specificMessages = [
      ...Object.values(details?.fieldErrors ?? {}).flat(),
      ...(details?.formErrors ?? []),
    ].filter(Boolean)

    if (specificMessages.length > 0) {
      error.message = specificMessages.join(' · ')
    } else if (data?.error?.message) {
      error.message = data.error.message
    }
  }
  return error
}

export const api = ky.create({
  prefix: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api',
  credentials: 'include',
  hooks: {
    beforeError: [beforeErrorHook]
  }
})
