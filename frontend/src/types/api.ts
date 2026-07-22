/**
 * Wire types for the calculator backend, mirroring docs/openapi.yaml.
 * Nothing here is client-side state — these are exactly the JSON shapes the
 * server sends and receives.
 */

/** Body of POST /api/v1/calculate — exactly one of the two forms. */
export type CalculateRequest =
  | { operation: string; operands: number[] }
  | { expression: string }

/** Success body of POST /api/v1/calculate. */
export interface CalculateResponse {
  result: number
}

/** One entry of GET /api/v1/operations. */
export interface OperationInfo {
  name: string
  arity: number
  symbol: string
}

/**
 * Stable machine-readable error codes from the spec's ErrorEnvelope enum.
 * The UI renders messages from these codes and never parses message text.
 */
export type ApiErrorCode =
  | 'INVALID_REQUEST'
  | 'DIVISION_BY_ZERO'
  | 'NEGATIVE_SQRT'
  | 'INVALID_OPERAND'
  | 'OVERFLOW'
  | 'ARITY_MISMATCH'
  | 'UNKNOWN_OPERATION'
  | 'SYNTAX_ERROR'
  | 'UNKNOWN_FUNCTION'
  | 'REQUEST_TOO_LARGE'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'METHOD_NOT_ALLOWED'
  | 'NOT_FOUND'
  | 'INTERNAL'

/**
 * Uniform error body. `position` is present exactly when code is
 * SYNTAX_ERROR: a 0-based BYTE offset into the submitted expression (range
 * [0, byteLength]; the endpoint means "unexpected end of input"). It must be
 * converted before indexing a UTF-16 JavaScript string.
 */
export interface ErrorEnvelope {
  error: {
    code: ApiErrorCode
    message: string
    position?: number
  }
}
