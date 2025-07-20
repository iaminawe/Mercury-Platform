'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Play, 
  Square, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Clock,
  Brain,
  MessageSquare,
  Mail,
  Search,
  Settings,
  BarChart3
} from 'lucide-react';

interface TestSuite {
  id: string;
  name: string;
  service: 'advisor' | 'chatbot' | 'email_generator' | 'vector_search';
  description: string;
  testCount: number;
  estimatedTime: number;
  icon: React.ReactNode;
}

interface TestRun {
  id: string;
  suiteId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startTime?: Date;
  endTime?: Date;
  progress: number;
  currentTest?: string;
  results?: TestResults;
}

interface TestResults {
  passed: number;
  failed: number;
  warnings: number;
  accuracy: number;
  performance: {
    averageResponseTime: number;
    throughput: number;
  };
  details: TestDetail[];
}

interface TestDetail {
  id: string;
  name: string;
  status: 'passed' | 'failed' | 'warning';
  message: string;
  duration: number;
  accuracy?: number;
  expectedResult?: any;
  actualResult?: any;
}

const testSuites: TestSuite[] = [
  {
    id: 'advisor-accuracy',
    name: 'AI Advisor Accuracy Tests',
    service: 'advisor',
    description: 'Test recommendation accuracy, anomaly detection, and confidence scoring',
    testCount: 25,
    estimatedTime: 180, // seconds
    icon: <Brain className="h-5 w-5" />
  },
  {
    id: 'chatbot-resolution',
    name: 'Chatbot Auto-Resolution Tests',
    service: 'chatbot',
    description: 'Test intent classification, response quality, and auto-resolution rate',
    testCount: 40,
    estimatedTime: 150,
    icon: <MessageSquare className="h-5 w-5" />
  },
  {
    id: 'email-generation',
    name: 'Email Generation Quality Tests',
    service: 'email_generator',
    description: 'Test personalization, deliverability, and content quality',
    testCount: 20,
    estimatedTime: 120,
    icon: <Mail className="h-5 w-5" />
  },
  {
    id: 'vector-search',
    name: 'Vector Search Accuracy Tests',
    service: 'vector_search',
    description: 'Test search relevance, similarity scoring, and performance',
    testCount: 30,
    estimatedTime: 90,
    icon: <Search className="h-5 w-5" />
  },
  {
    id: 'performance-benchmarks',
    name: 'Performance Benchmark Tests',
    service: 'advisor', // Could span multiple services
    description: 'Test response times, throughput, and resource usage',
    testCount: 15,
    estimatedTime: 300,
    icon: <BarChart3 className="h-5 w-5" />
  },
  {
    id: 'integration-tests',
    name: 'Integration Test Suite',
    service: 'chatbot', // Multi-service
    description: 'Test cross-service interactions and end-to-end workflows',
    testCount: 12,
    estimatedTime: 240,
    icon: <Settings className="h-5 w-5" />
  }
];

const mockTestResults: Record<string, TestResults> = {
  'advisor-accuracy': {
    passed: 22,
    failed: 2,
    warnings: 1,
    accuracy: 0.873,
    performance: {
      averageResponseTime: 2400,
      throughput: 45
    },
    details: [
      {
        id: '1',
        name: 'Product Recommendation Accuracy',
        status: 'passed',
        message: 'Achieved 89.2% accuracy on product recommendation test suite',
        duration: 12500,
        accuracy: 0.892
      },
      {
        id: '2',
        name: 'Anomaly Detection Precision',
        status: 'passed',
        message: 'Successfully detected 95% of sales anomalies',
        duration: 8300,
        accuracy: 0.95
      },
      {
        id: '3',
        name: 'Confidence Score Calibration',
        status: 'warning',
        message: 'Confidence scores slightly overestimated for edge cases',
        duration: 5600,
        accuracy: 0.78
      },
      {
        id: '4',
        name: 'Response Time Under Load',
        status: 'failed',
        message: 'Response time exceeded 5s threshold under high load',
        duration: 15000,
        accuracy: 0.65
      }
    ]
  },
  'chatbot-resolution': {
    passed: 35,
    failed: 3,
    warnings: 2,
    accuracy: 0.734,
    performance: {
      averageResponseTime: 1200,
      throughput: 120
    },
    details: [
      {
        id: '1',
        name: 'Intent Classification Accuracy',
        status: 'passed',
        message: 'Intent classification achieved 87.3% accuracy',
        duration: 8500,
        accuracy: 0.873
      },
      {
        id: '2',
        name: 'Auto-Resolution Rate',
        status: 'passed',
        message: 'Auto-resolved 73.4% of customer queries',
        duration: 12000,
        accuracy: 0.734
      },
      {
        id: '3',
        name: 'Multilingual Support',
        status: 'warning',
        message: 'Lower accuracy for non-English languages',
        duration: 9800,
        accuracy: 0.68
      }
    ]
  }
};

