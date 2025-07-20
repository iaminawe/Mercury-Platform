'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Activity,
  Users,
  Lock,
  Eye,
  TrendingUp,
  Database,
  Server,
  Wifi,
  AlertCircle
} from 'lucide-react';

interface SecurityMetrics {
  overallScore: number;
  threatLevel: 'low' | 'medium' | 'high' | 'critical';
  activeThreats: number;
  blockedAttacks: number;
  complianceScore: number;
  lastScanDate: string;
}

interface ThreatEvent {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  source: string;
  timestamp: Date;
  status: 'detected' | 'blocked' | 'investigating';
  description: string;
}

interface ComplianceStatus {
  framework: string;
  status: 'compliant' | 'non_compliant' | 'partial';
  score: number;
  lastAssessment: Date;
  requirements: {
    total: number;
    met: number;
    pending: number;
  };
}

const SecurityDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<SecurityMetrics>({
    overallScore: 94,
    threatLevel: 'low',
    activeThreats: 0,
    blockedAttacks: 247,
    complianceScore: 96,
    lastScanDate: '2025-01-18T10:30:00Z'
  });

  const [threats, setThreats] = useState<ThreatEvent[]>([
    {
      id: '1',
      type: 'Brute Force Attack',
      severity: 'medium',
      source: '192.168.1.100',
      timestamp: new Date(),
      status: 'blocked',
      description: 'Multiple failed login attempts detected from suspicious IP'
    },
    {
      id: '2',
      type: 'SQL Injection Attempt',
      severity: 'high',
      source: '10.0.1.55',
      timestamp: new Date(Date.now() - 3600000),
      status: 'blocked',
      description: 'Malicious SQL query blocked by WAF'
    }
  ]);

  const [compliance, setCompliance] = useState<ComplianceStatus[]>([
    {
      framework: 'SOC 2 Type II',
      status: 'compliant',
      score: 98,
      lastAssessment: new Date(),
      requirements: { total: 64, met: 63, pending: 1 }
    },
    {
      framework: 'GDPR',
      status: 'compliant',
      score: 95,
      lastAssessment: new Date(),
      requirements: { total: 28, met: 27, pending: 1 }
    },
    {
      framework: 'PCI DSS',
      status: 'partial',
      score: 87,
      lastAssessment: new Date(),
      requirements: { total: 12, met: 10, pending: 2 }
    }
  ]);

  const getThreatLevelColor = (level: string) => {
    switch (level) {
      case 'low': return 'text-green-600';
      case 'medium': return 'text-yellow-600';
      case 'high': return 'text-orange-600';
      case 'critical': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getThreatLevelIcon = (level: string) => {
    switch (level) {
      case 'low': return <CheckCircle className="h-4 w-4" />;
      case 'medium': return <AlertTriangle className="h-4 w-4" />;
      case 'high': return <AlertCircle className="h-4 w-4" />;
      case 'critical': return <XCircle className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  const getComplianceStatusColor = (status: string) => {
    switch (status) {
      case 'compliant': return 'bg-green-100 text-green-800';
      case 'partial': return 'bg-yellow-100 text-yellow-800';
      case 'non_compliant': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Security Dashboard</h1>
            <p className="text-gray-500 mt-1">Monitor and manage enterprise security</p>
          </div>
          <div className="flex space-x-3">
            <Button variant="outline">
              <Shield className="h-4 w-4 mr-2" />
              Run Security Scan
            </Button>
            <Button>
              <Eye className="h-4 w-4 mr-2" />
              View All Logs
            </Button>
          </div>
        </div>

        {/* Security Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Security Score</CardTitle>
              <Shield className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{metrics.overallScore}%</div>
              <div className="flex items-center mt-2">
                <Progress value={metrics.overallScore} className="flex-1" />
                <span className="ml-2 text-sm text-green-600">Excellent</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Threat Level</CardTitle>
              {getThreatLevelIcon(metrics.threatLevel)}
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold capitalize ${getThreatLevelColor(metrics.threatLevel)}`}>
                {metrics.threatLevel}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {metrics.activeThreats} active threats
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Attacks Blocked</CardTitle>
              <Shield className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{metrics.blockedAttacks.toLocaleString()}</div>
              <p className="text-xs text-gray-500 mt-1">
                <TrendingUp className="h-3 w-3 inline mr-1" />
                +12% from last week
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Compliance Score</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{metrics.complianceScore}%</div>
              <p className="text-xs text-gray-500 mt-1">
                3 frameworks monitored
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="threats" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="threats">Threat Detection</TabsTrigger>
            <TabsTrigger value="compliance">Compliance</TabsTrigger>
            <TabsTrigger value="access">Access Control</TabsTrigger>
            <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
          </TabsList>

          {/* Threat Detection Tab */}
          <TabsContent value="threats" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Real-time Threats */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <AlertTriangle className="h-5 w-5 mr-2 text-orange-600" />
                    Real-time Threats
                  </CardTitle>
                  <CardDescription>
                    Active security events and blocked attacks
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {threats.map((threat) => (
                    <div key={threat.id} className="flex items-start space-x-3 p-3 border rounded-lg">
                      <div className={`p-1 rounded-full ${
                        threat.severity === 'high' ? 'bg-red-100' : 
                        threat.severity === 'medium' ? 'bg-yellow-100' : 'bg-green-100'
                      }`}>
                        {getThreatLevelIcon(threat.severity)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-gray-900">{threat.type}</p>
                          <Badge variant={threat.status === 'blocked' ? 'secondary' : 'destructive'}>
                            {threat.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-500">{threat.description}</p>
                        <div className="flex items-center space-x-4 mt-1 text-xs text-gray-400">
                          <span>Source: {threat.source}</span>
                          <span>{threat.timestamp.toLocaleTimeString()}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {threats.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <Shield className="h-12 w-12 mx-auto mb-3 text-green-600" />
                      <p>No active threats detected</p>
                      <p className="text-sm">Your system is secure</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Security Analytics */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Activity className="h-5 w-5 mr-2 text-blue-600" />
                    Security Analytics
                  </CardTitle>
                  <CardDescription>
                    Security metrics and patterns
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Login Success Rate</span>
                      <div className="flex items-center space-x-2">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div className="bg-green-600 h-2 rounded-full" style={{ width: '96%' }}></div>
                        </div>
                        <span className="text-sm font-medium">96%</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">API Security Score</span>
                      <div className="flex items-center space-x-2">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div className="bg-blue-600 h-2 rounded-full" style={{ width: '92%' }}></div>
                        </div>
                        <span className="text-sm font-medium">92%</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Data Encryption</span>
                      <div className="flex items-center space-x-2">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div className="bg-green-600 h-2 rounded-full" style={{ width: '100%' }}></div>
                        </div>
                        <span className="text-sm font-medium">100%</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Network Security</span>
                      <div className="flex items-center space-x-2">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div className="bg-yellow-600 h-2 rounded-full" style={{ width: '87%' }}></div>
                        </div>
                        <span className="text-sm font-medium">87%</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Security Alerts */}
            <Card>
              <CardHeader>
                <CardTitle>Security Recommendations</CardTitle>
                <CardDescription>
                  Actionable security improvements
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Medium Priority</AlertTitle>
                  <AlertDescription>
                    Consider enabling two-factor authentication for all admin users. 
                    Currently 78% of admin accounts have 2FA enabled.
                  </AlertDescription>
                </Alert>
                
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Low Priority</AlertTitle>
                  <AlertDescription>
                    Update password policy to require special characters. This will improve 
                    overall account security by 15%.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Compliance Tab */}
          <TabsContent value="compliance" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {compliance.map((framework) => (
                <Card key={framework.framework}>
                  <CardHeader>
                    <CardTitle className="text-lg">{framework.framework}</CardTitle>
                    <CardDescription>
                      Last assessed {framework.lastAssessment.toLocaleDateString()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-2xl font-bold">{framework.score}%</span>
                      <Badge className={getComplianceStatusColor(framework.status)}>
                        {framework.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    
                    <Progress value={framework.score} className="w-full" />
                    
                    <div className="grid grid-cols-3 gap-2 text-center text-sm">
                      <div>
                        <div className="font-semibold text-green-600">{framework.requirements.met}</div>
                        <div className="text-gray-500">Met</div>
                      </div>
                      <div>
                        <div className="font-semibold text-yellow-600">{framework.requirements.pending}</div>
                        <div className="text-gray-500">Pending</div>
                      </div>
                      <div>
                        <div className="font-semibold text-gray-600">{framework.requirements.total}</div>
                        <div className="text-gray-500">Total</div>
                      </div>
                    </div>
                    
                    <Button variant="outline" size="sm" className="w-full">
                      View Details
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Compliance Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Required Actions</CardTitle>
                <CardDescription>
                  Items that need attention to maintain compliance
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-start space-x-3 p-3 border rounded-lg">
                    <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                    <div className="flex-1">
                      <div className="font-medium">Update Data Retention Policy</div>
                      <div className="text-sm text-gray-600">
                        GDPR requires explicit data retention periods. Current policy needs review.
                      </div>
                      <div className="mt-2">
                        <Badge variant="outline">Due in 7 days</Badge>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3 p-3 border rounded-lg">
                    <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5" />
                    <div className="flex-1">
                      <div className="font-medium">Security Training Completion</div>
                      <div className="text-sm text-gray-600">
                        SOC 2 requires annual security training. 3 employees pending completion.
                      </div>
                      <div className="mt-2">
                        <Badge variant="outline">Due in 14 days</Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Access Control Tab */}
          <TabsContent value="access" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Users className="h-5 w-5 mr-2 text-blue-600" />
                    User Access Overview
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Total Users</span>
                    <span className="text-lg font-semibold">1,247</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Admin Users</span>
                    <span className="text-lg font-semibold">23</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Active Sessions</span>
                    <span className="text-lg font-semibold">892</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">2FA Enabled</span>
                    <span className="text-lg font-semibold text-green-600">94%</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Lock className="h-5 w-5 mr-2 text-green-600" />
                    Permission Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Role-based Access</span>
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Least Privilege</span>
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Regular Reviews</span>
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Audit Logging</span>
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Monitoring Tab */}
          <TabsContent value="monitoring" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Server className="h-5 w-5 mr-2 text-blue-600" />
                    Infrastructure
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">System Health</span>
                    <Badge className="bg-green-100 text-green-800">Healthy</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">CPU Usage</span>
                    <span className="text-sm font-medium">23%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Memory Usage</span>
                    <span className="text-sm font-medium">67%</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Database className="h-5 w-5 mr-2 text-purple-600" />
                    Database Security
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Encryption</span>
                    <Badge className="bg-green-100 text-green-800">Active</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Backup Status</span>
                    <Badge className="bg-green-100 text-green-800">Current</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Access Logs</span>
                    <Badge className="bg-green-100 text-green-800">Enabled</Badge>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Wifi className="h-5 w-5 mr-2 text-orange-600" />
                    Network Security
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Firewall</span>
                    <Badge className="bg-green-100 text-green-800">Active</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">DDoS Protection</span>
                    <Badge className="bg-green-100 text-green-800">Enabled</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">SSL/TLS</span>
                    <Badge className="bg-green-100 text-green-800">Valid</Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default SecurityDashboard;