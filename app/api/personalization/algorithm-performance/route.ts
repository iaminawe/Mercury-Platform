import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Mock algorithm performance data
    const algorithms = [
      {
        name: 'Collaborative Filtering',
        weight: 0.35,
        accuracy: 0.92,
        coverage: 0.78,
        diversity: 0.65,
        novelty: 0.45
      },
      {
        name: 'Content-Based',
        weight: 0.25,
        accuracy: 0.88,
        coverage: 0.95,
        diversity: 0.72,
        novelty: 0.38
      },
      {
        name: 'Deep Learning',
        weight: 0.30,
        accuracy: 0.96,
        coverage: 0.82,
        diversity: 0.68,
        novelty: 0.62
      },
      {
        name: 'Trending',
        weight: 0.10,
        accuracy: 0.84,
        coverage: 0.60,
        diversity: 0.85,
        novelty: 0.90
      }
    ];

    return NextResponse.json(algorithms);
  } catch (error) {
    console.error('Error fetching algorithm performance:', error);
    return NextResponse.json(
      { error: 'Failed to fetch algorithm performance' },
      { status: 500 }
    );
  }
}