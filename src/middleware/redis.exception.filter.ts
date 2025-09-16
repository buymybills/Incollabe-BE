import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import Redis from 'ioredis';
import { Observable } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

@Injectable()
export class RedisInterceptor implements NestInterceptor {
  constructor(private readonly redisClient: Redis) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      tap(() => {
        // Optional: hook after successful handler execution
      }),
      catchError((err) => {
        // If the error is Redis-related
        if (err instanceof Error && err.message.includes('Redis')) {
          console.error('Redis operation failed:', err.message);
        }
        throw err; // rethrow for GlobalExceptionFilter
      }),
    );
  }
}
