import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Socket } from 'socket.io';

/**
 * WebSocket Authentication Guard
 *
 * This guard validates WebSocket connections by checking authentication tokens.
 * It's called before any @SubscribeMessage handlers execute.
 *
 * Note: For connection-level authentication, handle it in handleConnection()
 * of the Gateway instead, as guards don't run on initial connection.
 */
@Injectable()
export class WsAuthGuard implements CanActivate {
  private logger: Logger = new Logger('WsAuthGuard');

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const client: Socket = context.switchToWs().getClient();

    // Check if user data exists (set during handleConnection)
    const userId = client.data.userId;
    const userType = client.data.userType;

    if (!userId || !userType) {
      this.logger.warn(`Unauthorized WebSocket message from ${client.id}`);
      client.emit('error', { message: 'Unauthorized' });
      return false;
    }

    this.logger.debug(
      `WebSocket message authorized for user ${userId} (${userType})`,
    );
    return true;
  }
}
