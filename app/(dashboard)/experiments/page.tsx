// Experiment Management Dashboard
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { 
  Plus, 
  Search, 
  Filter, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  Users, 
  Target,
  BarChart3,
  PlayCircle,
  PauseCircle,
  StopCircle,
  Settings,
  Eye,
  AlertTriangle
} from 'lucide-react';
import { ExperimentBuilder } from '@/components/experiments/experiment-builder';
import { ResultsDashboard } from '@/components/experiments/results-dashboard';
import { StatisticalAnalyzer } from '@/components/experiments/statistical-analyzer';

interface Experiment {
  id: string;
  name: string;
  status: 'draft' | 'ready' | 'running' | 'paused' | 'completed' | 'archived';
  type: 'ab_test' | 'multivariate' | 'multi_armed_bandit';
  traffic_allocation: number;
  start_date?: Date;
  end_date?: Date;
  participants: number;
  conversion_rate: number;
  lift: number;
  confidence: number;
  is_significant: boolean;
  variants: number;
  created_at: Date;
}

export default function ExperimentsPage() {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [filteredExperiments, setFilteredExperiments] = useState<Experiment[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedExperiment, setSelectedExperiment] = useState<Experiment | null>(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [showAnalyzer, setShowAnalyzer] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadExperiments();
  }, []);

  useEffect(() => {
    filterExperiments();
  }, [experiments, searchQuery, statusFilter, typeFilter]);

  const loadExperiments = async () => {
    setLoading(true);
    try {
      // Simulate API call - replace with actual API
      const mockExperiments: Experiment[] = [
        {
          id: 'exp_001',
          name: 'Product Page CTA Button Color Test',
          status: 'running',
          type: 'ab_test',
          traffic_allocation: 100,
          start_date: new Date('2024-01-15'),
          participants: 2547,
          conversion_rate: 3.2,
          lift: 12.5,
          confidence: 95,
          is_significant: true,
          variants: 2,
          created_at: new Date('2024-01-10')
        },
        {
          id: 'exp_002',
          name: 'Email Subject Line Optimization',
          status: 'completed',
          type: 'multivariate',
          traffic_allocation: 50,
          start_date: new Date('2024-01-01'),
          end_date: new Date('2024-01-14'),
          participants: 5420,
          conversion_rate: 8.7,
          lift: 23.1,
          confidence: 99,
          is_significant: true,
          variants: 4,
          created_at: new Date('2023-12-28')
        },
        {
          id: 'exp_003',
          name: 'Pricing Display Strategy',
          status: 'draft',
          type: 'ab_test',
          traffic_allocation: 75,
          participants: 0,
          conversion_rate: 0,
          lift: 0,
          confidence: 0,
          is_significant: false,
          variants: 3,
          created_at: new Date('2024-01-18')
        },
        {
          id: 'exp_004',
          name: 'Checkout Flow Optimization',
          status: 'paused',
          type: 'multi_armed_bandit',
          traffic_allocation: 100,
          start_date: new Date('2024-01-12'),
          participants: 1205,
          conversion_rate: 2.8,
          lift: -5.2,
          confidence: 68,
          is_significant: false,
          variants: 3,
          created_at: new Date('2024-01-08')
        }
      ];
      
      setExperiments(mockExperiments);
    } catch (error) {
      console.error('Failed to load experiments:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterExperiments = () => {
    let filtered = experiments;

    if (searchQuery) {
      filtered = filtered.filter(exp =>
        exp.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(exp => exp.status === statusFilter);
    }

    if (typeFilter !== 'all') {
      filtered = filtered.filter(exp => exp.type === typeFilter);
    }

    setFilteredExperiments(filtered);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-green-100 text-green-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      case 'paused': return 'bg-yellow-100 text-yellow-800';
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'archived': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return <PlayCircle className="h-4 w-4" />;
      case 'completed': return <StopCircle className="h-4 w-4" />;
      case 'paused': return <PauseCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const handleExperimentAction = async (experimentId: string, action: 'start' | 'pause' | 'stop' | 'archive') => {
    try {
      // Implement API call to perform action
      console.log(`${action} experiment ${experimentId}`);
      await loadExperiments(); // Reload to get updated status
    } catch (error) {
      console.error(`Failed to ${action} experiment:`, error);
    }
  };

  const openExperimentResults = (experiment: Experiment) => {
    setSelectedExperiment(experiment);
    setShowResults(true);
  };

  const openStatisticalAnalyzer = (experiment: Experiment) => {
    setSelectedExperiment(experiment);
    setShowAnalyzer(true);
  };

  const getExperimentStats = () => {
    const running = experiments.filter(e => e.status === 'running').length;
    const completed = experiments.filter(e => e.status === 'completed').length;
    const significant = experiments.filter(e => e.is_significant).length;
    const avgLift = experiments.filter(e => e.lift > 0).reduce((acc, e) => acc + e.lift, 0) / 
                   Math.max(1, experiments.filter(e => e.lift > 0).length);

    return { running, completed, significant, avgLift };
  };

  const stats = getExperimentStats();

  if (loading) {
    return (
      <div className="p-6">
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                  <div className="h-8 bg-gray-200 rounded w-1/3"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
                  <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">A/B Testing</h1>
          <p className="text-gray-600">Manage and analyze your experiments</p>
        </div>
        <Dialog open={showBuilder} onOpenChange={setShowBuilder}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Experiment
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Experiment</DialogTitle>
            </DialogHeader>
            <ExperimentBuilder onSave={() => {
              setShowBuilder(false);
              loadExperiments();
            }} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Running Tests</p>
                <p className="text-2xl font-bold">{stats.running}</p>
              </div>
              <PlayCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Completed</p>
                <p className="text-2xl font-bold">{stats.completed}</p>
              </div>
              <StopCircle className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Significant Results</p>
                <p className="text-2xl font-bold">{stats.significant}</p>
              </div>
              <Target className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Lift</p>
                <p className="text-2xl font-bold">{stats.avgLift.toFixed(1)}%</p>
              </div>
              <TrendingUp className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search experiments..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="ready">Ready</SelectItem>
                <SelectItem value="running">Running</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="ab_test">A/B Test</SelectItem>
                <SelectItem value="multivariate">Multivariate</SelectItem>
                <SelectItem value="multi_armed_bandit">Multi-Armed Bandit</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Experiments List */}
      <div className="space-y-4">
        {filteredExperiments.map((experiment) => (
          <Card key={experiment.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold">{experiment.name}</h3>
                    <Badge className={getStatusColor(experiment.status)}>
                      {getStatusIcon(experiment.status)}
                      <span className="ml-1 capitalize">{experiment.status}</span>
                    </Badge>
                    <Badge variant="outline" className="capitalize">
                      {experiment.type.replace('_', ' ')}
                    </Badge>
                    {experiment.is_significant && (
                      <Badge className="bg-green-100 text-green-800">
                        <Target className="h-3 w-3 mr-1" />
                        Significant
                      </Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Participants</p>
                      <p className="font-medium flex items-center">
                        <Users className="h-4 w-4 mr-1" />
                        {experiment.participants.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">Conversion Rate</p>
                      <p className="font-medium">{experiment.conversion_rate}%</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Lift</p>
                      <p className={`font-medium flex items-center ${
                        experiment.lift > 0 ? 'text-green-600' : 
                        experiment.lift < 0 ? 'text-red-600' : 'text-gray-600'
                      }`}>
                        {experiment.lift > 0 ? <TrendingUp className="h-4 w-4 mr-1" /> : 
                         experiment.lift < 0 ? <TrendingDown className="h-4 w-4 mr-1" /> : null}
                        {experiment.lift > 0 ? '+' : ''}{experiment.lift}%
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">Confidence</p>
                      <p className="font-medium">{experiment.confidence}%</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Variants</p>
                      <p className="font-medium">{experiment.variants}</p>
                    </div>
                  </div>

                  {experiment.status === 'running' && (
                    <div className="mt-4">
                      <div className="flex justify-between items-center text-sm mb-1">
                        <span>Traffic Allocation</span>
                        <span>{experiment.traffic_allocation}%</span>
                      </div>
                      <Progress value={experiment.traffic_allocation} className="h-2" />
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2 ml-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openExperimentResults(experiment)}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    View Results
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openStatisticalAnalyzer(experiment)}
                  >
                    <BarChart3 className="h-4 w-4 mr-1" />
                    Analyze
                  </Button>

                  {experiment.status === 'running' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleExperimentAction(experiment.id, 'pause')}
                    >
                      <PauseCircle className="h-4 w-4 mr-1" />
                      Pause
                    </Button>
                  )}

                  {experiment.status === 'paused' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleExperimentAction(experiment.id, 'start')}
                    >
                      <PlayCircle className="h-4 w-4 mr-1" />
                      Resume
                    </Button>
                  )}

                  {(experiment.status === 'running' || experiment.status === 'paused') && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleExperimentAction(experiment.id, 'stop')}
                    >
                      <StopCircle className="h-4 w-4 mr-1" />
                      Stop
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {filteredExperiments.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No experiments found</h3>
              <p className="text-gray-600 mb-4">
                {searchQuery || statusFilter !== 'all' || typeFilter !== 'all'
                  ? 'Try adjusting your filters or search query.'
                  : 'Get started by creating your first experiment.'}
              </p>
              {!searchQuery && statusFilter === 'all' && typeFilter === 'all' && (
                <Button onClick={() => setShowBuilder(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Experiment
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Results Dialog */}
      <Dialog open={showResults} onOpenChange={setShowResults}>
        <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Experiment Results: {selectedExperiment?.name}
            </DialogTitle>
          </DialogHeader>
          {selectedExperiment && (
            <ResultsDashboard experimentId={selectedExperiment.id} />
          )}
        </DialogContent>
      </Dialog>

      {/* Statistical Analyzer Dialog */}
      <Dialog open={showAnalyzer} onOpenChange={setShowAnalyzer}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Statistical Analysis: {selectedExperiment?.name}
            </DialogTitle>
          </DialogHeader>
          {selectedExperiment && (
            <StatisticalAnalyzer experimentId={selectedExperiment.id} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}