export function TestRunner() {
  const [activeTestRuns, setActiveTestRuns] = useState<Map<string, TestRun>>(new Map());
  const [testHistory, setTestHistory] = useState<TestRun[]>([]);
  const [selectedSuite, setSelectedSuite] = useState<string | null>(null);

  useEffect(() => {
    // Load test history
    loadTestHistory();
  }, []);

  const loadTestHistory = async () => {
    try {
      // In a real implementation, this would fetch from an API
      // const response = await fetch('/api/testing/history');
      // const history = await response.json();
      // setTestHistory(history);
      
      // Mock data for now
      const mockHistory: TestRun[] = [
        {
          id: 'run-1',
          suiteId: 'advisor-accuracy',
          status: 'completed',
          startTime: new Date('2024-01-07T10:30:00'),
          endTime: new Date('2024-01-07T10:33:00'),
          progress: 100,
          results: mockTestResults['advisor-accuracy']
        },
        {
          id: 'run-2',
          suiteId: 'chatbot-resolution',
          status: 'completed',
          startTime: new Date('2024-01-07T09:15:00'),
          endTime: new Date('2024-01-07T09:17:30'),
          progress: 100,
          results: mockTestResults['chatbot-resolution']
        }
      ];
      setTestHistory(mockHistory);
    } catch (error) {
      console.error('Failed to load test history:', error);
    }
  };

  const runTest = async (suiteId: string) => {
    const testRun: TestRun = {
      id: `run-${Date.now()}`,
      suiteId,
      status: 'running',
      startTime: new Date(),
      progress: 0,
      currentTest: 'Initializing test suite...'
    };

    // Add to active test runs
    setActiveTestRuns(prev => new Map(prev.set(suiteId, testRun)));

    try {
      // Simulate test execution
      const suite = testSuites.find(s => s.id === suiteId);
      if (!suite) return;

      // Simulate progress updates
      for (let i = 0; i <= 100; i += 10) {
        await new Promise(resolve => setTimeout(resolve, suite.estimatedTime * 10)); // Simulate time
        
        const currentTestIndex = Math.floor((i / 100) * suite.testCount);
        const updatedRun: TestRun = {
          ...testRun,
          progress: i,
          currentTest: i < 100 ? `Running test ${currentTestIndex + 1} of ${suite.testCount}` : 'Completing...'
        };
        
        setActiveTestRuns(prev => new Map(prev.set(suiteId, updatedRun)));
      }

      // Complete the test
      const completedRun: TestRun = {
        ...testRun,
        status: 'completed',
        endTime: new Date(),
        progress: 100,
        results: mockTestResults[suiteId] || {
          passed: Math.floor(Math.random() * 20) + 15,
          failed: Math.floor(Math.random() * 5),
          warnings: Math.floor(Math.random() * 3),
          accuracy: 0.7 + Math.random() * 0.25,
          performance: {
            averageResponseTime: 1000 + Math.random() * 2000,
            throughput: 50 + Math.random() * 100
          },
          details: []
        }
      };

      setActiveTestRuns(prev => {
        const newMap = new Map(prev);
        newMap.delete(suiteId);
        return newMap;
      });
      
      setTestHistory(prev => [completedRun, ...prev]);

    } catch (error) {
      console.error('Test execution failed:', error);
      
      const failedRun: TestRun = {
        ...testRun,
        status: 'failed',
        endTime: new Date(),
        progress: 0
      };
      
      setActiveTestRuns(prev => {
        const newMap = new Map(prev);
        newMap.delete(suiteId);
        return newMap;
      });
      
      setTestHistory(prev => [failedRun, ...prev]);
    }
  };

  const cancelTest = (suiteId: string) => {
    const testRun = activeTestRuns.get(suiteId);
    if (testRun) {
      const cancelledRun: TestRun = {
        ...testRun,
        status: 'cancelled',
        endTime: new Date()
      };
      
      setActiveTestRuns(prev => {
        const newMap = new Map(prev);
        newMap.delete(suiteId);
        return newMap;
      });
      
      setTestHistory(prev => [cancelledRun, ...prev]);
    }
  };

  const runAllTests = async () => {
    for (const suite of testSuites) {
      if (!activeTestRuns.has(suite.id)) {
        await runTest(suite.id);
        // Add small delay between tests
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'running':
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'cancelled':
        return <Square className="h-4 w-4 text-gray-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      'passed': 'bg-green-100 text-green-800',
      'failed': 'bg-red-100 text-red-800',
      'warning': 'bg-yellow-100 text-yellow-800',
      'running': 'bg-blue-100 text-blue-800',
      'completed': 'bg-green-100 text-green-800',
      'cancelled': 'bg-gray-100 text-gray-800'
    };
    
    return (
      <Badge className={colors[status as keyof typeof colors] || colors.cancelled}>
        {status.toUpperCase()}
      </Badge>
    );
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Test Runner</h2>
          <p className="text-gray-600">Execute automated AI testing suites and view results</p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={runAllTests}
            disabled={activeTestRuns.size > 0}
            className="flex items-center gap-2"
          >
            <Play className="h-4 w-4" />
            Run All Tests
          </Button>
        </div>
      </div>

      <Tabs defaultValue="suites" className="space-y-6">
        <TabsList>
          <TabsTrigger value="suites">Test Suites</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="suites" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {testSuites.map((suite) => {
              const activeRun = activeTestRuns.get(suite.id);
              const isRunning = activeRun?.status === 'running';
              
              return (
                <Card key={suite.id} className={`transition-all ${isRunning ? 'ring-2 ring-blue-500' : ''}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {suite.icon}
                        <CardTitle className="text-lg">{suite.name}</CardTitle>
                      </div>
                      {isRunning && (
                        <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
                      )}
                    </div>
                    <CardDescription>{suite.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>{suite.testCount} tests</span>
                      <span>~{Math.ceil(suite.estimatedTime / 60)}min</span>
                    </div>
                    
                    {isRunning && activeRun && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Progress</span>
                          <span>{activeRun.progress}%</span>
                        </div>
                        <Progress value={activeRun.progress} className="h-2" />
                        <p className="text-xs text-gray-500">{activeRun.currentTest}</p>
                      </div>
                    )}
                    
                    <div className="flex gap-2">
                      <Button
                        onClick={() => runTest(suite.id)}
                        disabled={isRunning}
                        className="flex-1 flex items-center gap-2"
                        size="sm"
                      >
                        <Play className="h-3 w-3" />
                        {isRunning ? 'Running...' : 'Run Tests'}
                      </Button>
                      {isRunning && (
                        <Button
                          onClick={() => cancelTest(suite.id)}
                          variant="outline"
                          size="sm"
                          className="flex items-center gap-2"
                        >
                          <Square className="h-3 w-3" />
                          Cancel
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="results" className="space-y-4">
          {testHistory.filter(run => run.results).length === 0 ? (
            <Card>
              <CardContent className="flex items-center justify-center h-64 text-gray-500">
                <div className="text-center">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No test results available. Run some tests to see results here.</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {testHistory.filter(run => run.results).map((run) => {
                const suite = testSuites.find(s => s.id === run.suiteId);
                const results = run.results!;
                
                return (
                  <Card key={run.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {suite?.icon}
                          <div>
                            <CardTitle>{suite?.name}</CardTitle>
                            <CardDescription>
                              Completed {run.endTime?.toLocaleString()}
                            </CardDescription>
                          </div>
                        </div>
                        {getStatusIcon(run.status)}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div className="text-center p-4 bg-green-50 rounded-lg">
                          <p className="text-2xl font-bold text-green-600">{results.passed}</p>
                          <p className="text-sm text-green-700">Passed</p>
                        </div>
                        <div className="text-center p-4 bg-red-50 rounded-lg">
                          <p className="text-2xl font-bold text-red-600">{results.failed}</p>
                          <p className="text-sm text-red-700">Failed</p>
                        </div>
                        <div className="text-center p-4 bg-yellow-50 rounded-lg">
                          <p className="text-2xl font-bold text-yellow-600">{results.warnings}</p>
                          <p className="text-sm text-yellow-700">Warnings</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div className="text-center">
                          <p className="text-lg font-semibold">{(results.accuracy * 100).toFixed(1)}%</p>
                          <p className="text-sm text-gray-600">Accuracy</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-semibold">{results.performance.averageResponseTime}ms</p>
                          <p className="text-sm text-gray-600">Avg Response Time</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-semibold">{results.performance.throughput}</p>
                          <p className="text-sm text-gray-600">Requests/min</p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <h4 className="font-semibold">Test Details</h4>
                        {results.details.map((detail) => (
                          <div key={detail.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex items-center gap-3">
                              {getStatusIcon(detail.status)}
                              <div>
                                <p className="font-medium">{detail.name}</p>
                                <p className="text-sm text-gray-600">{detail.message}</p>
                              </div>
                            </div>
                            <div className="text-right text-sm">
                              <p className="font-medium">{formatDuration(detail.duration)}</p>
                              {detail.accuracy && (
                                <p className="text-gray-600">{(detail.accuracy * 100).toFixed(1)}% accuracy</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Test History</CardTitle>
              <CardDescription>All test executions and their outcomes</CardDescription>
            </CardHeader>
            <CardContent>
              {testHistory.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-gray-500">
                  <p>No test history available.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {testHistory.map((run) => {
                    const suite = testSuites.find(s => s.id === run.suiteId);
                    const duration = run.endTime && run.startTime 
                      ? run.endTime.getTime() - run.startTime.getTime()
                      : 0;
                    
                    return (
                      <div key={run.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-4">
                          {suite?.icon}
                          <div>
                            <p className="font-medium">{suite?.name}</p>
                            <p className="text-sm text-gray-600">
                              Started {run.startTime?.toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          {run.results && (
                            <div className="text-right text-sm">
                              <p className="font-medium">
                                {run.results.passed}/{run.results.passed + run.results.failed} passed
                              </p>
                              <p className="text-gray-600">{(run.results.accuracy * 100).toFixed(1)}% accuracy</p>
                            </div>
                          )}
                          <div className="text-right text-sm">
                            <p className="font-medium">{formatDuration(duration)}</p>
                            {getStatusBadge(run.status)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}