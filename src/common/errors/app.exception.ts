import { HttpException, HttpStatus } from '@nestjs/common';
import { ApiErrorCode } from './api-error-code.enum.js';

export class AppException extends HttpException {
  constructor(
    public readonly code: ApiErrorCode,
    message: string,
    status: HttpStatus,
    public readonly details?: unknown,
  ) {
    super({ code, message, details }, status);
  }
}
