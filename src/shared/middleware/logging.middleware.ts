import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { LoggerService } from '../services/logger.service';
import { randomUUID } from 'crypto';

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

@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  constructor(private readonly loggerService: LoggerService) {}

  use(req: ExtendedRequest, res: Response, next: NextFunction): void {
    // Generate unique request ID
    req.requestId = randomUUID();
    req.startTime = Date.now();

    // Skip logging for health checks and static assets
    if (this.shouldSkipLogging(req)) {
      return next();
    }

    // Log incoming request
    this.logRequest(req);

    // Capture original response methods with proper binding
    const originalSend = res.send.bind(res);
    const originalJson = res.json.bind(res);
    const originalEnd = res.end.bind(res);

    let responseBody: any = null;
    let responseBodyCaptured = false;

    // Override res.send to capture response
    res.send = function (body: any) {
      if (!responseBodyCaptured) {
        responseBody = body;
        responseBodyCaptured = true;
      }
      return originalSend(body);
    };

    // Override res.json to capture response
    res.json = function (body: any) {
      if (!responseBodyCaptured) {
        responseBody = body;
        responseBodyCaptured = true;
      }
      return originalJson(body);
    };

    // Override res.end to capture response
    res.end = function (chunk?: any, encoding?: any) {
      if (chunk && !responseBodyCaptured) {
        responseBody = chunk;
        responseBodyCaptured = true;
      }
      return originalEnd(chunk, encoding);
    };

    // Log response when finished
    res.on('finish', () => {
      this.logResponse(req, res, responseBody);
    });

    // Handle errors
    res.on('error', (error) => {
      this.logError(req, res, error, responseBody);
    });

    next();
  }

  private shouldSkipLogging(req: ExtendedRequest): boolean {
    const skipPaths = [
      '/health',
      '/metrics',
      '/favicon.ico',
      '/api-docs',
      '/swagger',
    ];

    return skipPaths.some((path) => req.url.startsWith(path));
  }

  private logRequest(req: ExtendedRequest): void {
    const sanitizedHeaders = this.sanitizeHeaders(req.headers);
    const sanitizedBody = this.sanitizeBody(req.body);

    this.loggerService.logApiRequest({
      requestId: req.requestId!,
      method: req.method,
      url: req.originalUrl || req.url,
      headers: sanitizedHeaders,
      query: req.query,
      body: sanitizedBody,
      userId: req.user?.id,
      userType: req.user?.userType,
      ip: this.getClientIp(req),
      userAgent: req.get('user-agent') || '',
      timestamp: new Date().toISOString(),
    });
  }

  private logResponse(
    req: ExtendedRequest,
    res: Response,
    responseBody: any,
  ): void {
    const responseTime = Date.now() - (req.startTime || Date.now());
    const sanitizedResponseBody = this.sanitizeResponseBody(responseBody);

    this.loggerService.logApiResponse({
      requestId: req.requestId!,
      method: req.method,
      url: req.originalUrl || req.url,
      statusCode: res.statusCode,
      responseTime,
      responseBody: sanitizedResponseBody,
      userId: req.user?.id,
      userType: req.user?.userType,
      ip: this.getClientIp(req),
      timestamp: new Date().toISOString(),
    });
  }

  private logError(
    req: ExtendedRequest,
    res: Response,
    error: Error,
    responseBody: any,
  ): void {
    const responseTime = Date.now() - (req.startTime || Date.now());
    const sanitizedHeaders = this.sanitizeHeaders(req.headers);
    const sanitizedBody = this.sanitizeBody(req.body);
    const sanitizedResponseBody = this.sanitizeResponseBody(responseBody);

    this.loggerService.logApiError({
      requestId: req.requestId!,
      method: req.method,
      url: req.originalUrl || req.url,
      headers: sanitizedHeaders,
      query: req.query,
      body: sanitizedBody,
      statusCode: res.statusCode,
      responseTime,
      responseBody: sanitizedResponseBody,
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name,
      },
      userId: req.user?.id,
      userType: req.user?.userType,
      ip: this.getClientIp(req),
      userAgent: req.get('user-agent') || '',
      timestamp: new Date().toISOString(),
    });
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

    const visited = new WeakSet();

    const sanitizeObject = (obj: any): any => {
      if (!obj || typeof obj !== 'object') return obj;

      // Prevent circular references
      if (visited.has(obj)) {
        return '[Circular Reference]';
      }
      visited.add(obj);

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

  private sanitizeResponseBody(body: any): any {
    if (!body) return body;

    // If response is too large, truncate it
    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
    if (bodyStr && bodyStr.length > 10000) {
      return {
        _truncated: true,
        _originalLength: bodyStr.length,
        _preview: bodyStr.substring(0, 1000) + '...',
      };
    }

    // Parse and sanitize if it's a JSON string
    let parsedBody = body;
    if (typeof body === 'string') {
      try {
        parsedBody = JSON.parse(body);
      } catch {
        return body; // Return as-is if not valid JSON
      }
    }

    // Sanitize sensitive fields in response
    return this.sanitizeBody(parsedBody);
  }
}

// Additional interceptor for specific route logging
@Injectable()
export class RouteLoggingMiddleware implements NestMiddleware {
  constructor(private readonly loggerService: LoggerService) {}

  use(req: ExtendedRequest, res: Response, next: NextFunction): void {
    const route = req.route?.path || req.path;
    const controller = req.route?.stack?.[0]?.name;

    this.loggerService.info('Route accessed', {
      requestId: req.requestId,
      route,
      controller,
      method: req.method,
      userId: req.user?.id,
      userType: req.user?.userType,
      timestamp: new Date().toISOString(),
    });

    next();
  }
}
