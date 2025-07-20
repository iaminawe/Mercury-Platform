import { NextRequest, NextResponse } from 'next/server'

// Developer portal API routes
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')

  try {
    switch (action) {
      case 'stats':
        return NextResponse.json({
          success: true,
          data: {
            apiCalls: 2500000,
            activeExtensions: 8,
            revenueShare: 4250,
            installs: 1284,
            growth: {
              apiCalls: 12,
              extensions: 2,
              revenue: 18,
              installs: 24
            }
          }
        })

      case 'api-keys':
        return NextResponse.json({
          success: true,
          data: [
            {
              id: '1',
              name: 'Production API Key',
              key: 'mk_live_1234567890abcdef',
              permissions: ['read:products', 'write:orders', 'read:analytics'],
              status: 'active',
              createdAt: '2024-01-15',
              lastUsed: '2024-01-19',
              rateLimit: 10000
            },
            {
              id: '2',
              name: 'Development Key',
              key: 'mk_test_abcdef1234567890',
              permissions: ['read:products', 'read:analytics'],
              status: 'active',
              createdAt: '2024-01-10',
              lastUsed: '2024-01-18',
              expiresAt: '2024-06-10',
              rateLimit: 1000
            }
          ]
        })

      case 'extensions':
        return NextResponse.json({
          success: true,
          data: [
            {
              id: '1',
              name: 'Smart Product Recommendations',
              description: 'AI-powered product recommendations that increase conversion rates by 25%',
              version: '2.1.0',
              status: 'published',
              installs: 1284,
              rating: 4.8,
              category: 'AI & Machine Learning',
              author: 'Mercury Labs',
              createdAt: '2024-01-15',
              updatedAt: '2024-01-18',
              revenue: 2450
            },
            {
              id: '2',
              name: 'Advanced Analytics Dashboard',
              description: 'Comprehensive analytics with predictive insights and custom reports',
              version: '1.3.2',
              status: 'published',
              installs: 892,
              rating: 4.6,
              category: 'Analytics',
              author: 'Mercury Labs',
              createdAt: '2024-01-10',
              updatedAt: '2024-01-16',
              revenue: 1800
            }
          ]
        })

      case 'activity':
        return NextResponse.json({
          success: true,
          data: [
            {
              id: '1',
              type: 'api_key_created',
              message: 'API key "prod-key-2024" created',
              timestamp: '2024-01-19T14:00:00Z'
            },
            {
              id: '2',
              type: 'extension_updated',
              message: 'Extension "Smart Recommendations" updated',
              timestamp: '2024-01-18T10:00:00Z'
            },
            {
              id: '3',
              type: 'webhook_configured',
              message: 'New webhook endpoint configured',
              timestamp: '2024-01-17T16:30:00Z'
            }
          ]
        })

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Developer API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body

    switch (action) {
      case 'create-api-key':
        const newKey = {
          id: Date.now().toString(),
          name: body.name,
          key: `mk_live_${Math.random().toString(36).substring(2)}`,
          permissions: body.permissions,
          status: 'active',
          createdAt: new Date().toISOString().split('T')[0],
          lastUsed: 'Never',
          expiresAt: body.expiresAt || undefined,
          rateLimit: body.rateLimit || 1000
        }

        return NextResponse.json({
          success: true,
          data: newKey
        })

      case 'create-extension':
        const newExtension = {
          id: Date.now().toString(),
          name: body.name,
          description: body.description,
          version: '1.0.0',
          status: 'draft',
          installs: 0,
          rating: 0,
          category: body.category,
          author: 'Your Company',
          createdAt: new Date().toISOString().split('T')[0],
          updatedAt: new Date().toISOString().split('T')[0],
          revenue: 0
        }

        return NextResponse.json({
          success: true,
          data: newExtension
        })

      case 'track-recommendation':
        // Track recommendation interaction
        return NextResponse.json({
          success: true,
          message: 'Event tracked successfully'
        })

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Developer API POST error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, id } = body

    switch (action) {
      case 'update-api-key':
        return NextResponse.json({
          success: true,
          message: 'API key updated successfully'
        })

      case 'revoke-api-key':
        return NextResponse.json({
          success: true,
          message: 'API key revoked successfully'
        })

      case 'update-extension':
        return NextResponse.json({
          success: true,
          message: 'Extension updated successfully'
        })

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Developer API PUT error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    const id = searchParams.get('id')

    switch (action) {
      case 'delete-api-key':
        return NextResponse.json({
          success: true,
          message: 'API key deleted successfully'
        })

      case 'delete-extension':
        return NextResponse.json({
          success: true,
          message: 'Extension deleted successfully'
        })

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Developer API DELETE error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}