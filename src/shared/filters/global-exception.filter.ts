import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { LoggerService } from '../services/logger.service';

// Extend Request interface to include custom properties
interface ExtendedRequest extends Request {
  requestId?: string;
  startTime?: number;
  user?: {
    id: number;
    userType: string;
    email?: string;
    username?: string;
  };
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly loggerService: LoggerService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<ExtendedRequest>();

    const status = this.getHttpStatus(exception);
    const message = this.getErrorMessage(exception);
    const stack = this.getErrorStack(exception);

    // Create error log data
    const errorData = {
      requestId: request.requestId,
      method: request.method,
      url: request.originalUrl || request.url,
      statusCode: status,
      error: {
        name: exception instanceof Error ? exception.name : 'UnknownError',
        message,
        stack,
      },
      requestHeaders: this.sanitizeHeaders(request.headers),
      requestBody: this.sanitizeBody(request.body),
      requestQuery: request.query,
      userId: request.user?.id,
      userType: request.user?.userType,
      ip: this.getClientIp(request),
      userAgent: request.get('user-agent') || '',
      timestamp: new Date().toISOString(),
    };

    // Log the error
    if (status >= 500) {
      this.loggerService.error(
        `💥 Server Error: ${message}`,
        exception,
        errorData,
      );
    } else if (status >= 400) {
      this.loggerService.warn(`⚠️ Client Error: ${message}`, errorData);
    }

    // Create error response
    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message: status >= 500 ? 'Internal server error' : message,
      ...(process.env.NODE_ENV !== 'production' &&
        status >= 500 && {
          error: message,
          stack: stack?.split('\n'),
        }),
      requestId: request.requestId,
    };

    response.status(status).json(errorResponse);
  }

  private getHttpStatus(exception: unknown): number {
    if (exception instanceof HttpException) {
      return exception.getStatus();
    }

    // Handle Multer errors
    if (exception instanceof Error) {
      const multerError = exception as any;
      if (multerError.code === 'LIMIT_FILE_SIZE') {
        return HttpStatus.PAYLOAD_TOO_LARGE; // 413
      }
      if (
        multerError.code === 'LIMIT_UNEXPECTED_FILE' ||
        multerError.code === 'LIMIT_FILE_COUNT'
      ) {
        return HttpStatus.BAD_REQUEST; // 400
      }
      // File type validation error from fileFilter
      const errorMessage = multerError.message || '';
      if (errorMessage.includes('Only image and video files are allowed')) {
        return HttpStatus.BAD_REQUEST; // 400
      }
    }

    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private getErrorMessage(exception: unknown): string {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      if (typeof response === 'string') {
        return response;
      }
      if (typeof response === 'object' && response !== null) {
        return (response as any).message || exception.message;
      }
    }

    // Handle Multer errors with custom messages
    if (exception instanceof Error) {
      const multerError = exception as any;
      if (multerError.code === 'LIMIT_FILE_SIZE') {
        return 'File size exceeds the maximum limit of 50MB per file';
      }
      if (multerError.code === 'LIMIT_FILE_COUNT') {
        return 'Too many files. Maximum 10 files allowed';
      }
      if (multerError.code === 'LIMIT_UNEXPECTED_FILE') {
        return 'Unexpected file field';
      }
      // File type validation error
      const errorMsg = multerError.message || '';
      if (errorMsg.includes('Only image and video files are allowed')) {
        return 'Invalid file type. Only JPG, JPEG, PNG, WEBP, MP4, MOV, and AVI files are allowed';
      }
      return exception.message;
    }

    return 'An unexpected error occurred';
  }

  private getErrorStack(exception: unknown): string | undefined {
    if (exception instanceof Error) {
      return exception.stack;
    }
    return undefined;
  }

  private getClientIp(req: ExtendedRequest): string {
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      req.connection?.remoteAddress ||
      req.socket?.remoteAddress ||
      ''
    );
  }

  private sanitizeHeaders(headers: any): any {
    const sensitiveHeaders = [
      'authorization',
      'cookie',
      'x-auth-token',
      'x-api-key',
      'authentication',
    ];

    const sanitized = { ...headers };

    sensitiveHeaders.forEach((header) => {
      if (sanitized[header]) {
        sanitized[header] = '[REDACTED]';
      }
      if (sanitized[header.toLowerCase()]) {
        sanitized[header.toLowerCase()] = '[REDACTED]';
      }
    });

    return sanitized;
  }

  private sanitizeBody(body: any): any {
    if (!body || typeof body !== 'object') return body;

    const sensitiveFields = [
      'password',
      'confirmPassword',
      'oldPassword',
      'newPassword',
      'otp',
      'token',
      'accessToken',
      'refreshToken',
      'secret',
      'key',
      'apiKey',
      'privateKey',
      'publicKey',
    ];

    const sanitized = Array.isArray(body) ? [...body] : { ...body };

    const sanitizeObject = (obj: any): any => {
      if (!obj || typeof obj !== 'object') return obj;

      const result = Array.isArray(obj) ? [...obj] : { ...obj };

      for (const key in result) {
        if (
          sensitiveFields.some((field) =>
            key.toLowerCase().includes(field.toLowerCase()),
          )
        ) {
          result[key] = '[REDACTED]';
        } else if (typeof result[key] === 'object' && result[key] !== null) {
          result[key] = sanitizeObject(result[key]);
        }
      }

      return result;
    };

    return sanitizeObject(sanitized);
  }
}
