// Statistical Analysis Component
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Brain,
  Calculator,
  Target,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  XCircle,
  BarChart3,
  PieChart,
  Activity,
  Zap,
  Download,
  RefreshCw
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  ScatterChart,
  Scatter
} from 'recharts';

interface StatisticalAnalyzerProps {
  experimentId: string;
}

interface StatisticalAnalysis {
  experiment_info: {
    id: string;
    name: string;
    participants: number;
    duration_days: number;
    confidence_level: number;
  };
  frequentist_analysis: FrequentistAnalysis;
  bayesian_analysis: BayesianAnalysis;
  power_analysis: PowerAnalysis;
  sequential_analysis: SequentialAnalysis;
  multiple_comparisons: MultipleComparisons;
  sample_size_recommendations: SampleSizeRecommendations;
  effect_size_analysis: EffectSizeAnalysis;
  practical_significance: PracticalSignificance;
}

interface FrequentistAnalysis {
  variants: Array<{
    id: string;
    name: string;
    is_control: boolean;
    participants: number;
    conversions: number;
    conversion_rate: number;
    standard_error: number;
    confidence_interval: {
      lower: number;
      upper: number;
      confidence_level: number;
    };
  }>;
  tests: Array<{
    comparison: string;
    test_type: 'two_proportion_z_test' | 'chi_square' | 'fishers_exact';
    statistic: number;
    p_value: number;
    is_significant: boolean;
    effect_size: number;
    power: number;
  }>;
  overall_significance: {
    is_significant: boolean;
    alpha: number;
    corrected_alpha?: number;
  };
}

interface BayesianAnalysis {
  variants: Array<{
    id: string;
    name: string;
    posterior_parameters: {
      alpha: number;
      beta: number;
    };
    posterior_stats: {
      mean: number;
      std: number;
      credible_interval: {
        lower: number;
        upper: number;
        probability: number;
      };
    };
  }>;
  comparisons: Array<{
    treatment: string;
    control: string;
    probability_better: number;
    expected_lift: number;
    probability_practical_significance: number;
    risk_of_being_wrong: number;
  }>;
  decision_framework: {
    recommendation: 'continue' | 'stop_for_efficacy' | 'stop_for_futility' | 'inconclusive';
    confidence: number;
    rationale: string;
  };
}

interface PowerAnalysis {
  current_power: number;
  target_power: number;
  minimum_detectable_effect: {
    current: number;
    target: number;
  };
  sample_size: {
    current: number;
    required_for_target_power: number;
    additional_needed: number;
  };
  time_estimates: {
    days_to_target_power: number;
    days_to_significance_90_percent: number;
  };
  power_curve: Array<{
    effect_size: number;
    power: number;
  }>;
}

interface SequentialAnalysis {
  is_sequential_test: boolean;
  boundaries: {
    efficacy_boundary: number;
    futility_boundary: number;
    current_statistic: number;
  };
  interim_analyses: Array<{
    analysis_number: number;
    date: string;
    participants: number;
    test_statistic: number;
    p_value: number;
    decision: 'continue' | 'stop_efficacy' | 'stop_futility';
  }>;
  alpha_spending: {
    total_alpha: number;
    spent_alpha: number;
    remaining_alpha: number;
  };
  recommendations: {
    should_stop: boolean;
    reason: string;
    confidence: number;
  };
}

interface MultipleComparisons {
  correction_method: 'bonferroni' | 'benjamini_hochberg' | 'holm' | 'none';
  family_wise_error_rate: number;
  false_discovery_rate: number;
  adjusted_p_values: Array<{
    comparison: string;
    raw_p_value: number;
    adjusted_p_value: number;
    is_significant_raw: boolean;
    is_significant_adjusted: boolean;
  }>;
  recommendations: {
    should_adjust: boolean;
    recommended_method: string;
    impact_on_conclusions: string;
  };
}

interface SampleSizeRecommendations {
  current_analysis: {
    sample_size: number;
    power_achieved: number;
    mde_achieved: number;
  };
  recommendations: Array<{
    scenario: string;
    required_sample_size: number;
    additional_days: number;
    probability_of_significance: number;
    expected_lift_range: { min: number; max: number };
  }>;
  cost_benefit_analysis: {
    cost_per_additional_day: number;
    expected_value_increase: number;
    roi_of_continuing: number;
  };
}

