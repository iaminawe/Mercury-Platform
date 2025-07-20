/**
 * Plugin Marketplace API
 * Handles plugin discovery, search, and metadata
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPluginSystem } from '@/lib/plugins';
import { z } from 'zod';

// Request validation schemas
const searchSchema = z.object({
  query: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  sort: z.enum(['name', 'downloads', 'rating', 'updated']).optional(),
  order: z.enum(['asc', 'desc']).optional(),
  limit: z.number().min(1).max(100).optional(),
  offset: z.number().min(0).optional(),
  featured: z.boolean().optional(),
  verified: z.boolean().optional()
});

const installSchema = z.object({
  pluginId: z.string(),
  version: z.string().optional(),
  config: z.record(z.any()).optional(),
  autoActivate: z.boolean().optional()
});

/**
 * GET /api/marketplace/plugins
 * Search and list available plugins
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse query parameters
    const params = {
      query: searchParams.get('query') || undefined,
      category: searchParams.get('category') || undefined,
      tags: searchParams.get('tags')?.split(',') || undefined,
      sort: searchParams.get('sort') || 'name',
      order: searchParams.get('order') || 'asc',
      limit: Number(searchParams.get('limit')) || 20,
      offset: Number(searchParams.get('offset')) || 0,
      featured: searchParams.get('featured') === 'true',
      verified: searchParams.get('verified') === 'true'
    };

    // Validate parameters
    const validation = searchSchema.safeParse(params);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid parameters', details: validation.error.issues },
        { status: 400 }
      );
    }

    const pluginSystem = getPluginSystem();
    let plugins = pluginSystem.registry.getAllPlugins();

    // Apply filters
    if (params.query) {
      plugins = pluginSystem.searchPlugins(params.query);
    }

    if (params.category) {
      plugins = plugins.filter(p => p.category === params.category);
    }

    if (params.tags && params.tags.length > 0) {
      plugins = plugins.filter(p => 
        params.tags!.some(tag => p.tags.includes(tag))
      );
    }

    // Transform to marketplace format
    const marketplacePlugins = await Promise.all(
      plugins.map(async (plugin) => {
        const installation = pluginSystem.registry.getInstallation(plugin.id);
        const stats = await getPluginStats(plugin.id);
        
        return {
          id: plugin.id,
          name: plugin.name,
          description: plugin.description,
          version: plugin.version,
          author: plugin.author,
          category: plugin.category,
          tags: plugin.tags,
          price: plugin.price || { type: 'free' },
          stats: {
            downloads: stats.downloads,
            rating: stats.rating,
            reviews: stats.reviews,
            lastUpdated: stats.lastUpdated
          },
          verification: {
            verified: stats.verified,
            security: stats.security,
            compatibility: plugin.storeTypes
          },
          installed: !!installation,
          active: installation?.status === 'active'
        };
      })
    );

    // Apply sorting
    marketplacePlugins.sort((a, b) => {
      let comparison = 0;
      
      switch (params.sort) {
        case 'downloads':
          comparison = a.stats.downloads - b.stats.downloads;
          break;
        case 'rating':
          comparison = a.stats.rating - b.stats.rating;
          break;
        case 'updated':
          comparison = new Date(a.stats.lastUpdated).getTime() - new Date(b.stats.lastUpdated).getTime();
          break;
        default:
          comparison = a.name.localeCompare(b.name);
      }
      
      return params.order === 'desc' ? -comparison : comparison;
    });

    // Apply pagination
    const paginatedPlugins = marketplacePlugins.slice(
      params.offset,
      params.offset + params.limit
    );

    return NextResponse.json({
      plugins: paginatedPlugins,
      total: marketplacePlugins.length,
      limit: params.limit,
      offset: params.offset,
      hasMore: params.offset + params.limit < marketplacePlugins.length
    });

  } catch (error) {
    console.error('Plugin marketplace search error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/marketplace/plugins
 * Install a plugin
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request body
    const validation = installSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { pluginId, version, config = {}, autoActivate = false } = validation.data;
    
    const pluginSystem = getPluginSystem();
    
    // Check if plugin exists
    const manifest = pluginSystem.getPluginManifest(pluginId);
    if (!manifest) {
      return NextResponse.json(
        { error: 'Plugin not found' },
        { status: 404 }
      );
    }

    // Check if already installed
    const existing = pluginSystem.registry.getInstallation(pluginId);
    if (existing) {
      return NextResponse.json(
        { error: 'Plugin already installed' },
        { status: 409 }
      );
    }

    // Validate dependencies
    const depValidation = await pluginSystem.registry.validateDependencies(pluginId);
    if (!depValidation.satisfied) {
      return NextResponse.json({
        error: 'Dependency validation failed',
        missing: depValidation.missing,
        conflicts: depValidation.conflicts
      }, { status: 400 });
    }

    // Install plugin
    const installation = await pluginSystem.installPlugin(
      `./plugins/${pluginId}`, // Assume plugins are in local directory
      config,
      { autoActivate }
    );

    // Get installation details
    const installedPlugin = pluginSystem.getPluginManifest(pluginId);
    const instance = autoActivate ? pluginSystem.getPlugin(pluginId) : null;

    return NextResponse.json({
      success: true,
      installation,
      plugin: installedPlugin,
      instance: instance ? {
        id: instance.manifest.id,
        status: instance.status,
        startedAt: instance.startedAt,
        metrics: instance.metrics
      } : null
    });

  } catch (error) {
    console.error('Plugin installation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Installation failed' },
      { status: 500 }
    );
  }
}

/**
 * Get plugin statistics (mock implementation)
 */
async function getPluginStats(pluginId: string): Promise<{
  downloads: number;
  rating: number;
  reviews: number;
  lastUpdated: Date;
  verified: boolean;
  security: 'safe' | 'warning' | 'danger';
}> {
  // In a real implementation, this would query the marketplace database
  return {
    downloads: Math.floor(Math.random() * 10000),
    rating: 4 + Math.random(),
    reviews: Math.floor(Math.random() * 500),
    lastUpdated: new Date(),
    verified: Math.random() > 0.3,
    security: Math.random() > 0.8 ? 'warning' : 'safe'
  };
}