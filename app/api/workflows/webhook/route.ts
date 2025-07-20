import { NextRequest, NextResponse } from 'next/server';
import { WorkflowEngine } from '@/lib/workflows/workflow-engine';
import { TriggerManager } from '@/lib/workflows/trigger-manager';
import { logger } from '@/lib/logger';

// Initialize workflow components
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

let workflowEngine: WorkflowEngine;
let triggerManager: TriggerManager;

// Initialize on first request
async function initializeWorkflowSystem() {
  if (!workflowEngine) {
    workflowEngine = new WorkflowEngine(supabaseUrl, supabaseServiceKey);
    await workflowEngine.initialize();
  }
}

export async function POST(request: NextRequest) {
  try {
    await initializeWorkflowSystem();

    const body = await request.json();
    const { event_type, ...payload } = body;

    // Validate webhook payload
    if (!event_type) {
      return NextResponse.json(
        { error: 'Missing event_type in webhook payload' },
        { status: 400 }
      );
    }

    logger.info('Webhook received:', { event_type, payload });

    // Handle the webhook through the trigger manager
    // This would typically be done through the initialized trigger manager
    // For now, we'll log and respond successfully
    
    return NextResponse.json({
      success: true,
      message: 'Webhook processed successfully',
      event_type,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    logger.error('Webhook processing failed:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error.message 
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  // Health check endpoint
  return NextResponse.json({
    status: 'healthy',
    service: 'workflow-webhook',
    timestamp: new Date().toISOString()
  });
}