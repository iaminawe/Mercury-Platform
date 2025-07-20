/**
 * Individual Plugin API
 * Handles specific plugin operations
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPluginSystem } from '@/lib/plugins';
import { z } from 'zod';

const updateConfigSchema = z.object({
  config: z.record(z.any())
});

const actionSchema = z.object({
  action: z.enum(['activate', 'deactivate', 'update', 'uninstall']),
  version: z.string().optional(),
  config: z.record(z.any()).optional()
});

/**
 * GET /api/marketplace/plugins/[id]
 * Get detailed plugin information
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const pluginId = params.id;
    const pluginSystem = getPluginSystem();
    
    const manifest = pluginSystem.getPluginManifest(pluginId);
    if (!manifest) {
      return NextResponse.json(
        { error: 'Plugin not found' },
        { status: 404 }
      );
    }

    const installation = pluginSystem.registry.getInstallation(pluginId);
    const instance = pluginSystem.getPlugin(pluginId);
    const stats = await getDetailedPluginStats(pluginId);
    const permissions = pluginSystem.permissionManager.getPermissionSummary(pluginId);

    return NextResponse.json({
      manifest,
      installation,
      instance: instance ? {
        status: instance.status,
        startedAt: instance.startedAt,
        lastActivity: instance.lastActivity,
        metrics: instance.metrics,
        error: instance.error?.message
      } : null,
      stats,
      permissions,
      dependencies: await pluginSystem.registry.validateDependencies(pluginId)
    });

  } catch (error) {
    console.error(`Error fetching plugin ${params.id}:`, error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/marketplace/plugins/[id]
 * Update plugin configuration
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const pluginId = params.id;
    const body = await request.json();
    
    const validation = updateConfigSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { config } = validation.data;
    const pluginSystem = getPluginSystem();
    
    const installation = pluginSystem.registry.getInstallation(pluginId);
    if (!installation) {
      return NextResponse.json(
        { error: 'Plugin not installed' },
        { status: 404 }
      );
    }

    // Update installation config
    const updatedInstallation = await pluginSystem.registry.updateInstallation(pluginId, {
      config: { ...installation.config, ...config }
    });

    // If plugin is active, restart it with new config
    const instance = pluginSystem.getPlugin(pluginId);
    if (instance && instance.status === 'active') {
      await pluginSystem.deactivatePlugin(pluginId);
      await pluginSystem.activatePlugin(pluginId, updatedInstallation.config);
    }

    return NextResponse.json({
      success: true,
      installation: updatedInstallation
    });

  } catch (error) {
    console.error(`Error updating plugin ${params.id} config:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Update failed' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/marketplace/plugins/[id]
 * Perform plugin actions (activate, deactivate, update, uninstall)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const pluginId = params.id;
    const body = await request.json();
    
    const validation = actionSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { action, version, config } = validation.data;
    const pluginSystem = getPluginSystem();
    
    switch (action) {
      case 'activate':
        {
          const instance = await pluginSystem.activatePlugin(pluginId, config);
          return NextResponse.json({
            success: true,
            action: 'activated',
            instance: {
              status: instance.status,
              startedAt: instance.startedAt,
              metrics: instance.metrics
            }
          });
        }

      case 'deactivate':
        {
          await pluginSystem.deactivatePlugin(pluginId);
          return NextResponse.json({
            success: true,
            action: 'deactivated'
          });
        }

      case 'update':
        {
          if (!version) {
            return NextResponse.json(
              { error: 'Version required for update' },
              { status: 400 }
            );
          }
          
          const instance = await pluginSystem.updatePlugin(pluginId, version);
          return NextResponse.json({
            success: true,
            action: 'updated',
            version,
            instance: instance ? {
              status: instance.status,
              startedAt: instance.startedAt,
              metrics: instance.metrics
            } : null
          });
        }

      case 'uninstall':
        {
          await pluginSystem.uninstallPlugin(pluginId);
          return NextResponse.json({
            success: true,
            action: 'uninstalled'
          });
        }

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error(`Error performing action on plugin ${params.id}:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Action failed' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/marketplace/plugins/[id]
 * Uninstall a plugin
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const pluginId = params.id;
    const pluginSystem = getPluginSystem();
    
    const installation = pluginSystem.registry.getInstallation(pluginId);
    if (!installation) {
      return NextResponse.json(
        { error: 'Plugin not installed' },
        { status: 404 }
      );
    }

    await pluginSystem.uninstallPlugin(pluginId);

    return NextResponse.json({
      success: true,
      message: `Plugin ${pluginId} uninstalled successfully`
    });

  } catch (error) {
    console.error(`Error uninstalling plugin ${params.id}:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Uninstall failed' },
      { status: 500 }
    );
  }
}

/**
 * Get detailed plugin statistics (mock implementation)
 */
async function getDetailedPluginStats(pluginId: string) {
  // In a real implementation, this would query analytics database
  return {
    downloads: {
      total: Math.floor(Math.random() * 50000),
      thisMonth: Math.floor(Math.random() * 1000),
      growth: (Math.random() - 0.5) * 100
    },
    rating: {
      average: 4 + Math.random(),
      total: Math.floor(Math.random() * 500),
      distribution: {
        5: Math.floor(Math.random() * 300),
        4: Math.floor(Math.random() * 150),
        3: Math.floor(Math.random() * 50),
        2: Math.floor(Math.random() * 20),
        1: Math.floor(Math.random() * 10)
      }
    },
    usage: {
      activeInstalls: Math.floor(Math.random() * 10000),
      averageSessionTime: Math.floor(Math.random() * 3600),
      errorRate: Math.random() * 0.05
    },
    versions: [
      {
        version: '1.2.0',
        releaseDate: new Date('2024-01-15'),
        downloads: Math.floor(Math.random() * 5000),
        changelog: 'Bug fixes and performance improvements'
      },
      {
        version: '1.1.0',
        releaseDate: new Date('2023-12-01'),
        downloads: Math.floor(Math.random() * 15000),
        changelog: 'New features and UI improvements'
      }
    ],
    lastUpdated: new Date(),
    verified: Math.random() > 0.3,
    security: Math.random() > 0.8 ? 'warning' : 'safe'
  };
}