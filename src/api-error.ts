export type ErrorCode =
  | 'invalid_request'
  | 'rate_limited'
  | 'match_unavailable'
  | 'not_found'
  | 'internal_error';

/** An error the caller is told about, by its code only. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
  ) {
    super(code);
    this.name = 'ApiError';
  }
}
