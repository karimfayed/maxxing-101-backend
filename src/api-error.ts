import { Catch, HttpException, Logger, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';

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

/** The part of the HTTP response the filter uses. */
interface JsonResponse {
  status(code: number): JsonResponse;
  json(body: unknown): void;
}

/** Answers every error as `{ "code": ... }` and nothing else. */
@Catch()
export class ApiErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiErrorFilter.name);

  catch(error: unknown, host: ArgumentsHost): void {
    const { status, code } = this.toApiError(error);
    host.switchToHttp().getResponse<JsonResponse>().status(status).json({ code });
  }

  private toApiError(error: unknown): ApiError {
    if (error instanceof ApiError) return error;
    const status = statusOf(error);
    if (status === 429) return new ApiError(429, 'rate_limited');
    if (status === 404) return new ApiError(404, 'not_found');
    if (status !== undefined && status >= 400 && status < 500) return new ApiError(400, 'invalid_request');
    // Only the kind of error: its message may quote what the person typed.
    this.logger.error(`Unexpected error: ${error instanceof Error ? error.constructor.name : typeof error}`);
    return new ApiError(500, 'internal_error');
  }
}

/** The HTTP status of a Nest error, or of one from the body parser. */
function statusOf(error: unknown): number | undefined {
  if (error instanceof HttpException) return error.getStatus();
  const status: unknown = error instanceof Error && 'status' in error ? error.status : undefined;
  return typeof status === 'number' ? status : undefined;
}
