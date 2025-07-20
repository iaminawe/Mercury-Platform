'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ConfidenceBadgeProps {
  confidence: number;
  size?: 'sm' | 'default';
  showPercentage?: boolean;
}

export function ConfidenceBadge({ 
  confidence, 
  size = 'default', 
  showPercentage = true 
}: ConfidenceBadgeProps) {
  const getConfidenceLevel = (score: number) => {
    if (score >= 0.9) return { label: 'Very High', color: 'bg-green-100 text-green-800 border-green-200' };
    if (score >= 0.8) return { label: 'High', color: 'bg-blue-100 text-blue-800 border-blue-200' };
    if (score >= 0.7) return { label: 'Good', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' };
    if (score >= 0.6) return { label: 'Moderate', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' };
    if (score >= 0.5) return { label: 'Fair', color: 'bg-orange-100 text-orange-800 border-orange-200' };
    return { label: 'Low', color: 'bg-red-100 text-red-800 border-red-200' };
  };

  const confidenceInfo = getConfidenceLevel(confidence);
  const percentage = Math.round(confidence * 100);

  return (
    <Badge 
      variant="outline" 
      className={cn(
        confidenceInfo.color,
        size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-2.5 py-1'
      )}
    >
      {showPercentage ? `${percentage}% ${confidenceInfo.label}` : confidenceInfo.label}
    </Badge>
  );
}