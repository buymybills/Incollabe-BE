import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import {
  TokenExpiredError,
  JsonWebTokenError,
  NotBeforeError,
} from 'jsonwebtoken';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

    // Sequelize validation errors
    if (
      exception.name === 'SequelizeValidationError' ||
      exception.name === 'SequelizeUniqueConstraintError' ||
      exception.name === 'SequelizeDatabaseError'
    ) {
      status = HttpStatus.BAD_REQUEST;
      // Show detailed Sequelize error message
      if (exception.name === 'SequelizeUniqueConstraintError') {
        const field = exception.errors?.[0]?.path || 'field';
        message = `${field} already exists`;
      } else if (exception.name === 'SequelizeValidationError') {
        message = exception.errors?.map((e: any) => e.message).join(', ') || 'Validation error';
      } else {
        message = exception.message || 'Database error';
      }
    }
    // JWT errors
    else if (
      exception instanceof TokenExpiredError ||
      exception instanceof JsonWebTokenError ||
      exception instanceof NotBeforeError
    ) {
      status = HttpStatus.UNAUTHORIZED;
      message = 'Invalid or expired token';
    }
    // NestJS HttpExceptions
    else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const responseObj = exception.getResponse();
      message =
        typeof responseObj === 'string'
          ? responseObj
          : (responseObj as any)['message'] || exception.message;
    }
    // Generic fallback
    else {
      message = exception.message || 'Internal server error';
    }

    response.status(status).json({
      success: false,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
      statusCode: status,
    });
  }
}
