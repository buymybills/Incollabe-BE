import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import { Request } from 'express';

// Extend Express Request to include requestId
declare module 'express' {
  interface Request {
    requestId?: string;
  }
}

/**
 * Request ID Interceptor
 * Generates a unique UUID for each request to enable error tracking
 */
@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    
    // Generate unique request ID
    request.requestId = uuidv4();
    
    return next.handle();
  }
}
