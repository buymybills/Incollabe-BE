import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import pino from 'pino';
import * as path from 'path';
import * as fs from 'fs';

export interface ApiLogData {
  method: string;
  url: string;
  headers: any;
  query: any;
  body: any;
  userId?: number;
  userType?: string;
  ip: string;
  userAgent: string;
  statusCode?: number;
  responseTime?: number;
  responseBody?: any;
  error?: any;
  timestamp: string;
  requestId: string;
}

@Injectable()
export class LoggerService {
  private logger: pino.Logger;
  private fileLoggers: Map<string, pino.Logger>;
  private logsDir: string;

  constructor(private configService: ConfigService) {
    this.setupLogsDirectory();
    this.createLoggers();
  }

  private setupLogsDirectory(): void {
    this.logsDir = path.join(process.cwd(), 'logs');

    // Create logs directory if it doesn't exist
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }

    // Create subdirectories for different log types
    const subDirs = [
      'api',
      'error',
      'auth',
      'database',
      'email',
      'whatsapp',
      's3',
      'combined',
    ];
    subDirs.forEach((dir) => {
      const fullPath = path.join(this.logsDir, dir);
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
      }
    });
  }

  private getLogFileName(category: string): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');

    return path.join(
      this.logsDir,
      category,
      `${category}-${year}-${month}-${day}-${hour}.log`,
    );
  }

  private createLoggers(): void {
    this.fileLoggers = new Map();

    // Main console logger with clean output
    this.logger = pino({
      level: this.configService.get('LOG_LEVEL', 'info'),
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:dd/mm/yyyy, HH:MM:ss',
          ignore: 'pid,hostname',
          messageFormat: '{time} {level}: {msg}',
          levelFirst: false,
          singleLine: true,
        },
      },
    });

    // Create file loggers for different categories
    const categories = [
      'api',
      'error',
      'auth',
      'database',
      'email',
      'whatsapp',
      's3',
      'combined',
    ];

    categories.forEach((category) => {
      this.fileLoggers.set(
        category,
        pino(
          {
            level: 'trace',
            formatters: {
              level: (label) => ({ level: label }),
            },
          },
          pino.destination({
            dest: this.getLogFileName(category),
            sync: false,
          }),
        ),
      );
    });
  }

  // Rotate file logger if hour changed
  private rotateLoggersIfNeeded(): void {
    const categories = [
      'api',
      'error',
      'auth',
      'database',
      'email',
      'whatsapp',
      's3',
      'combined',
    ];

    categories.forEach((category) => {
      const newFileName = this.getLogFileName(category);
      const currentLogger = this.fileLoggers.get(category);

      if (
        currentLogger &&
        currentLogger[Symbol.for('pino.destination')] !== newFileName
      ) {
        this.fileLoggers.set(
          category,
          pino(
            {
              level: 'trace',
              formatters: {
                level: (label) => ({ level: label }),
              },
            },
            pino.destination({
              dest: newFileName,
              sync: false,
            }),
          ),
        );
      }
    });
  }

  private logToFile(
    category: string,
    level: string,
    message: string,
    data: any,
  ): void {
    this.rotateLoggersIfNeeded();
    const fileLogger = this.fileLoggers.get(category);
    const combinedLogger = this.fileLoggers.get('combined');

    if (fileLogger) {
      fileLogger[level](data, message);
    }
    if (combinedLogger) {
      combinedLogger[level]({ category, ...data }, message);
    }
  }

  // API Request/Response logging
  logApiRequest(data: Partial<ApiLogData>): void {
    const sanitizedData = this.sanitizeData(data);
    const logData = {
      type: 'API_REQUEST',
      requestId: data.requestId,
      method: data.method,
      url: data.url,
      userId: data.userId,
      userType: data.userType,
      ip: data.ip,
      userAgent: data.userAgent,
      ...sanitizedData,
    };

    this.logger.info(`${data.method} ${data.url}`, logData);
    this.logToFile('api', 'info', 'API Request', logData);
  }

  logApiResponse(data: Partial<ApiLogData>): void {
    const sanitizedData = this.sanitizeData(data);
    const logData = {
      type: 'API_RESPONSE',
      requestId: data.requestId,
      method: data.method,
      url: data.url,
      statusCode: data.statusCode,
      responseTime: data.responseTime,
      ...sanitizedData,
    };

    const statusText = (data.statusCode || 200) >= 400 ? 'ERROR' : 'SUCCESS';
    const responseTimeText = (data.responseTime || 0) > 1000 ? 'SLOW' : 'FAST';

    this.logger.info(
      `${statusText} ${data.method} ${data.url} - ${data.statusCode} ${responseTimeText} ${data.responseTime}ms`,
      logData,
    );
    this.logToFile('api', 'info', 'API Response', logData);
  }

  logApiError(data: Partial<ApiLogData>): void {
    const sanitizedData = this.sanitizeData(data);
    const logData = {
      type: 'API_ERROR',
      requestId: data.requestId,
      method: data.method,
      url: data.url,
      statusCode: data.statusCode,
      error: data.error,
      ...sanitizedData,
    };

    this.logger.error(
      `ERROR ${data.method} ${data.url} - ${data.statusCode}`,
      logData,
    );
    this.logToFile('api', 'error', 'API Error', logData);
    this.logToFile('error', 'error', 'API Error', logData);
  }

  // Authentication logging
  logAuth(action: string, data: any): void {
    const sanitizedData = this.sanitizeData(data);
    const logData = {
      type: 'AUTH',
      action,
      ...sanitizedData,
    };

    this.logger.info(`Auth: ${action}`, logData);
    this.logToFile('auth', 'info', 'Auth Action', logData);
  }

  logAuthError(action: string, error: any, data?: any): void {
    const sanitizedData = this.sanitizeData(data);
    const logData = {
      type: 'AUTH_ERROR',
      action,
      error: error.message || error,
      stack: error.stack,
      ...sanitizedData,
    };

    this.logger.error(`Auth Error: ${action}`, logData);
    this.logToFile('auth', 'error', 'Auth Error', logData);
    this.logToFile('error', 'error', 'Auth Error', logData);
  }

  // Database logging
  logDatabase(action: string, data: any): void {
    const sanitizedData = this.sanitizeData(data);
    const logData = {
      type: 'DATABASE',
      action,
      ...sanitizedData,
    };

    this.logger.info(`DB: ${action}`, logData);
    this.logToFile('database', 'info', 'Database Action', logData);
  }

  logDatabaseError(action: string, error: any, data?: any): void {
    const sanitizedData = this.sanitizeData(data);
    const logData = {
      type: 'DATABASE_ERROR',
      action,
      error: error.message || error,
      stack: error.stack,
      ...sanitizedData,
    };

    this.logger.error(`DB Error: ${action}`, logData);
    this.logToFile('database', 'error', 'Database Error', logData);
    this.logToFile('error', 'error', 'Database Error', logData);
  }

  // Email logging
  logEmail(action: string, data: any): void {
    const sanitizedData = this.sanitizeData(data);
    const logData = {
      type: 'EMAIL',
      action,
      ...sanitizedData,
    };

    this.logger.info(`Email: ${action}`, logData);
    this.logToFile('email', 'info', 'Email Action', logData);
  }

  logEmailError(action: string, error: any, data?: any): void {
    const sanitizedData = this.sanitizeData(data);
    const logData = {
      type: 'EMAIL_ERROR',
      action,
      error: error.message || error,
      stack: error.stack,
      ...sanitizedData,
    };

    this.logger.error(`Email Error: ${action}`, logData);
    this.logToFile('email', 'error', 'Email Error', logData);
    this.logToFile('error', 'error', 'Email Error', logData);
  }

  // WhatsApp logging
  logWhatsApp(action: string, data: any): void {
    const sanitizedData = this.sanitizeData(data);
    const logData = {
      type: 'WHATSAPP',
      action,
      ...sanitizedData,
    };

    this.logger.info(`WhatsApp: ${action}`, logData);
    this.logToFile('whatsapp', 'info', 'WhatsApp Action', logData);
  }

  logWhatsAppError(action: string, error: any, data?: any): void {
    const sanitizedData = this.sanitizeData(data);
    const logData = {
      type: 'WHATSAPP_ERROR',
      action,
      error: error.message || error,
      stack: error.stack,
      ...sanitizedData,
    };

    this.logger.error(`WhatsApp Error: ${action}`, logData);
    this.logToFile('whatsapp', 'error', 'WhatsApp Error', logData);
    this.logToFile('error', 'error', 'WhatsApp Error', logData);
  }

  // S3 logging
  logS3(action: string, data: any): void {
    const sanitizedData = this.sanitizeData(data);
    const logData = {
      type: 'S3',
      action,
      ...sanitizedData,
    };

    this.logger.info(`S3: ${action}`, logData);
    this.logToFile('s3', 'info', 'S3 Action', logData);
  }

  logS3Error(action: string, error: any, data?: any): void {
    const sanitizedData = this.sanitizeData(data);
    const logData = {
      type: 'S3_ERROR',
      action,
      error: error.message || error,
      stack: error.stack,
      ...sanitizedData,
    };

    this.logger.error(`S3 Error: ${action}`, logData);
    this.logToFile('s3', 'error', 'S3 Error', logData);
    this.logToFile('error', 'error', 'S3 Error', logData);
  }

  // General purpose logging methods
  info(message: string, meta?: any): void {
    const sanitizedData = this.sanitizeData(meta);
    this.logger.info(message, sanitizedData);
  }

  error(message: string, error?: any, meta?: any): void {
    const sanitizedData = this.sanitizeData(meta);
    const logData = {
      error: error?.message || error,
      stack: error?.stack,
      ...sanitizedData,
    };

    this.logger.error(message, logData);
    this.logToFile('error', 'error', message, logData);
  }

  warn(message: string, meta?: any): void {
    const sanitizedData = this.sanitizeData(meta);
    this.logger.warn(message, sanitizedData);
  }

  debug(message: string, meta?: any): void {
    const sanitizedData = this.sanitizeData(meta);
    this.logger.debug(message, sanitizedData);
  }

  trace(message: string, meta?: any): void {
    const sanitizedData = this.sanitizeData(meta);
    this.logger.trace(message, sanitizedData);
  }

  // Utility method to sanitize sensitive data
  private sanitizeData(data: any): any {
    if (!data || typeof data !== 'object') return data;

    const sensitiveFields = [
      'password',
      'token',
      'accessToken',
      'refreshToken',
      'authorization',
      'cookie',
      'otp',
      'secret',
      'key',
      'apiKey',
      'privateKey',
      'publicKey',
      'confirmPassword',
      'oldPassword',
      'newPassword',
    ];

    const sanitized = Array.isArray(data) ? [...data] : { ...data };

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

  // Safe logging with sensitive data sanitization
  logSafe(level: string, message: string, data?: any): void {
    const sanitizedData = this.sanitizeData(data);
    const logMethod = this.logger[level as keyof typeof this.logger];
    if (typeof logMethod === 'function') {
      logMethod.call(this.logger, message, sanitizedData);
    } else {
      this.logger.info(message, sanitizedData);
    }
  }
}
