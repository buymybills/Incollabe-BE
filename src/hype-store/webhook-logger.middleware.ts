import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class WebhookLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HypeStoreWebhook');

  use(req: Request, res: Response, next: NextFunction) {
    this.logger.log('========== HYPE STORE WEBHOOK RAW REQUEST ==========');
    this.logger.log(`Method: ${req.method}`);
    this.logger.log(`URL: ${req.originalUrl}`);
    this.logger.log(`Headers: ${JSON.stringify(req.headers, null, 2)}`);
    this.logger.log(`Raw Body: ${JSON.stringify(req.body, null, 2)}`);
    this.logger.log('=====================================================');
    next();
  }
}