interface EffectSizeAnalysis {
  cohens_h: number;
  interpretation: 'negligible' | 'small' | 'medium' | 'large';
  practical_significance_threshold: number;
  meets_practical_threshold: boolean;
  business_impact: {
    revenue_lift_estimate: number;
    conversion_improvement: number;
    statistical_vs_practical: string;
  };
}

interface PracticalSignificance {
  minimum_worthwhile_effect: number;
  current_effect: number;
  probability_exceeds_threshold: number;
  business_metrics: {
    estimated_annual_revenue_impact: number;
    cost_of_implementation: number;
    net_benefit: number;
    payback_period_days: number;
  };
  risk_assessment: {
    type_i_error_cost: number;
    type_ii_error_cost: number;
    expected_loss: number;
  };
}

export function StatisticalAnalyzer({ experimentId }: StatisticalAnalyzerProps) {
  const [analysis, setAnalysis] = useState<StatisticalAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [analysisType, setAnalysisType] = useState<'frequentist' | 'bayesian'>('frequentist');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadAnalysis();
  }, [experimentId]);

  const loadAnalysis = async () => {
    setLoading(true);
    try {
      // Simulate API call - replace with actual API
      const mockAnalysis: StatisticalAnalysis = {
        experiment_info: {
          id: experimentId,
          name: 'Product Page CTA Button Test',
          participants: 2547,
          duration_days: 14,
          confidence_level: 95
        },
        frequentist_analysis: {
          variants: [
            {
              id: 'control',
              name: 'Control (Blue Button)',
              is_control: true,
              participants: 1274,
              conversions: 35,
              conversion_rate: 2.75,
              standard_error: 0.46,
              confidence_interval: {
                lower: 1.9,
                upper: 3.6,
                confidence_level: 95
              }
            },
            {
              id: 'treatment',
              name: 'Treatment (Orange Button)',
              is_control: false,
              participants: 1273,
              conversions: 42,
              conversion_rate: 3.3,
              standard_error: 0.51,
              confidence_interval: {
                lower: 2.4,
                upper: 4.2,
                confidence_level: 95
              }
            }
          ],
          tests: [
            {
              comparison: 'Treatment vs Control',
              test_type: 'two_proportion_z_test',
              statistic: 2.12,
              p_value: 0.034,
              is_significant: true,
              effect_size: 0.28,
              power: 76.5
            }
          ],
          overall_significance: {
            is_significant: true,
            alpha: 0.05
          }
        },
        bayesian_analysis: {
          variants: [
            {
              id: 'control',
              name: 'Control (Blue Button)',
              posterior_parameters: {
                alpha: 36,
                beta: 1240
              },
              posterior_stats: {
                mean: 2.82,
                std: 0.47,
                credible_interval: {
                  lower: 2.0,
                  upper: 3.8,
                  probability: 95
                }
              }
            },
            {
              id: 'treatment',
              name: 'Treatment (Orange Button)',
              posterior_parameters: {
                alpha: 43,
                beta: 1232
              },
              posterior_stats: {
                mean: 3.37,
                std: 0.52,
                credible_interval: {
                  lower: 2.5,
                  upper: 4.4,
                  probability: 95
                }
              }
            }
          ],
          comparisons: [
            {
              treatment: 'treatment',
              control: 'control',
              probability_better: 87.3,
              expected_lift: 19.5,
              probability_practical_significance: 73.2,
              risk_of_being_wrong: 12.7
            }
          ],
          decision_framework: {
            recommendation: 'continue',
            confidence: 0.73,
            rationale: 'Strong evidence for treatment effectiveness, but consider running longer for higher confidence.'
          }
        },
        power_analysis: {
          current_power: 76.5,
          target_power: 80,
          minimum_detectable_effect: {
            current: 1.2,
            target: 1.0
          },
          sample_size: {
            current: 2547,
            required_for_target_power: 3200,
            additional_needed: 653
          },
          time_estimates: {
            days_to_target_power: 8,
            days_to_significance_90_percent: 12
          },
          power_curve: Array.from({ length: 20 }, (_, i) => ({
            effect_size: (i + 1) * 0.1,
            power: Math.min(100, 20 + (i + 1) * 4)
          }))
        },
        sequential_analysis: {
          is_sequential_test: true,
          boundaries: {
            efficacy_boundary: 2.8,
            futility_boundary: 0.5,
            current_statistic: 2.12
          },
          interim_analyses: [
            {
              analysis_number: 1,
              date: '2024-01-20',
              participants: 1200,
              test_statistic: 1.45,
              p_value: 0.147,
              decision: 'continue'
            },
            {
              analysis_number: 2,
              date: '2024-01-25',
              participants: 2000,
              test_statistic: 1.89,
              p_value: 0.059,
              decision: 'continue'
            },
            {
              analysis_number: 3,
              date: '2024-01-29',
              participants: 2547,
              test_statistic: 2.12,
              p_value: 0.034,
              decision: 'continue'
            }
          ],
          alpha_spending: {
            total_alpha: 0.05,
            spent_alpha: 0.023,
            remaining_alpha: 0.027
          },
          recommendations: {
            should_stop: false,
            reason: 'Test statistic approaching efficacy boundary but not quite there yet',
            confidence: 0.78
          }
        },
        multiple_comparisons: {
          correction_method: 'benjamini_hochberg',
          family_wise_error_rate: 0.05,
          false_discovery_rate: 0.05,
          adjusted_p_values: [
            {
              comparison: 'Treatment vs Control',
              raw_p_value: 0.034,
              adjusted_p_value: 0.034,
              is_significant_raw: true,
              is_significant_adjusted: true
            }
          ],
          recommendations: {
            should_adjust: false,
            recommended_method: 'None (single comparison)',
            impact_on_conclusions: 'No impact - only one primary comparison'
          }
        },
        sample_size_recommendations: {
          current_analysis: {
            sample_size: 2547,
            power_achieved: 76.5,
            mde_achieved: 1.2
          },
          recommendations: [
            {
              scenario: 'Achieve 80% power',
              required_sample_size: 3200,
              additional_days: 8,
              probability_of_significance: 0.85,
              expected_lift_range: { min: 15, max: 25 }
            },
            {
              scenario: 'Achieve 90% power',
              required_sample_size: 4500,
              additional_days: 22,
              probability_of_significance: 0.92,
              expected_lift_range: { min: 18, max: 22 }
            }
          ],
          cost_benefit_analysis: {
            cost_per_additional_day: 500,
            expected_value_increase: 2500,
            roi_of_continuing: 400
          }
        },
        effect_size_analysis: {
          cohens_h: 0.28,
          interpretation: 'small',
          practical_significance_threshold: 0.2,
          meets_practical_threshold: true,
          business_impact: {
            revenue_lift_estimate: 8500,
            conversion_improvement: 0.55,
            statistical_vs_practical: 'Both statistically and practically significant'
          }
        },
        practical_significance: {
          minimum_worthwhile_effect: 5.0,
          current_effect: 20.0,
          probability_exceeds_threshold: 87.3,
          business_metrics: {
            estimated_annual_revenue_impact: 125000,
            cost_of_implementation: 8000,
            net_benefit: 117000,
            payback_period_days: 23
          },
          risk_assessment: {
            type_i_error_cost: 15000,
            type_ii_error_cost: 50000,
            expected_loss: 6750
          }
        }
      };

      setAnalysis(mockAnalysis);
    } catch (error) {
      console.error('Failed to load statistical analysis:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshAnalysis = async () => {
    setRefreshing(true);
    await loadAnalysis();
    setRefreshing(false);
  };

  if (loading || !analysis) {
    return (
      <div className="space-y-6">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
                <div className="h-32 bg-gray-200 rounded"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const currentAnalysis = analysisType === 'frequentist' ? analysis.frequentist_analysis : analysis.bayesian_analysis;

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold">Statistical Analysis</h2>
          <Badge variant="outline">{analysis.experiment_info.participants.toLocaleString()} participants</Badge>
          <Badge variant="outline">{analysis.experiment_info.duration_days} days</Badge>
        </div>
        
        <div className="flex items-center gap-2">
          <Select value={analysisType} onValueChange={(value: any) => setAnalysisType(value)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="frequentist">Frequentist</SelectItem>
              <SelectItem value="bayesian">Bayesian</SelectItem>
            </SelectContent>
          </Select>
          
          <Button variant="outline" onClick={refreshAnalysis} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Analysis Type Toggle */}
      <Tabs value={analysisType} onValueChange={(value: any) => setAnalysisType(value)} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="frequentist">Frequentist Analysis</TabsTrigger>
          <TabsTrigger value="bayesian">Bayesian Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="frequentist" className="space-y-6">
          {/* Frequentist Results */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  Statistical Tests
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analysis.frequentist_analysis.tests.map((test, index) => (
                    <div key={index} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium">{test.comparison}</h4>
                        {test.is_significant ? (
                          <Badge className="bg-green-100 text-green-800">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Significant
                          </Badge>
                        ) : (
                          <Badge variant="outline">
                            <XCircle className="h-3 w-3 mr-1" />
                            Not Significant
                          </Badge>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-gray-600">Test Statistic</p>
                          <p className="font-medium">{test.statistic.toFixed(3)}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">P-value</p>
                          <p className="font-medium">{test.p_value.toFixed(4)}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Effect Size</p>
                          <p className="font-medium">{test.effect_size.toFixed(3)}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Power</p>
                          <p className="font-medium">{test.power.toFixed(1)}%</p>
                        </div>
                      </div>
                      
                      <div className="mt-3 text-xs text-gray-600">
                        Test: {test.test_type.replace(/_/g, ' ')}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Confidence Intervals
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analysis.frequentist_analysis.variants.map((variant) => (
                    <div key={variant.id} className="p-4 border rounded-lg">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-lg">{variant.is_control ? '🔵' : '🟠'}</span>
                        <h4 className="font-medium">{variant.name}</h4>
                        {variant.is_control && <Badge variant="outline">Control</Badge>}
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Conversion Rate:</span>
                          <span className="font-medium">{variant.conversion_rate.toFixed(2)}%</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Standard Error:</span>
                          <span className="font-medium">{variant.standard_error.toFixed(3)}</span>
                        </div>
                        <div className="text-sm">
                          <span className="text-gray-600">
                            {variant.confidence_interval.confidence_level}% CI:
                          </span>
                          <span className="font-medium ml-2">
                            [{variant.confidence_interval.lower.toFixed(2)}%, {variant.confidence_interval.upper.toFixed(2)}%]
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="bayesian" className="space-y-6">
          {/* Bayesian Results */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5" />
                  Posterior Distributions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analysis.bayesian_analysis.variants.map((variant) => (
                    <div key={variant.id} className="p-4 border rounded-lg">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-lg">{variant.id === 'control' ? '🔵' : '🟠'}</span>
                        <h4 className="font-medium">{variant.name}</h4>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-gray-600">Posterior Mean</p>
                          <p className="font-medium">{variant.posterior_stats.mean.toFixed(2)}%</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Posterior Std</p>
                          <p className="font-medium">{variant.posterior_stats.std.toFixed(3)}</p>
                        </div>
                      </div>
                      
                      <div className="mt-3 text-sm">
                        <span className="text-gray-600">
                          {variant.posterior_stats.credible_interval.probability}% Credible Interval:
                        </span>
                        <span className="font-medium ml-2">
                          [{variant.posterior_stats.credible_interval.lower.toFixed(2)}%, {variant.posterior_stats.credible_interval.upper.toFixed(2)}%]
                        </span>
                      </div>
                      
                      <div className="mt-2 text-xs text-gray-500">
                        Beta({variant.posterior_parameters.alpha}, {variant.posterior_parameters.beta})
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Bayesian Comparisons
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analysis.bayesian_analysis.comparisons.map((comparison, index) => (
                    <div key={index} className="p-4 border rounded-lg">
                      <h4 className="font-medium mb-3">Treatment vs Control</h4>
                      
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Probability Treatment Better:</span>
                          <span className="font-medium text-green-600">
                            {comparison.probability_better.toFixed(1)}%
                          </span>
                        </div>
                        
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Expected Lift:</span>
                          <span className="font-medium">+{comparison.expected_lift.toFixed(1)}%</span>
                        </div>
                        
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Prob. Practical Significance:</span>
                          <span className="font-medium">{comparison.probability_practical_significance.toFixed(1)}%</span>
                        </div>
                        
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Risk of Being Wrong:</span>
                          <span className="font-medium text-red-600">
                            {comparison.risk_of_being_wrong.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <h5 className="font-medium mb-2">Decision Framework</h5>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className="capitalize">{analysis.bayesian_analysis.decision_framework.recommendation}</Badge>
                      <span className="text-sm text-gray-600">
                        {(analysis.bayesian_analysis.decision_framework.confidence * 100).toFixed(0)}% confidence
                      </span>
                    </div>
                    <p className="text-sm text-gray-700">{analysis.bayesian_analysis.decision_framework.rationale}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Power Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Power Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-gray-600">Current Power</p>
                  <p className="text-2xl font-bold">{analysis.power_analysis.current_power.toFixed(1)}%</p>
                  <Progress value={analysis.power_analysis.current_power} className="mt-2" />
                </div>
                
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-gray-600">Target Power</p>
                  <p className="text-2xl font-bold">{analysis.power_analysis.target_power}%</p>
                  <p className="text-xs text-gray-500">Industry standard</p>
                </div>
              </div>
              
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium mb-3">Sample Size Requirements</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Current:</span>
                    <span className="font-medium">{analysis.power_analysis.sample_size.current.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Required for 80% power:</span>
                    <span className="font-medium">{analysis.power_analysis.sample_size.required_for_target_power.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Additional needed:</span>
                    <span className="font-medium text-blue-600">{analysis.power_analysis.sample_size.additional_needed.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Days to target power:</span>
                    <span className="font-medium">{analysis.power_analysis.time_estimates.days_to_target_power} days</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="font-medium mb-3">Power Curve</h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analysis.power_analysis.power_curve}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="effect_size" label={{ value: 'Effect Size', position: 'insideBottom', offset: -5 }} />
                    <YAxis label={{ value: 'Power (%)', angle: -90, position: 'insideLeft' }} />
                    <Tooltip />
                    <Line 
                      type="monotone" 
                      dataKey="power" 
                      stroke="#3B82F6" 
                      strokeWidth={2}
                      dot={{ fill: '#3B82F6' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sequential Analysis */}
      {analysis.sequential_analysis.is_sequential_test && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Sequential Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-3">Current Status</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Test Statistic:</span>
                      <span className="font-medium">{analysis.sequential_analysis.boundaries.current_statistic.toFixed(3)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Efficacy Boundary:</span>
                      <span className="font-medium">{analysis.sequential_analysis.boundaries.efficacy_boundary.toFixed(3)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Futility Boundary:</span>
                      <span className="font-medium">{analysis.sequential_analysis.boundaries.futility_boundary.toFixed(3)}</span>
                    </div>
                  </div>
                  
                  <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className="h-4 w-4 text-yellow-600" />
                      <span className="font-medium text-yellow-800">Recommendation</span>
                    </div>
                    <p className="text-sm text-yellow-700">{analysis.sequential_analysis.recommendations.reason}</p>
                    <p className="text-xs text-yellow-600 mt-1">
                      Confidence: {(analysis.sequential_analysis.recommendations.confidence * 100).toFixed(0)}%
                    </p>
                  </div>
                </div>
                
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-3">Alpha Spending</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total α:</span>
                      <span className="font-medium">{analysis.sequential_analysis.alpha_spending.total_alpha.toFixed(3)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Spent α:</span>
                      <span className="font-medium">{analysis.sequential_analysis.alpha_spending.spent_alpha.toFixed(3)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Remaining α:</span>
                      <span className="font-medium">{analysis.sequential_analysis.alpha_spending.remaining_alpha.toFixed(3)}</span>
                    </div>
                  </div>
                  <Progress 
                    value={(analysis.sequential_analysis.alpha_spending.spent_alpha / analysis.sequential_analysis.alpha_spending.total_alpha) * 100} 
                    className="mt-3" 
                  />
                </div>
              </div>
              
              <div>
                <h4 className="font-medium mb-3">Interim Analyses History</h4>
                <div className="space-y-3">
                  {analysis.sequential_analysis.interim_analyses.map((interim) => (
                    <div key={interim.analysis_number} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">Analysis #{interim.analysis_number}</span>
                        <Badge variant="outline" className="capitalize">{interim.decision.replace('_', ' ')}</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                        <div>Date: {interim.date}</div>
                        <div>N: {interim.participants.toLocaleString()}</div>
                        <div>Statistic: {interim.test_statistic.toFixed(3)}</div>
                        <div>p-value: {interim.p_value.toFixed(4)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Effect Size & Practical Significance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Effect Size Analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 border rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600">Cohen's h:</span>
                <span className="text-2xl font-bold">{analysis.effect_size_analysis.cohens_h.toFixed(3)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="capitalize">{analysis.effect_size_analysis.interpretation}</Badge>
                {analysis.effect_size_analysis.meets_practical_threshold && (
                  <Badge className="bg-green-100 text-green-800">Practical</Badge>
                )}
              </div>
            </div>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Practical Threshold:</span>
                <span className="font-medium">{analysis.effect_size_analysis.practical_significance_threshold.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Revenue Lift:</span>
                <span className="font-medium text-green-600">
                  ${analysis.effect_size_analysis.business_impact.revenue_lift_estimate.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Conversion Improvement:</span>
                <span className="font-medium">+{analysis.effect_size_analysis.business_impact.conversion_improvement.toFixed(2)}%</span>
              </div>
            </div>
            
            <div className="p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">{analysis.effect_size_analysis.business_impact.statistical_vs_practical}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Business Impact
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 border rounded-lg text-center">
                <p className="text-xs text-gray-600">Annual Revenue Impact</p>
                <p className="text-lg font-bold text-green-600">
                  ${analysis.practical_significance.business_metrics.estimated_annual_revenue_impact.toLocaleString()}
                </p>
              </div>
              
              <div className="p-3 border rounded-lg text-center">
                <p className="text-xs text-gray-600">Implementation Cost</p>
                <p className="text-lg font-bold">
                  ${analysis.practical_significance.business_metrics.cost_of_implementation.toLocaleString()}
                </p>
              </div>
            </div>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Net Benefit:</span>
                <span className="font-medium text-green-600">
                  ${analysis.practical_significance.business_metrics.net_benefit.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Payback Period:</span>
                <span className="font-medium">{analysis.practical_significance.business_metrics.payback_period_days} days</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Prob. Exceeds Threshold:</span>
                <span className="font-medium">{analysis.practical_significance.probability_exceeds_threshold.toFixed(1)}%</span>
              </div>
            </div>
            
            <div className="p-3 bg-green-50 rounded-lg">
              <h5 className="font-medium text-green-800 mb-1">Risk Assessment</h5>
              <p className="text-xs text-green-700">
                Expected loss from wrong decision: ${analysis.practical_significance.risk_assessment.expected_loss.toLocaleString()}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sample Size Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Sample Size Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              {analysis.sample_size_recommendations.recommendations.map((rec, index) => (
                <div key={index} className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-3">{rec.scenario}</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Sample Size</p>
                      <p className="font-medium">{rec.required_sample_size.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Additional Days</p>
                      <p className="font-medium">{rec.additional_days}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Prob. Significance</p>
                      <p className="font-medium">{(rec.probability_of_significance * 100).toFixed(0)}%</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Expected Lift</p>
                      <p className="font-medium">{rec.expected_lift_range.min}-{rec.expected_lift_range.max}%</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-3">Cost-Benefit Analysis</h4>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Cost per Day:</span>
                  <span className="font-medium">${analysis.sample_size_recommendations.cost_benefit_analysis.cost_per_additional_day}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Expected Value Increase:</span>
                  <span className="font-medium text-green-600">
                    ${analysis.sample_size_recommendations.cost_benefit_analysis.expected_value_increase}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">ROI of Continuing:</span>
                  <span className="font-medium text-green-600">
                    {analysis.sample_size_recommendations.cost_benefit_analysis.roi_of_continuing}%
                  </span>
                </div>
              </div>
              
              <div className="mt-4 p-3 bg-green-50 rounded-lg">
                <p className="text-sm text-green-800">
                  <strong>Recommendation:</strong> Continue the experiment for additional {analysis.power_analysis.time_estimates.days_to_target_power} days 
                  to achieve {analysis.power_analysis.target_power}% statistical power.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}