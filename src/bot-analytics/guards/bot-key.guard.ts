import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

/**
 * Protects the public bot-event ingestion endpoint with a shared secret
 * (the bot is a server-to-server caller, not a logged-in admin/user).
 * Expects header `x-bot-key: <BOT_ANALYTICS_KEY>`.
 */
@Injectable()
export class BotKeyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const provided = req.headers['x-bot-key'];
    const expected = this.configService.get<string>('BOT_ANALYTICS_KEY');

    if (!expected) {
      // Misconfigured server — fail closed rather than accept anything.
      throw new UnauthorizedException('Bot analytics ingestion is not configured');
    }
    if (!provided || provided !== expected) {
      throw new UnauthorizedException('Invalid bot key');
    }
    return true;
  }
}
