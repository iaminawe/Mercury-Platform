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
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  FileText,
  Calendar,
  Download,
  Settings,
  Users,
  Lock,
  Database,
  Globe,
  Clock,
  BarChart3
} from 'lucide-react';

interface ComplianceFramework {
  id: string;
  name: string;
  description: string;
  status: 'compliant' | 'partial' | 'non_compliant';
  score: number;
  requirements: {
    total: number;
    met: number;
    inProgress: number;
    overdue: number;
  };
  lastAssessment: Date;
  nextAssessment: Date;
  certificationDate?: Date;
  expiryDate?: Date;
}

interface ComplianceRequirement {
  id: string;
  framework: string;
  category: string;
  title: string;
  description: string;
  status: 'met' | 'in_progress' | 'overdue' | 'not_started';
  priority: 'high' | 'medium' | 'low';
  assignee: string;
  dueDate: Date;
  evidence: Array<{
    type: 'document' | 'procedure' | 'control';
    name: string;
    description: string;
    status: 'verified' | 'pending' | 'missing';
  }>;
  lastReview: Date;
}

interface AuditEvent {
  id: string;
  timestamp: Date;
  framework: string;
  event: string;
  user: string;
  details: string;
  outcome: 'pass' | 'fail' | 'partial';
}

const ComplianceDashboard: React.FC = () => {
  const [frameworks, setFrameworks] = useState<ComplianceFramework[]>([
    {
      id: 'soc2',
      name: 'SOC 2 Type II',
      description: 'Service Organization Control 2 Type II compliance for security, availability, processing integrity, confidentiality, and privacy.',
      status: 'compliant',
      score: 96,
      requirements: { total: 64, met: 62, inProgress: 2, overdue: 0 },
      lastAssessment: new Date('2024-12-15'),
      nextAssessment: new Date('2025-06-15'),
      certificationDate: new Date('2024-12-20'),
      expiryDate: new Date('2025-12-20')
    },
    {
      id: 'gdpr',
      name: 'GDPR',
      description: 'General Data Protection Regulation compliance for data privacy and protection.',
      status: 'compliant',
      score: 94,
      requirements: { total: 28, met: 26, inProgress: 2, overdue: 0 },
      lastAssessment: new Date('2024-11-30'),
      nextAssessment: new Date('2025-05-30'),
      certificationDate: new Date('2024-12-01'),
      expiryDate: new Date('2025-12-01')
    },
    {
      id: 'pci_dss',
      name: 'PCI DSS',
      description: 'Payment Card Industry Data Security Standard for secure payment processing.',
      status: 'partial',
      score: 87,
      requirements: { total: 12, met: 10, inProgress: 1, overdue: 1 },
      lastAssessment: new Date('2024-10-15'),
      nextAssessment: new Date('2025-04-15'),
      certificationDate: new Date('2024-10-20'),
      expiryDate: new Date('2025-10-20')
    },
    {
      id: 'iso27001',
      name: 'ISO 27001',
      description: 'International standard for information security management systems.',
      status: 'partial',
      score: 78,
      requirements: { total: 114, met: 89, inProgress: 20, overdue: 5 },
      lastAssessment: new Date('2024-09-15'),
      nextAssessment: new Date('2025-03-15'),
    }
  ]);

  const [requirements, setRequirements] = useState<ComplianceRequirement[]>([
    {
      id: 'req1',
      framework: 'SOC 2 Type II',
      category: 'Access Controls',
      title: 'Implement Multi-Factor Authentication',
      description: 'All administrative accounts must use multi-factor authentication.',
      status: 'met',
      priority: 'high',
      assignee: 'Security Team',
      dueDate: new Date('2024-12-01'),
      evidence: [
        { type: 'control', name: 'MFA Policy', description: 'Multi-factor authentication policy document', status: 'verified' },
        { type: 'procedure', name: 'MFA Implementation', description: 'Step-by-step MFA setup procedure', status: 'verified' }
      ],
      lastReview: new Date('2024-12-15')
    },
    {
      id: 'req2',
      framework: 'GDPR',
      category: 'Data Protection',
      title: 'Data Retention Policy',
      description: 'Implement and document data retention policies with automatic deletion.',
      status: 'in_progress',
      priority: 'high',
      assignee: 'Legal Team',
      dueDate: new Date('2025-01-30'),
      evidence: [
        { type: 'document', name: 'Retention Policy', description: 'Data retention policy document', status: 'pending' },
        { type: 'procedure', name: 'Auto-deletion Process', description: 'Automated data deletion procedure', status: 'missing' }
      ],
      lastReview: new Date('2024-12-10')
    }
  ]);

  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([
    {
      id: 'audit1',
      timestamp: new Date(),
      framework: 'SOC 2',
      event: 'Control Testing',
      user: 'John Smith',
      details: 'Tested access control implementation',
      outcome: 'pass'
    },
    {
      id: 'audit2',
      timestamp: new Date(Date.now() - 3600000),
      framework: 'GDPR',
      event: 'Data Processing Review',
      user: 'Jane Doe',
      details: 'Reviewed data processing activities',
      outcome: 'partial'
    }
  ]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'compliant':
      case 'met':
      case 'pass':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'partial':
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'non_compliant':
      case 'overdue':
      case 'fail':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'compliant':
      case 'met':
      case 'pass':
        return <CheckCircle className="h-4 w-4" />;
      case 'partial':
      case 'in_progress':
        return <Clock className="h-4 w-4" />;
      case 'non_compliant':
      case 'overdue':
      case 'fail':
        return <XCircle className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600';
      case 'medium': return 'text-yellow-600';
      case 'low': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Compliance Dashboard</h1>
            <p className="text-gray-500 mt-1">Monitor compliance frameworks and requirements</p>
          </div>
          <div className="flex space-x-3">
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export Reports
            </Button>
            <Button>
              <Settings className="h-4 w-4 mr-2" />
              Configure Frameworks
            </Button>
          </div>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overall Compliance</CardTitle>
              <Shield className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">89%</div>
              <div className="flex items-center mt-2">
                <Progress value={89} className="flex-1" />
                <span className="ml-2 text-sm text-green-600">Good</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Frameworks</CardTitle>
              <FileText className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{frameworks.length}</div>
              <p className="text-xs text-gray-500 mt-1">
                {frameworks.filter(f => f.status === 'compliant').length} fully compliant
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Actions</CardTitle>
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                {requirements.filter(r => r.status === 'in_progress' || r.status === 'overdue').length}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {requirements.filter(r => r.status === 'overdue').length} overdue
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Next Assessment</CardTitle>
              <Calendar className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                {Math.min(...frameworks.map(f => Math.ceil((f.nextAssessment.getTime() - Date.now()) / (1000 * 60 * 60 * 24))))}
              </div>
              <p className="text-xs text-gray-500 mt-1">days until next assessment</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="frameworks" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="frameworks">Frameworks</TabsTrigger>
            <TabsTrigger value="requirements">Requirements</TabsTrigger>
            <TabsTrigger value="audit">Audit Trail</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
          </TabsList>

          {/* Frameworks Tab */}
          <TabsContent value="frameworks" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {frameworks.map((framework) => (
                <Card key={framework.id} className="relative">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{framework.name}</CardTitle>
                        <CardDescription className="mt-1">
                          {framework.description}
                        </CardDescription>
                      </div>
                      <Badge className={getStatusColor(framework.status)}>
                        {getStatusIcon(framework.status)}
                        <span className="ml-1 capitalize">{framework.status.replace('_', ' ')}</span>
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Compliance Score */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-600">Compliance Score</span>
                        <span className="text-lg font-bold">{framework.score}%</span>
                      </div>
                      <Progress value={framework.score} className="w-full" />
                    </div>

                    {/* Requirements Breakdown */}
                    <div className="grid grid-cols-4 gap-2 text-center text-sm">
                      <div>
                        <div className="font-semibold text-green-600">{framework.requirements.met}</div>
                        <div className="text-gray-500">Met</div>
                      </div>
                      <div>
                        <div className="font-semibold text-yellow-600">{framework.requirements.inProgress}</div>
                        <div className="text-gray-500">In Progress</div>
                      </div>
                      <div>
                        <div className="font-semibold text-red-600">{framework.requirements.overdue}</div>
                        <div className="text-gray-500">Overdue</div>
                      </div>
                      <div>
                        <div className="font-semibold text-gray-600">{framework.requirements.total}</div>
                        <div className="text-gray-500">Total</div>
                      </div>
                    </div>

                    {/* Dates */}
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Last Assessment</span>
                        <span>{framework.lastAssessment.toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Next Assessment</span>
                        <span>{framework.nextAssessment.toLocaleDateString()}</span>
                      </div>
                      {framework.expiryDate && (
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">Certification Expires</span>
                          <span className={
                            framework.expiryDate.getTime() - Date.now() < 90 * 24 * 60 * 60 * 1000 
                              ? 'text-red-600 font-medium' 
                              : ''
                          }>
                            {framework.expiryDate.toLocaleDateString()}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex space-x-2">
                      <Button variant="outline" size="sm" className="flex-1">
                        <FileText className="h-4 w-4 mr-2" />
                        View Details
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1">
                        <Download className="h-4 w-4 mr-2" />
                        Export
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Requirements Tab */}
          <TabsContent value="requirements" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Compliance Requirements</CardTitle>
                <CardDescription>
                  Track and manage compliance requirements across all frameworks
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {requirements.map((req) => (
                    <div key={req.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3">
                            <h3 className="font-medium text-gray-900">{req.title}</h3>
                            <Badge className={getStatusColor(req.status)}>
                              {getStatusIcon(req.status)}
                              <span className="ml-1">{req.status.replace('_', ' ')}</span>
                            </Badge>
                            <Badge variant="outline" className={`${getPriorityColor(req.priority)} border-current`}>
                              {req.priority}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">{req.description}</p>
                          <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                            <span>{req.framework} • {req.category}</span>
                            <span>Assigned to: {req.assignee}</span>
                            <span>Due: {req.dueDate.toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>

                      {/* Evidence */}
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium text-gray-700">Evidence:</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                          {req.evidence.map((evidence, idx) => (
                            <div key={idx} className="flex items-center space-x-2 text-sm">
                              <div className={`w-2 h-2 rounded-full ${
                                evidence.status === 'verified' ? 'bg-green-500' :
                                evidence.status === 'pending' ? 'bg-yellow-500' : 'bg-red-500'
                              }`} />
                              <span className="text-gray-600">{evidence.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Audit Trail Tab */}
          <TabsContent value="audit" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Audit Trail</CardTitle>
                <CardDescription>
                  Complete audit log of compliance activities
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {auditEvents.map((event) => (
                    <div key={event.id} className="flex items-start space-x-3 p-3 border rounded-lg">
                      <div className={`p-1 rounded-full ${getStatusColor(event.outcome)}`}>
                        {getStatusIcon(event.outcome)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-gray-900">{event.event}</p>
                          <Badge variant="outline">{event.framework}</Badge>
                        </div>
                        <p className="text-sm text-gray-600">{event.details}</p>
                        <div className="flex items-center space-x-4 mt-1 text-xs text-gray-400">
                          <span>By: {event.user}</span>
                          <span>{event.timestamp.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <BarChart3 className="h-5 w-5 mr-2 text-blue-600" />
                    Executive Summary
                  </CardTitle>
                  <CardDescription>
                    High-level compliance overview for leadership
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full">
                    <Download className="h-4 w-4 mr-2" />
                    Generate Report
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <FileText className="h-5 w-5 mr-2 text-green-600" />
                    Detailed Assessment
                  </CardTitle>
                  <CardDescription>
                    Comprehensive compliance assessment report
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full">
                    <Download className="h-4 w-4 mr-2" />
                    Generate Report
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Shield className="h-5 w-5 mr-2 text-purple-600" />
                    Audit Package
                  </CardTitle>
                  <CardDescription>
                    Complete audit documentation package
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full">
                    <Download className="h-4 w-4 mr-2" />
                    Generate Package
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Recent Reports */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Reports</CardTitle>
                <CardDescription>
                  Previously generated compliance reports
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <div className="font-medium">SOC 2 Type II Annual Report</div>
                      <div className="text-sm text-gray-500">Generated on December 20, 2024</div>
                    </div>
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <div className="font-medium">GDPR Compliance Assessment</div>
                      <div className="text-sm text-gray-500">Generated on November 30, 2024</div>
                    </div>
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default ComplianceDashboard;