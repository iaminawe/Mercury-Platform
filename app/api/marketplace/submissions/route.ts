/**
 * Plugin Submission API
 * Handles plugin submissions to the marketplace
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { writeFile, mkdir, stat } from 'fs/promises';
import { join } from 'path';

const submissionSchema = z.object({
  pluginId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(10),
  version: z.string().regex(/^\d+\.\d+\.\d+/),
  author: z.object({
    name: z.string().min(1),
    email: z.string().email(),
    url: z.string().url().optional()
  }),
  category: z.enum(['ai', 'analytics', 'integration', 'ui', 'automation', 'marketing', 'security']),
  tags: z.array(z.string()).min(1).max(10),
  repository: z.string().url().optional(),
  documentation: z.string().url().optional(),
  price: z.object({
    type: z.enum(['free', 'paid', 'freemium']),
    amount: z.number().optional(),
    currency: z.string().optional(),
    billing: z.enum(['one-time', 'monthly', 'annual']).optional()
  }).optional(),
  storeTypes: z.array(z.enum(['shopify', 'woocommerce', 'magento', 'custom'])),
  packageFile: z.string(), // Base64 encoded package
  screenshots: z.array(z.string()).optional(),
  submissionNotes: z.string().optional()
});

const reviewSchema = z.object({
  submissionId: z.string(),
  status: z.enum(['approved', 'rejected', 'needs-changes']),
  feedback: z.string().optional(),
  securityIssues: z.array(z.string()).optional(),
  compatibilityIssues: z.array(z.string()).optional(),
  qualityScore: z.number().min(0).max(100).optional()
});

/**
 * POST /api/marketplace/submissions
 * Submit a new plugin for review
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate submission data
    const validation = submissionSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid submission data', details: validation.error.issues },
        { status: 400 }
      );
    }

    const submissionData = validation.data;
    
    // Check for duplicate plugin ID
    const existingSubmission = await getSubmissionByPluginId(submissionData.pluginId);
    if (existingSubmission) {
      return NextResponse.json(
        { error: 'Plugin ID already exists' },
        { status: 409 }
      );
    }

    // Create submission
    const submission: PluginSubmission = {
      id: generateSubmissionId(),
      ...submissionData,
      submittedAt: new Date(),
      status: 'pending',
      reviewHistory: [],
      securityScan: {
        completed: false,
        issues: [],
        score: 0
      }
    };

    // Save package file
    const packagePath = await savePackageFile(submission.id, submissionData.packageFile);
    submission.packagePath = packagePath;

    // Save submission
    await saveSubmission(submission);

    // Queue for automated security scan
    await queueSecurityScan(submission.id);

    // Notify review team
    await notifyReviewTeam(submission);

    return NextResponse.json({
      success: true,
      submissionId: submission.id,
      status: submission.status,
      message: 'Plugin submitted successfully. It will be reviewed within 48 hours.'
    });

  } catch (error) {
    console.error('Plugin submission error:', error);
    return NextResponse.json(
      { error: 'Failed to submit plugin' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/marketplace/submissions
 * Get submissions (for admins and developers)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const authorEmail = searchParams.get('author');
    const limit = Number(searchParams.get('limit')) || 20;
    const offset = Number(searchParams.get('offset')) || 0;

    // Get submissions with filters
    const submissions = await getSubmissions({
      status: status as SubmissionStatus | undefined,
      authorEmail,
      limit,
      offset
    });

    return NextResponse.json({
      submissions: submissions.map(s => ({
        id: s.id,
        pluginId: s.pluginId,
        name: s.name,
        description: s.description,
        version: s.version,
        author: s.author,
        category: s.category,
        tags: s.tags,
        status: s.status,
        submittedAt: s.submittedAt,
        reviewedAt: s.reviewedAt,
        securityScan: s.securityScan
      })),
      total: await getSubmissionsCount({ status: status as SubmissionStatus | undefined, authorEmail })
    });

  } catch (error) {
    console.error('Error fetching submissions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch submissions' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/marketplace/submissions
 * Review a submission (admin only)
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate review data
    const validation = reviewSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid review data', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { submissionId, status, feedback, securityIssues, compatibilityIssues, qualityScore } = validation.data;

    // Get existing submission
    const submission = await getSubmission(submissionId);
    if (!submission) {
      return NextResponse.json(
        { error: 'Submission not found' },
        { status: 404 }
      );
    }

    // Create review entry
    const review: SubmissionReview = {
      id: generateReviewId(),
      reviewerId: 'admin', // In real app, get from auth
      reviewedAt: new Date(),
      status,
      feedback,
      securityIssues: securityIssues || [],
      compatibilityIssues: compatibilityIssues || [],
      qualityScore: qualityScore || 0
    };

    // Update submission
    submission.status = status;
    submission.reviewedAt = new Date();
    submission.reviewHistory.push(review);

    // Save updated submission
    await saveSubmission(submission);

    // Handle approved plugins
    if (status === 'approved') {
      await publishPlugin(submission);
    }

    // Notify submitter
    await notifySubmitter(submission, review);

    return NextResponse.json({
      success: true,
      submissionId,
      status,
      review
    });

  } catch (error) {
    console.error('Error reviewing submission:', error);
    return NextResponse.json(
      { error: 'Failed to review submission' },
      { status: 500 }
    );
  }
}

// Helper functions and types

type SubmissionStatus = 'pending' | 'under-review' | 'approved' | 'rejected' | 'needs-changes';

interface PluginSubmission {
  id: string;
  pluginId: string;
  name: string;
  description: string;
  version: string;
  author: {
    name: string;
    email: string;
    url?: string;
  };
  category: string;
  tags: string[];
  repository?: string;
  documentation?: string;
  price?: {
    type: 'free' | 'paid' | 'freemium';
    amount?: number;
    currency?: string;
    billing?: 'one-time' | 'monthly' | 'annual';
  };
  storeTypes: string[];
  packageFile: string;
  packagePath?: string;
  screenshots?: string[];
  submissionNotes?: string;
  submittedAt: Date;
  status: SubmissionStatus;
  reviewedAt?: Date;
  reviewHistory: SubmissionReview[];
  securityScan: {
    completed: boolean;
    issues: string[];
    score: number;
  };
}

interface SubmissionReview {
  id: string;
  reviewerId: string;
  reviewedAt: Date;
  status: SubmissionStatus;
  feedback?: string;
  securityIssues: string[];
  compatibilityIssues: string[];
  qualityScore: number;
}

// Mock implementations - in production, these would use a database

async function getSubmissionByPluginId(pluginId: string): Promise<PluginSubmission | null> {
  // Check if plugin ID exists in submissions
  return null; // Mock: no existing submissions
}

async function saveSubmission(submission: PluginSubmission): Promise<void> {
  // Save to database
  const submissionsDir = join(process.cwd(), '.mercury', 'submissions');
  await ensureDirectory(submissionsDir);
  
  const filePath = join(submissionsDir, `${submission.id}.json`);
  await writeFile(filePath, JSON.stringify(submission, null, 2));
}

async function getSubmission(submissionId: string): Promise<PluginSubmission | null> {
  try {
    const filePath = join(process.cwd(), '.mercury', 'submissions', `${submissionId}.json`);
    const { readFile } = await import('fs/promises');
    const content = await readFile(filePath, 'utf-8');
    const submission = JSON.parse(content);
    
    // Convert date strings back to Date objects
    submission.submittedAt = new Date(submission.submittedAt);
    if (submission.reviewedAt) {
      submission.reviewedAt = new Date(submission.reviewedAt);
    }
    submission.reviewHistory = submission.reviewHistory.map((r: any) => ({
      ...r,
      reviewedAt: new Date(r.reviewedAt)
    }));
    
    return submission;
  } catch {
    return null;
  }
}

async function getSubmissions(filters: {
  status?: SubmissionStatus;
  authorEmail?: string;
  limit: number;
  offset: number;
}): Promise<PluginSubmission[]> {
  // Mock implementation - would query database
  return [];
}

async function getSubmissionsCount(filters: {
  status?: SubmissionStatus;
  authorEmail?: string;
}): Promise<number> {
  // Mock implementation - would query database
  return 0;
}

async function savePackageFile(submissionId: string, packageFileBase64: string): Promise<string> {
  const packagesDir = join(process.cwd(), '.mercury', 'packages');
  await ensureDirectory(packagesDir);
  
  const packagePath = join(packagesDir, `${submissionId}.zip`);
  const packageBuffer = Buffer.from(packageFileBase64, 'base64');
  
  await writeFile(packagePath, packageBuffer);
  return packagePath;
}

async function queueSecurityScan(submissionId: string): Promise<void> {
  // Queue for security scanning
  console.log(`Queued security scan for submission: ${submissionId}`);
}

async function notifyReviewTeam(submission: PluginSubmission): Promise<void> {
  // Send notification to review team
  console.log(`New plugin submission: ${submission.name} by ${submission.author.name}`);
}

async function publishPlugin(submission: PluginSubmission): Promise<void> {
  // Publish approved plugin to marketplace
  console.log(`Publishing plugin: ${submission.pluginId}`);
}

async function notifySubmitter(submission: PluginSubmission, review: SubmissionReview): Promise<void> {
  // Notify plugin author about review decision
  console.log(`Notifying ${submission.author.email} about review: ${review.status}`);
}

function generateSubmissionId(): string {
  return `sub-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function generateReviewId(): string {
  return `rev-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

async function ensureDirectory(dirPath: string): Promise<void> {
  try {
    await stat(dirPath);
  } catch {
    await mkdir(dirPath, { recursive: true });
  }
}