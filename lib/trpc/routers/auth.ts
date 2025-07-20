import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '@/lib/trpc/init';
import { TRPCError } from '@trpc/server';
import { createLogger } from '@/lib/logger';

const logger = createLogger('auth-router');

export const authRouter = router({
  signUp: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(8),
        shopDomain: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { email, password, shopDomain } = input;

      try {
        const { data, error } = await ctx.supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              shop_domain: shopDomain,
            },
          },
        });

        if (error) {
          logger.error('Sign up error', error);
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error.message,
          });
        }

        logger.info('User signed up', { email });
        return { user: data.user, session: data.session };
      } catch (error) {
        logger.error('Unexpected sign up error', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to sign up',
        });
      }
    }),

  signIn: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { email, password } = input;

      try {
        const { data, error } = await ctx.supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          logger.error('Sign in error', error);
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Invalid credentials',
          });
        }

        logger.info('User signed in', { email });
        return { user: data.user, session: data.session };
      } catch (error) {
        logger.error('Unexpected sign in error', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to sign in',
        });
      }
    }),

  signOut: protectedProcedure.mutation(async ({ ctx }) => {
    try {
      const { error } = await ctx.supabase.auth.signOut();

      if (error) {
        logger.error('Sign out error', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to sign out',
        });
      }

      logger.info('User signed out', { userId: ctx.user?.id });
      return { success: true };
    } catch (error) {
      logger.error('Unexpected sign out error', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to sign out',
      });
    }
  }),

  getSession: publicProcedure.query(async ({ ctx }) => {
    try {
      const { data: { session }, error } = await ctx.supabase.auth.getSession();

      if (error) {
        logger.error('Get session error', error);
        return { session: null };
      }

      return { session };
    } catch (error) {
      logger.error('Unexpected get session error', error);
      return { session: null };
    }
  }),

  refreshSession: protectedProcedure.mutation(async ({ ctx }) => {
    try {
      const { data, error } = await ctx.supabase.auth.refreshSession();

      if (error) {
        logger.error('Refresh session error', error);
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Failed to refresh session',
        });
      }

      logger.info('Session refreshed', { userId: ctx.user?.id });
      return { session: data.session };
    } catch (error) {
      logger.error('Unexpected refresh session error', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to refresh session',
      });
    }
  }),

  // Shopify-specific auth methods
  getStore: protectedProcedure.query(async ({ ctx }) => {
    try {
      const { data: store, error } = await ctx.supabase
        .from('stores')
        .select('*')
        .eq('owner_id', ctx.user.id)
        .single();

      if (error) {
        logger.error('Get store error', error);
        return { store: null };
      }

      return { store };
    } catch (error) {
      logger.error('Unexpected get store error', error);
      return { store: null };
    }
  }),

  updateStore: protectedProcedure
    .input(
      z.object({
        settings: z.record(z.any()).optional(),
        is_active: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const { data: store, error: storeError } = await ctx.supabase
          .from('stores')
          .select('id')
          .eq('owner_id', ctx.user.id)
          .single();

        if (storeError || !store) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Store not found',
          });
        }

        const { error: updateError } = await ctx.supabase
          .from('stores')
          .update({
            ...input,
            updated_at: new Date().toISOString(),
          })
          .eq('id', store.id);

        if (updateError) {
          logger.error('Update store error', updateError);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to update store',
          });
        }

        logger.info('Store updated', { storeId: store.id, userId: ctx.user.id });
        return { success: true };
      } catch (error) {
        logger.error('Unexpected update store error', error);
        throw error instanceof TRPCError
          ? error
          : new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: 'Failed to update store',
            });
      }
    }),

  disconnectStore: protectedProcedure.mutation(async ({ ctx }) => {
    try {
      const { data: store, error: storeError } = await ctx.supabase
        .from('stores')
        .select('id, shop_domain')
        .eq('owner_id', ctx.user.id)
        .single();

      if (storeError || !store) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Store not found',
        });
      }

      // Mark store as inactive
      const { error: updateError } = await ctx.supabase
        .from('stores')
        .update({
          is_active: false,
          access_token: '', // Clear the access token
          updated_at: new Date().toISOString(),
        })
        .eq('id', store.id);

      if (updateError) {
        logger.error('Disconnect store error', updateError);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to disconnect store',
        });
      }

      logger.info('Store disconnected', { storeId: store.id, userId: ctx.user.id });
      return { success: true };
    } catch (error) {
      logger.error('Unexpected disconnect store error', error);
      throw error instanceof TRPCError
        ? error
        : new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: 'Failed to disconnect store',
            });
    }
  }),
});