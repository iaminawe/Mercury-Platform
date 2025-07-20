import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import { ZodError } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import type { Database } from '@/lib/database.types';
import type { SupabaseClient, User } from '@supabase/supabase-js';

export interface Context {
  supabase: SupabaseClient<Database>;
  user: User | null;
  storeId?: string;
}

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

// Middleware for authenticated procedures
const isAuthenticated = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }

  logger.debug('Authenticated request', {
    userId: ctx.user.id,
    email: ctx.user.email,
  });

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

// Middleware for store-specific procedures
const hasStore = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }

  const { data: store } = await ctx.supabase
    .from('stores')
    .select('id')
    .eq('owner_id', ctx.user.id)
    .single();

  if (!store) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'No store found for this user',
    });
  }

  return next({
    ctx: {
      ...ctx,
      storeId: store.id,
    },
  });
});

export const protectedProcedure = t.procedure.use(isAuthenticated);
export const storeProcedure = t.procedure.use(isAuthenticated).use(hasStore);