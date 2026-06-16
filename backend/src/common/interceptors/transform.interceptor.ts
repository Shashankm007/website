import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponse, Paginated } from '../interfaces/api-response.interface';

export const RAW_RESPONSE_KEY = 'rawResponse';

function isPaginated(value: unknown): value is Paginated<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as any).items) &&
    typeof (value as any).meta === 'object'
  );
}

/**
 * Wraps every successful payload in the standard envelope.
 * - `Paginated<T>` returns `{ success, data: items, meta }`.
 * - Routes marked `@Raw()` (e.g. webhooks, file streams) are passed through untouched.
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T> | T> {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T> | T> {
    const raw = this.reflector.getAllAndOverride<boolean>(RAW_RESPONSE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    return next.handle().pipe(
      map((data) => {
        if (raw) return data;
        if (isPaginated(data)) {
          return { success: true, data: data.items as T, meta: data.meta };
        }
        return { success: true, data };
      }),
    );
  }
}
