// Errors the API sends back to the website. `message` is written for guests.
const STATUS = {
  'invalid-argument': 400,
  unauthenticated: 401,
  'permission-denied': 403,
  'not-found': 404,
  'failed-precondition': 409,
  'already-exists': 409,
  'resource-exhausted': 429,
  internal: 500,
}

export class ApiError extends Error {
  constructor(code, message) {
    super(message)
    this.code = code
    this.status = STATUS[code] ?? 500
  }
}
