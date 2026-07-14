import ky, { isHTTPError, type BeforeErrorHook } from 'ky'

// ky v2: response body is pre-consumed into error.data before beforeError hooks run.
// error.response.json() / clone().json() will not work — use error.data instead.
const beforeErrorHook: BeforeErrorHook = ({ error }) => {
  if (isHTTPError(error)) {
    const data = error.data as { error?: { message?: string } } | undefined
    if (data?.error?.message) {
      error.message = data.error.message
    }
  }
  return error
}

export const api = ky.create({
  prefix: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api',
  hooks: {
    beforeError: [beforeErrorHook]
  }
})
