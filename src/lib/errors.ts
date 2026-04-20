export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 500,
  ) {
    super(message)
    this.name = this.constructor.name
    if (Error.captureStackTrace) Error.captureStackTrace(this, this.constructor)
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Invalid data') { super(message, 422) }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') { super(`${resource} not found`, 404) }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') { super(message, 401) }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') { super(message, 403) }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource already exists') { super(message, 409) }
}
