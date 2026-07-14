import ky, { isHTTPError, type BeforeErrorHook } from 'ky'

const beforeErrorHook: BeforeErrorHook = async ({ error }) => {
  if (isHTTPError(error)) {
    try {
      const body = (await error.response.clone().json()) as { error?: { message?: string } }
      if (body?.error?.message) {
        error.message = body.error.message
      }
    } catch {
      // ignore parse errors
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
