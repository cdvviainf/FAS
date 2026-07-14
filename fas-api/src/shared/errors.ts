export class BusinessError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 400,
    public readonly details?: unknown
  ) {
    super(message)
    this.name = 'BusinessError'
  }
}

export class NotFoundError extends BusinessError {
  constructor(resource: string, id?: string) {
    super('NOT_FOUND', `${resource}${id ? ` (${id})` : ''} no encontrado`, 404)
  }
}

export class UnauthorizedError extends BusinessError {
  constructor(message = 'No autorizado') {
    super('UNAUTHORIZED', message, 401)
  }
}

export class ForbiddenError extends BusinessError {
  constructor(message = 'Sin permisos para esta operación') {
    super('FORBIDDEN', message, 403)
  }
}

export class ConflictError extends BusinessError {
  constructor(message: string) {
    super('CONFLICT', message, 409)
  }
}

export class ValidationError extends BusinessError {
  constructor(message: string, details?: unknown) {
    super('VALIDATION_ERROR', message, 422, details)
  }
}
