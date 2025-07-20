import { TRPCError } from '@trpc/server';
import { ZodError } from 'zod';
import { createLogger } from '@/lib/logger';

const logger = createLogger('error-handler');

export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function handleError(error: unknown): TRPCError {
  // Handle Zod validation errors
  if (error instanceof ZodError) {
    logger.error('Validation error', { errors: error.errors });
    return new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Validation failed',
      cause: error,
    });
  }

  // Handle AppError
  if (error instanceof AppError) {
    logger.error('App error', {
      code: error.code,
      message: error.message,
      details: error.details,
    });
    
    const tRPCCode = mapStatusCodeToTRPCCode(error.statusCode);
    return new TRPCError({
      code: tRPCCode,
      message: error.message,
      cause: error,
    });
  }

  // Handle TRPCError
  if (error instanceof TRPCError) {
    logger.error('tRPC error', {
      code: error.code,
      message: error.message,
    });
    return error;
  }

  // Handle generic errors
  if (error instanceof Error) {
    logger.error('Unexpected error', {
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
    return new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
      cause: error,
    });
  }

  // Handle unknown errors
  logger.error('Unknown error', { error });
  return new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'An unknown error occurred',
  });
}

function mapStatusCodeToTRPCCode(statusCode: number): TRPCError['code'] {
  const codeMap: Record<number, TRPCError['code']> = {
    400: 'BAD_REQUEST',
    401: 'UNAUTHORIZED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    405: 'METHOD_NOT_SUPPORTED',
    408: 'TIMEOUT',
    409: 'CONFLICT',
    412: 'PRECONDITION_FAILED',
    413: 'PAYLOAD_TOO_LARGE',
    429: 'TOO_MANY_REQUESTS',
    500: 'INTERNAL_SERVER_ERROR',
    501: 'NOT_IMPLEMENTED',
  };

  return codeMap[statusCode] || 'INTERNAL_SERVER_ERROR';
}

// Error response formatter
export function formatErrorResponse(error: TRPCError) {
  return {
    error: {
      code: error.code,
      message: error.message,
      details: error.cause instanceof ZodError ? error.cause.errors : undefined,
    },
  };
}

// Async error wrapper
export function asyncHandler<T extends (...args: any[]) => Promise<any>>(
  fn: T
): T {
  return (async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      throw handleError(error);
    }
  }) as T;
}