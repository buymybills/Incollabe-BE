import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Observable, from } from "rxjs";
import { tap, catchError } from "rxjs/operators";
import Redis from "ioredis";

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
        if (err instanceof Error && err.message.includes("Redis")) {
          console.error("Redis operation failed:", err.message);
        }
        throw err; // rethrow for GlobalExceptionFilter
      }),
    );
  }
}
