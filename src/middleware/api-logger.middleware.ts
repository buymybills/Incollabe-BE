import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { InjectModel } from '@nestjs/sequelize';
import { ApiActivityLog } from '../shared/models/api-activity-log.model';

interface RequestWithUser extends Request {
  user?: {
    id: number;
    userType: string;
    email?: string;
    username?: string;
    isExternal?: boolean;
  };
}

@Injectable()
export class ApiLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger(ApiLoggerMiddleware.name);

  constructor(
    @InjectModel(ApiActivityLog)
    private apiActivityLogModel: typeof ApiActivityLog,
  ) {}

  use(req: RequestWithUser, res: Response, next: NextFunction) {
    const startTime = Date.now();

    // Capture request data
    const requestData = {
      method: req.method,
      endpoint: this.sanitizeEndpoint(req.path),
      fullUrl: req.originalUrl,
      queryParams: req.query,
      requestBody: this.sanitizeRequestBody(req.body),
      requestHeaders: this.sanitizeHeaders(req.headers),
      userId: req.user?.id || null,
      userType: req.user?.userType || null,
      userEmail: req.user?.email || null,
      username: req.user?.username || null,
      ipAddress: this.getClientIp(req),
      userAgent: req.headers['user-agent'] || null,
    };

    // Intercept response
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);
    let responseBody: any = null;
    let responseSizeBytes = 0;

    // Override res.json()
    res.json = (body: any) => {
      responseBody = body;
      responseSizeBytes = JSON.stringify(body).length;
      return originalJson(body);
    };

    // Override res.send()
    res.send = (body: any) => {
      if (!responseBody) {
        responseBody = body;
        responseSizeBytes = typeof body === 'string' ? body.length : JSON.stringify(body).length;
      }
      return originalSend(body);
    };

    // Log on response finish
    res.on('finish', async () => {
      const responseTimeMs = Date.now() - startTime;

      try {
        await this.logActivity({
          ...requestData,
          statusCode: res.statusCode,
          responseBody: this.sanitizeResponseBody(responseBody, res.statusCode),
          responseSizeBytes,
          responseTimeMs,
          isSlow: responseTimeMs > 5000,
          isError: res.statusCode >= 400,
          errorMessage: res.statusCode >= 400 ? this.extractErrorMessage(responseBody) : null,
        });
      } catch (error) {
        // Don't let logging errors break the app
        this.logger.error(`Failed to log API activity: ${error.message}`);
      }
    });

    next();
  }

  /**
   * Log activity to database (async, non-blocking)
   */
  private async logActivity(data: any): Promise<void> {
    try {
      // Skip logging for certain endpoints (to avoid noise)
      if (this.shouldSkipLogging(data.endpoint)) {
        return;
      }

      await this.apiActivityLogModel.create(data);
    } catch (error) {
      this.logger.error(`Database logging failed: ${error.message}`);
    }
  }

  /**
   * Determine if endpoint should be skipped from logging
   */
  private shouldSkipLogging(endpoint: string): boolean {
    const skipPatterns = [
      '/health',
      '/metrics',
      '/favicon.ico',
      '/_next',
      '/static',
      '/socket.io',
    ];

    return skipPatterns.some(pattern => endpoint.includes(pattern));
  }

  /**
   * Sanitize endpoint to remove dynamic IDs for grouping
   */
  private sanitizeEndpoint(path: string): string {
    // Replace numeric IDs with :id for better grouping
    return path.replace(/\/\d+/g, '/:id');
  }

  /**
   * Sanitize request body (remove sensitive data)
   */
  private sanitizeRequestBody(body: any): any {
    if (!body || typeof body !== 'object') {
      return body;
    }

    const sensitiveFields = [
      'password',
      'token',
      'secret',
      'apiKey',
      'creditCard',
      'cvv',
      'ssn',
    ];

    const sanitized = { ...body };

    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '***REDACTED***';
      }
    }

    // Truncate large bodies
    const jsonString = JSON.stringify(sanitized);
    if (jsonString.length > 10000) {
      return {
        _truncated: true,
        _originalSize: jsonString.length,
        _preview: jsonString.substring(0, 1000) + '...',
      };
    }

    return sanitized;
  }

  /**
   * Sanitize response body
   */
  private sanitizeResponseBody(body: any, statusCode: number): any {
    if (!body) {
      return null;
    }

    // Don't log success response bodies for GET requests (too large)
    // Only log errors and mutations (POST, PUT, DELETE)
    if (statusCode >= 200 && statusCode < 300) {
      if (typeof body === 'object' && body.success) {
        return { success: true, _responseTruncated: true };
      }
    }

    // For errors, log full response
    if (statusCode >= 400) {
      return body;
    }

    // Truncate large responses
    const jsonString = JSON.stringify(body);
    if (jsonString.length > 5000) {
      return {
        _truncated: true,
        _originalSize: jsonString.length,
      };
    }

    return body;
  }

  /**
   * Sanitize headers (remove sensitive tokens)
   */
  private sanitizeHeaders(headers: any): Record<string, string> {
    const sanitized: Record<string, string> = {};

    const allowedHeaders = [
      'content-type',
      'user-agent',
      'accept',
      'accept-language',
      'x-app-version',
      'x-platform',
    ];

    for (const header of allowedHeaders) {
      if (headers[header]) {
        sanitized[header] = headers[header];
      }
    }

    // Indicate if auth was present (but don't log the token)
    if (headers.authorization) {
      sanitized.authorization = '***TOKEN_PRESENT***';
    }

    if (headers['x-api-key']) {
      sanitized['x-api-key'] = '***API_KEY_PRESENT***';
    }

    return sanitized;
  }

  /**
   * Get client IP address
   */
  private getClientIp(req: Request): string {
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      (req.headers['x-real-ip'] as string) ||
      req.socket.remoteAddress ||
      'unknown'
    );
  }

  /**
   * Extract error message from response
   */
  private extractErrorMessage(responseBody: any): string | null {
    if (!responseBody) return null;

    if (typeof responseBody === 'string') {
      return responseBody.substring(0, 500);
    }

    if (typeof responseBody === 'object') {
      const msg = responseBody.message || responseBody.error || 'Unknown error';
      // NestJS validation errors set message as an array of strings
      if (typeof msg === 'string') return msg.substring(0, 500);
      return JSON.stringify(msg).substring(0, 500);
    }

    return null;
  }
}
