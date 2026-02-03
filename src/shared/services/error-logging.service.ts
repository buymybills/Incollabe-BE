import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { ErrorLog } from '../models/error-log.model';
import * as os from 'os';

type ErrorLogCreationAttributes = {
  requestId: string;
  endpoint: string;
  method: string;
  statusCode?: number | null;
  errorMessage?: string | null;
  errorStack?: string | null;
  userId?: number | null;
  userType?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  requestBody?: any;
  responseBody?: any;
};

interface ErrorLogData {
  requestId: string;
  endpoint: string;
  method: string;
  statusCode?: number;
  errorMessage?: string;
  errorStack?: string;
  userId?: number;
  userType?: string;
  ipAddress?: string;
  userAgent?: string;
  requestBody?: any;
  responseBody?: any;
}

@Injectable()
export class ErrorLoggingService {
  constructor(
    @InjectModel(ErrorLog)
    private readonly errorLogModel: typeof ErrorLog,
  ) {}

  /**
   * Log error to database
   */
  async logError(data: ErrorLogData): Promise<void> {
    try {
      // Sanitize request body (remove passwords, tokens, etc.)
      const sanitizedRequestBody = this.sanitizeSensitiveData(data.requestBody);
      const sanitizedResponseBody = this.sanitizeSensitiveData(data.responseBody);

      // Collect system information
      const systemInfo = {
        hostname: os.hostname(),
        platform: os.platform(),
        nodeVersion: process.version,
        memory: {
          total: os.totalmem(),
          free: os.freemem(),
          used: os.totalmem() - os.freemem(),
        },
      };

      // Create error log entry
      await this.errorLogModel.create({
        requestId: data.requestId,
        endpoint: data.endpoint,
        method: data.method,
        statusCode: data.statusCode,
        errorMessage: data.errorMessage,
        errorStack: data.errorStack,
        userId: data.userId,
        userType: data.userType,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        requestBody: sanitizedRequestBody ? JSON.stringify(sanitizedRequestBody) : null,
        responseBody: sanitizedResponseBody ? JSON.stringify(sanitizedResponseBody) : null,
        systemInfo,
      } as ErrorLogCreationAttributes);

      console.log(`✅ Error logged to database: ${data.requestId}`);
    } catch (error) {
      console.error('Failed to log error to database:', error);
    }
  }

  /**
   * Get errors by request ID
   */
  async getErrorsByRequestId(requestId: string): Promise<ErrorLog[]> {
    return await this.errorLogModel.findAll({
      where: { requestId },
      order: [['createdAt', 'DESC']],
    });
  }

  /**
   * Get recent errors
   */
  async getRecentErrors(limit: number = 100): Promise<ErrorLog[]> {
    return await this.errorLogModel.findAll({
      order: [['createdAt', 'DESC']],
      limit,
    });
  }

  /**
   * Sanitize sensitive data from objects
   */
  private sanitizeSensitiveData(data: any): any {
    if (!data) return null;

    const sensitiveKeys = [
      'password',
      'token',
      'accessToken',
      'refreshToken',
      'apiKey',
      'secret',
      'authorization',
      'cookie',
      'session',
    ];

    const sanitize = (obj: any): any => {
      if (typeof obj !== 'object' || obj === null) {
        return obj;
      }

      if (Array.isArray(obj)) {
        return obj.map(item => sanitize(item));
      }

      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();
        if (sensitiveKeys.some(sensitiveKey => lowerKey.includes(sensitiveKey))) {
          sanitized[key] = '[REDACTED]';
        } else if (typeof value === 'object' && value !== null) {
          sanitized[key] = sanitize(value);
        } else {
          sanitized[key] = value;
        }
      }
      return sanitized;
    };

    return sanitize(data);
  }
}
