'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  Brain, 
  Users, 
  TrendingUp, 
  Sparkles,
  RefreshCw,
  Eye,
  MousePointer,
  ShoppingCart,
  Star
} from 'lucide-react';

interface RecommendationItem {
  id: string;
  title: string;
  price: number;
  image: string;
  category: string;
  brand: string;
  score: number;
  confidence: number;
  algorithm: string;
  reasons: string[];
  features?: Record<string, any>;
}

interface AlgorithmPerformance {
  name: string;
  weight: number;
  accuracy: number;
  coverage: number;
  diversity: number;
  novelty: number;
}

interface RecommendationPreviewProps {
  segment: string;
}

export function RecommendationPreview({ segment }: RecommendationPreviewProps) {
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([]);
  const [algorithms, setAlgorithms] = useState<AlgorithmPerformance[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedAlgorithm, setSelectedAlgorithm] = useState('hybrid');
  const [isLoading, setIsLoading] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);

  useEffect(() => {
    fetchAlgorithmPerformance();
    if (selectedUserId) {
      fetchRecommendations();
    }
  }, [segment, selectedUserId, selectedAlgorithm]);

  const fetchRecommendations = async () => {
    if (!selectedUserId) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/personalization/recommendations?userId=${selectedUserId}&algorithm=${selectedAlgorithm}&segment=${segment}`
      );
      const data = await response.json();
      setRecommendations(data);
    } catch (error) {
      console.error('Error fetching recommendations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAlgorithmPerformance = async () => {
    try {
      const response = await fetch('/api/personalization/algorithm-performance');
      const data = await response.json();
      setAlgorithms(data);
    } catch (error) {
      console.error('Error fetching algorithm performance:', error);
    }
  };

  const runABTest = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/personalization/ab-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUserId,
          segment,
          algorithms: ['collaborative', 'content-based', 'deep-learning', 'hybrid']
        })
      });
      const data = await response.json();
      setTestResults(data);
    } catch (error) {
      console.error('Error running A/B test:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getAlgorithmColor = (algorithm: string) => {
    const colors: Record<string, string> = {
      'collaborative': 'bg-blue-500',
      'content-based': 'bg-green-500',
      'deep-learning': 'bg-purple-500',
      'hybrid': 'bg-orange-500',
      'trending': 'bg-pink-500'
    };
    return colors[algorithm] || 'bg-gray-500';
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return 'text-green-600';
    if (score >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-6">
      {/* Test Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Recommendation Testing
          </CardTitle>
          <CardDescription>
            Test and preview personalized recommendations for different algorithms
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="userId">Test User ID</Label>
              <Input
                id="userId"
                placeholder="Enter user ID"
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="algorithm">Algorithm</Label>
              <Select value={selectedAlgorithm} onValueChange={setSelectedAlgorithm}>
                <SelectTrigger>
                  <SelectValue placeholder="Select algorithm" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hybrid">Hybrid (Recommended)</SelectItem>
                  <SelectItem value="collaborative">Collaborative Filtering</SelectItem>
                  <SelectItem value="content-based">Content-Based</SelectItem>
                  <SelectItem value="deep-learning">Deep Learning</SelectItem>
                  <SelectItem value="trending">Trending</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Actions</Label>
              <div className="flex gap-2">
                <Button 
                  onClick={fetchRecommendations}
                  disabled={!selectedUserId || isLoading}
                  className="flex-1"
                >
                  {isLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Generate'}
                </Button>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>A/B Testing</Label>
              <Button 
                onClick={runABTest}
                disabled={!selectedUserId || isLoading}
                variant="outline"
                className="w-full"
              >
                Run A/B Test
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="recommendations" className="space-y-4">
        <TabsList>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
          <TabsTrigger value="algorithms">Algorithm Performance</TabsTrigger>
          <TabsTrigger value="testing">A/B Testing</TabsTrigger>
        </TabsList>

        <TabsContent value="recommendations" className="space-y-4">
          {recommendations.length > 0 ? (
            <div className="space-y-4">
              {/* Recommendation Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    Recommendations for User {selectedUserId}
                  </CardTitle>
                  <CardDescription>
                    Generated using {selectedAlgorithm} algorithm • {segment} segment
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold">{recommendations.length}</div>
                      <div className="text-sm text-muted-foreground">Total Items</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">
                        {(recommendations.reduce((sum, r) => sum + r.score, 0) / recommendations.length * 100).toFixed(1)}%
                      </div>
                      <div className="text-sm text-muted-foreground">Avg Score</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">
                        {(recommendations.reduce((sum, r) => sum + r.confidence, 0) / recommendations.length * 100).toFixed(1)}%
                      </div>
                      <div className="text-sm text-muted-foreground">Avg Confidence</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">
                        {new Set(recommendations.map(r => r.category)).size}
                      </div>
                      <div className="text-sm text-muted-foreground">Categories</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Recommendation Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {recommendations.map((item, index) => (
                  <Card key={item.id} className="overflow-hidden">
                    <div className="aspect-square bg-gray-100 relative">
                      <div className="absolute top-2 left-2">
                        <Badge className="text-xs">#{index + 1}</Badge>
                      </div>
                      <div className="absolute top-2 right-2">
                        <Badge 
                          variant="secondary" 
                          className={`text-xs ${getAlgorithmColor(item.algorithm.split(',')[0])} text-white`}
                        >
                          {item.algorithm.split(',')[0]}
                        </Badge>
                      </div>
                      <div className="absolute bottom-2 left-2 right-2">
                        <div className="bg-white/90 backdrop-blur-sm rounded p-2">
                          <div className="flex justify-between items-center text-xs">
                            <span className={`font-bold ${getScoreColor(item.score)}`}>
                              {(item.score * 100).toFixed(0)}% match
                            </span>
                            <span className="text-muted-foreground">
                              {(item.confidence * 100).toFixed(0)}% conf
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <CardContent className="p-4">
                      <div className="space-y-2">
                        <h3 className="font-semibold text-sm truncate">{item.title}</h3>
                        <div className="flex justify-between items-center">
                          <span className="text-lg font-bold">${item.price.toFixed(2)}</span>
                          <Badge variant="outline" className="text-xs">{item.category}</Badge>
                        </div>
                        
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span>Relevance Score</span>
                            <span>{(item.score * 100).toFixed(0)}%</span>
                          </div>
                          <Progress value={item.score * 100} className="h-1" />
                        </div>
                        
                        <div className="space-y-1">
                          <div className="text-xs text-muted-foreground">Why recommended:</div>
                          <div className="text-xs">
                            {item.reasons.slice(0, 2).map((reason, idx) => (
                              <div key={idx} className="flex items-start gap-1">
                                <span className="text-muted-foreground">•</span>
                                <span>{reason}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Recommendations</h3>
                <p className="text-muted-foreground text-center max-w-md">
                  Enter a user ID and select an algorithm to generate personalized recommendations.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="algorithms" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {algorithms.map((algorithm) => (
              <Card key={algorithm.name}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <div className={`h-3 w-3 rounded-full ${getAlgorithmColor(algorithm.name.toLowerCase().replace(' ', '-'))}`} />
                    {algorithm.name}
                  </CardTitle>
                  <CardDescription>
                    Weight: {(algorithm.weight * 100).toFixed(0)}% of hybrid model
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>Accuracy</span>
                        <span>{(algorithm.accuracy * 100).toFixed(1)}%</span>
                      </div>
                      <Progress value={algorithm.accuracy * 100} />
                    </div>
                    
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>Coverage</span>
                        <span>{(algorithm.coverage * 100).toFixed(1)}%</span>
                      </div>
                      <Progress value={algorithm.coverage * 100} />
                    </div>
                    
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>Diversity</span>
                        <span>{(algorithm.diversity * 100).toFixed(1)}%</span>
                      </div>
                      <Progress value={algorithm.diversity * 100} />
                    </div>
                    
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>Novelty</span>
                        <span>{(algorithm.novelty * 100).toFixed(1)}%</span>
                      </div>
                      <Progress value={algorithm.novelty * 100} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="testing" className="space-y-4">
          {testResults ? (
            <Card>
              <CardHeader>
                <CardTitle>A/B Test Results</CardTitle>
                <CardDescription>
                  Performance comparison across different algorithms
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {testResults.results?.map((result: any, index: number) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-semibold">{result.algorithm}</h3>
                          <p className="text-sm text-muted-foreground">
                            {result.recommendations?.length || 0} recommendations
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold">
                            {(result.overallScore * 100).toFixed(1)}%
                          </div>
                          <div className="text-xs text-muted-foreground">Overall Score</div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-4 gap-4">
                        <div className="text-center">
                          <div className="flex items-center gap-1 justify-center">
                            <Eye className="h-3 w-3" />
                            <span className="text-xs">Relevance</span>
                          </div>
                          <div className="font-semibold">{(result.relevanceScore * 100).toFixed(0)}%</div>
                        </div>
                        
                        <div className="text-center">
                          <div className="flex items-center gap-1 justify-center">
                            <Users className="h-3 w-3" />
                            <span className="text-xs">Diversity</span>
                          </div>
                          <div className="font-semibold">{(result.diversityScore * 100).toFixed(0)}%</div>
                        </div>
                        
                        <div className="text-center">
                          <div className="flex items-center gap-1 justify-center">
                            <Sparkles className="h-3 w-3" />
                            <span className="text-xs">Novelty</span>
                          </div>
                          <div className="font-semibold">{(result.noveltyScore * 100).toFixed(0)}%</div>
                        </div>
                        
                        <div className="text-center">
                          <div className="flex items-center gap-1 justify-center">
                            <Star className="h-3 w-3" />
                            <span className="text-xs">Confidence</span>
                          </div>
                          <div className="font-semibold">{(result.confidenceScore * 100).toFixed(0)}%</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <TrendingUp className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">A/B Testing</h3>
                <p className="text-muted-foreground text-center max-w-md mb-4">
                  Compare recommendation algorithms side-by-side to optimize performance.
                </p>
                <Button 
                  onClick={runABTest}
                  disabled={!selectedUserId || isLoading}
                >
                  {isLoading ? 'Running Test...' : 'Start A/B Test'}
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}