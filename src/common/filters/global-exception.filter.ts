import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { PinoLogger } from 'nestjs-pino';
import { ApiErrorCode } from '../errors/api-error-code.enum.js';

interface ErrorBody {
  code?: ApiErrorCode;
  message?: string | string[];
  details?: unknown;
}

interface PostgresDriverError {
  code?: string;
  constraint?: string;
}

@Catch()
@Injectable()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(GlobalExceptionFilter.name);
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<Request & { id?: string }>();
    const response = context.getResponse<Response>();
    const requestId = request.id ?? request.headers['x-request-id']?.toString();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = ApiErrorCode.InternalError;
    let message = 'An unexpected error occurred';
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      const normalized: ErrorBody =
        typeof body === 'string' ? { message: body } : body;
      code = normalized.code ?? this.codeFromStatus(status);
      message = Array.isArray(normalized.message)
        ? 'Request validation failed'
        : (normalized.message ?? exception.message);
      details = Array.isArray(normalized.message)
        ? normalized.message
        : normalized.details;
    } else if (this.isPostgresError(exception)) {
      const databaseError = exception as PostgresDriverError;
      if (databaseError.code === '23505') {
        status = HttpStatus.CONFLICT;
        code = ApiErrorCode.Conflict;
        message = 'A resource with the same unique value already exists';
      } else if (databaseError.code === '23503') {
        status = HttpStatus.CONFLICT;
        code = ApiErrorCode.Conflict;
        message = 'The resource is still referenced by another record';
      } else if (databaseError.code === '22P02') {
        status = HttpStatus.BAD_REQUEST;
        code = ApiErrorCode.ValidationFailed;
        message = 'A supplied identifier or value has an invalid format';
      } else if (
        databaseError.code?.startsWith('08') ||
        databaseError.code === '57P01'
      ) {
        status = HttpStatus.SERVICE_UNAVAILABLE;
        code = ApiErrorCode.DatabaseUnavailable;
        message = 'Database is temporarily unavailable';
      } else {
        message = 'Database operation failed';
      }
    }

    const log = {
      requestId,
      method: request.method,
      path: request.originalUrl,
      status,
      code,
      err: exception,
    };
    if (status >= 500) this.logger.error(log, message);
    else this.logger.warn(log, message);

    response.status(status).json({
      success: false,
      error: { code, message, ...(details ? { details } : {}) },
      meta: { requestId, timestamp: new Date().toISOString() },
    });
  }

  private isPostgresError(value: unknown): value is PostgresDriverError {
    return typeof value === 'object' && value !== null && 'code' in value;
  }

  private codeFromStatus(status: number): ApiErrorCode {
    if (status === 400) return ApiErrorCode.ValidationFailed;
    if (status === 413) return ApiErrorCode.ValidationFailed;
    if (status === 401) return ApiErrorCode.Unauthorized;
    if (status === 403) return ApiErrorCode.Forbidden;
    if (status === 404) return ApiErrorCode.ResourceNotFound;
    if (status === 409) return ApiErrorCode.Conflict;
    if (status === 402) return ApiErrorCode.SubscriptionRequired;
    if (status === 429) return ApiErrorCode.RateLimitExceeded;
    return ApiErrorCode.InternalError;
  }
}
