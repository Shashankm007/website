import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';

/**
 * Converts every thrown error into the standard error envelope:
 * { success:false, error:{ code, message, details, statusCode }, path, timestamp }
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'Something went wrong';
    let details: unknown = undefined;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const r = res as Record<string, any>;
        message = Array.isArray(r.message) ? r.message[0] : r.message ?? exception.message;
        details = Array.isArray(r.message) ? r.message : r.details;
      }
      code = this.codeForStatus(statusCode);
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      ({ statusCode, code, message } = this.mapPrismaError(exception));
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      statusCode = HttpStatus.BAD_REQUEST;
      code = 'VALIDATION_ERROR';
      message = 'Invalid query/data shape';
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    if (statusCode >= 500) {
      this.logger.error(`${request.method} ${request.url} -> ${statusCode}: ${message}`, (exception as Error)?.stack);
    } else {
      this.logger.warn(`${request.method} ${request.url} -> ${statusCode}: ${message}`);
    }

    response.status(statusCode).json({
      success: false,
      error: { code, message, details, statusCode },
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }

  private codeForStatus(status: number): string {
    switch (status) {
      case 400:
        return 'VALIDATION_ERROR';
      case 401:
        return 'UNAUTHORIZED';
      case 403:
        return 'FORBIDDEN';
      case 404:
        return 'NOT_FOUND';
      case 409:
        return 'CONFLICT';
      case 422:
        return 'VALIDATION_ERROR';
      case 429:
        return 'RATE_LIMITED';
      default:
        return status >= 500 ? 'INTERNAL_ERROR' : 'ERROR';
    }
  }

  private mapPrismaError(e: Prisma.PrismaClientKnownRequestError): {
    statusCode: number;
    code: string;
    message: string;
  } {
    switch (e.code) {
      case 'P2002': {
        const target = (e.meta?.target as string[] | undefined)?.join(', ') ?? 'field';
        return { statusCode: HttpStatus.CONFLICT, code: 'CONFLICT', message: `A record with this ${target} already exists` };
      }
      case 'P2025':
        return { statusCode: HttpStatus.NOT_FOUND, code: 'NOT_FOUND', message: 'Record not found' };
      case 'P2003':
        return { statusCode: HttpStatus.BAD_REQUEST, code: 'VALIDATION_ERROR', message: 'Related record does not exist' };
      default:
        return { statusCode: HttpStatus.BAD_REQUEST, code: 'VALIDATION_ERROR', message: 'Database request error' };
    }
  }
}
