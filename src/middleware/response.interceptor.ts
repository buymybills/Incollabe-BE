import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { map } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { toIST } from '../shared/utils/date.utils';

/**
 * Recursively rewrites all S3 URLs to CloudFront URLs in a response object.
 * Handles nested objects, arrays, and plain strings.
 */
function rewriteUrls(obj: any, s3Prefix: string, cfPrefix: string): any {
  if (typeof obj === 'string') {
    return obj.startsWith(s3Prefix) ? cfPrefix + obj.slice(s3Prefix.length) : obj;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => rewriteUrls(item, s3Prefix, cfPrefix));
  }
  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, any> = {};
    for (const key of Object.keys(obj)) {
      result[key] = rewriteUrls(obj[key], s3Prefix, cfPrefix);
    }
    return result;
  }
  return obj;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, any> {
  /**
   * @param s3Prefix  - e.g. "https://mybucket.s3.ap-south-1.amazonaws.com/"
   * @param cfPrefix  - e.g. "https://xxxxx.cloudfront.net/"  (omit to disable rewriting)
   */
  constructor(
    private readonly s3Prefix?: string,
    private readonly cfPrefix?: string,
  ) {}

  intercept(_context: ExecutionContext, next: CallHandler<T>): Observable<any> {
    return next.handle().pipe(
      map((data) => {
        const rewritten =
          this.s3Prefix && this.cfPrefix
            ? rewriteUrls(data, this.s3Prefix, this.cfPrefix)
            : data;
        return {
          success: true,
          data: rewritten,
          message: 'Success',
          timestamp: toIST(new Date()),
        };
      }),
    );
  }
}
