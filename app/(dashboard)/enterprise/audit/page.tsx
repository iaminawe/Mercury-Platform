'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Search,
  Filter,
  Download,
  Eye,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  User,
  Database,
  Shield,
  Settings,
  FileText,
  Calendar,
  Activity,
  Globe,
  Lock
} from 'lucide-react';

interface AuditLog {
  id: string;
  timestamp: Date;
  event: string;
  category: 'authentication' | 'authorization' | 'data_access' | 'configuration' | 'system' | 'compliance';
  severity: 'low' | 'medium' | 'high' | 'critical';
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  resource: string;
  action: string;
  outcome: 'success' | 'failure' | 'blocked';
  source: {
    ip: string;
    userAgent: string;
    location?: string;
  };
  details: Record<string, any>;
  riskScore: number;
}

interface SystemEvent {
  id: string;
  timestamp: Date;
  service: string;
  event: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  metadata: Record<string, any>;
}

interface DataAccessEvent {
  id: string;
  timestamp: Date;
  user: string;
  table: string;
  operation: 'select' | 'insert' | 'update' | 'delete';
  recordCount: number;
  sensitiveData: boolean;
  purpose: string;
  approved: boolean;
}

const AuditDashboard: React.FC = () => {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([
    {
      id: '1',
      timestamp: new Date(),
      event: 'User Login',
      category: 'authentication',
      severity: 'low',
      user: {
        id: 'user1',
        name: 'John Smith',
        email: 'john.smith@company.com',
        role: 'Administrator'
      },
      resource: 'Mercury Dashboard',
      action: 'login',
      outcome: 'success',
      source: {
        ip: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        location: 'San Francisco, CA'
      },
      details: {
        mfaUsed: true,
        sessionDuration: 7200
      },
      riskScore: 10
    },
    {
      id: '2',
      timestamp: new Date(Date.now() - 300000),
      event: 'Failed Login Attempt',
      category: 'authentication',
      severity: 'medium',
      user: {
        id: 'unknown',
        name: 'Unknown User',
        email: 'attacker@malicious.com',
        role: 'Unknown'
      },
      resource: 'Mercury Dashboard',
      action: 'login_attempt',
      outcome: 'failure',
      source: {
        ip: '45.33.32.156',
        userAgent: 'Python/3.9 requests/2.25.1',
        location: 'Moscow, Russia'
      },
      details: {
        reason: 'Invalid credentials',
        attemptCount: 5
      },
      riskScore: 75
    },
    {
      id: '3',
      timestamp: new Date(Date.now() - 600000),
      event: 'Data Export',
      category: 'data_access',
      severity: 'high',
      user: {
        id: 'user2',
        name: 'Jane Doe',
        email: 'jane.doe@company.com',
        role: 'Data Analyst'
      },
      resource: 'Customer Database',
      action: 'export',
      outcome: 'success',
      source: {
        ip: '192.168.1.105',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        location: 'New York, NY'
      },
      details: {
        recordCount: 50000,
        dataSize: '125MB',
        format: 'CSV'
      },
      riskScore: 60
    }
  ]);

  const [systemEvents, setSystemEvents] = useState<SystemEvent[]>([
    {
      id: 'sys1',
      timestamp: new Date(),
      service: 'Authentication Service',
      event: 'Service Health Check',
      severity: 'info',
      message: 'Service is healthy and responding normally',
      metadata: {
        responseTime: '15ms',
        uptime: '99.9%'
      }
    },
    {
      id: 'sys2',
      timestamp: new Date(Date.now() - 600000),
      service: 'Database',
      event: 'Connection Pool Warning',
      severity: 'warning',
      message: 'Connection pool utilization at 85%',
      metadata: {
        activeConnections: 85,
        maxConnections: 100
      }
    }
  ]);

  const [dataAccessEvents, setDataAccessEvents] = useState<DataAccessEvent[]>([
    {
      id: 'data1',
      timestamp: new Date(Date.now() - 900000),
      user: 'analytics@company.com',
      table: 'orders',
      operation: 'select',
      recordCount: 10000,
      sensitiveData: false,
      purpose: 'Monthly reporting',
      approved: true
    },
    {
      id: 'data2',
      timestamp: new Date(Date.now() - 1200000),
      user: 'support@company.com',
      table: 'customers',
      operation: 'update',
      recordCount: 1,
      sensitiveData: true,
      purpose: 'Customer support ticket',
      approved: true
    }
  ]);

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('24h');

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      case 'info': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'warning': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'error': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getOutcomeIcon = (outcome: string) => {
    switch (outcome) {
      case 'success': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'failure': return <XCircle className="h-4 w-4 text-red-600" />;
      case 'blocked': return <Shield className="h-4 w-4 text-orange-600" />;
      default: return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'authentication': return <User className="h-4 w-4" />;
      case 'authorization': return <Lock className="h-4 w-4" />;
      case 'data_access': return <Database className="h-4 w-4" />;
      case 'configuration': return <Settings className="h-4 w-4" />;
      case 'system': return <Activity className="h-4 w-4" />;
      case 'compliance': return <FileText className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  const filteredAuditLogs = auditLogs.filter(log => {
    const matchesSearch = searchTerm === '' || 
      log.event.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.resource.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = categoryFilter === 'all' || log.category === categoryFilter;
    const matchesSeverity = severityFilter === 'all' || log.severity === severityFilter;
    
    return matchesSearch && matchesCategory && matchesSeverity;
  });

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Audit & Monitoring</h1>
            <p className="text-gray-500 mt-1">Complete audit trail and system monitoring</p>
          </div>
          <div className="flex space-x-3">
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export Logs
            </Button>
            <Button>
              <Settings className="h-4 w-4 mr-2" />
              Configure Alerts
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Events (24h)</CardTitle>
              <Activity className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">1,247</div>
              <p className="text-xs text-gray-500 mt-1">
                +12% from yesterday
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Security Events</CardTitle>
              <Shield className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">23</div>
              <p className="text-xs text-gray-500 mt-1">
                3 high priority
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Failed Logins</CardTitle>
              <XCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">18</div>
              <p className="text-xs text-gray-500 mt-1">
                -5% from yesterday
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Data Exports</CardTitle>
              <Database className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">7</div>
              <p className="text-xs text-gray-500 mt-1">
                All approved
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search audit logs..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <div className="flex gap-2">
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="authentication">Authentication</SelectItem>
                    <SelectItem value="authorization">Authorization</SelectItem>
                    <SelectItem value="data_access">Data Access</SelectItem>
                    <SelectItem value="configuration">Configuration</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                    <SelectItem value="compliance">Compliance</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={severityFilter} onValueChange={setSeverityFilter}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Severity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Levels</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={dateRange} onValueChange={setDateRange}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Time Range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1h">Last Hour</SelectItem>
                    <SelectItem value="24h">Last 24h</SelectItem>
                    <SelectItem value="7d">Last 7 days</SelectItem>
                    <SelectItem value="30d">Last 30 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Content Tabs */}
        <Tabs defaultValue="audit" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="audit">Audit Logs</TabsTrigger>
            <TabsTrigger value="system">System Events</TabsTrigger>
            <TabsTrigger value="data">Data Access</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          {/* Audit Logs Tab */}
          <TabsContent value="audit" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Audit Events</CardTitle>
                <CardDescription>
                  Detailed audit trail of all user and system activities
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {filteredAuditLogs.map((log) => (
                    <div key={log.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3 flex-1">
                          <div className="mt-1">
                            {getCategoryIcon(log.category)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 mb-1">
                              <h3 className="font-medium text-gray-900">{log.event}</h3>
                              <Badge className={getSeverityColor(log.severity)}>
                                {log.severity}
                              </Badge>
                              <div className="flex items-center space-x-1">
                                {getOutcomeIcon(log.outcome)}
                                <span className="text-sm text-gray-600 capitalize">{log.outcome}</span>
                              </div>
                            </div>
                            
                            <div className="text-sm text-gray-600 space-y-1">
                              <div>
                                <span className="font-medium">User:</span> {log.user.name} ({log.user.role})
                              </div>
                              <div>
                                <span className="font-medium">Resource:</span> {log.resource} • 
                                <span className="font-medium ml-2">Action:</span> {log.action}
                              </div>
                              <div className="flex items-center space-x-4 text-xs text-gray-500">
                                <span>IP: {log.source.ip}</span>
                                {log.source.location && <span>Location: {log.source.location}</span>}
                                <span>Risk Score: {log.riskScore}/100</span>
                                <span>{log.timestamp.toLocaleString()}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2 ml-4">
                          <Button variant="outline" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      
                      {Object.keys(log.details).length > 0 && (
                        <div className="mt-3 pt-3 border-t">
                          <div className="text-xs text-gray-500">
                            <span className="font-medium">Details:</span>
                            {Object.entries(log.details).map(([key, value]) => (
                              <span key={key} className="ml-2">
                                {key}: {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* System Events Tab */}
          <TabsContent value="system" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>System Events</CardTitle>
                <CardDescription>
                  System health, performance, and operational events
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {systemEvents.map((event) => (
                    <div key={event.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3 flex-1">
                          <Activity className="h-4 w-4 mt-1 text-blue-600" />
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              <h3 className="font-medium text-gray-900">{event.event}</h3>
                              <Badge className={getSeverityColor(event.severity)}>
                                {event.severity}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-600 mb-2">{event.message}</p>
                            <div className="flex items-center space-x-4 text-xs text-gray-500">
                              <span>Service: {event.service}</span>
                              <span>{event.timestamp.toLocaleString()}</span>
                            </div>
                            {Object.keys(event.metadata).length > 0 && (
                              <div className="mt-2 text-xs text-gray-500">
                                {Object.entries(event.metadata).map(([key, value]) => (
                                  <span key={key} className="mr-3">
                                    {key}: {String(value)}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Data Access Tab */}
          <TabsContent value="data" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Data Access Events</CardTitle>
                <CardDescription>
                  All data access, modifications, and exports
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {dataAccessEvents.map((event) => (
                    <div key={event.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3 flex-1">
                          <Database className="h-4 w-4 mt-1 text-green-600" />
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              <h3 className="font-medium text-gray-900 capitalize">
                                {event.operation} on {event.table}
                              </h3>
                              {event.sensitiveData && (
                                <Badge className="bg-orange-100 text-orange-800">
                                  Sensitive Data
                                </Badge>
                              )}
                              {event.approved ? (
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-600" />
                              )}
                            </div>
                            <div className="text-sm text-gray-600 space-y-1">
                              <div>
                                <span className="font-medium">User:</span> {event.user}
                              </div>
                              <div>
                                <span className="font-medium">Records:</span> {event.recordCount.toLocaleString()} • 
                                <span className="font-medium ml-2">Purpose:</span> {event.purpose}
                              </div>
                              <div className="text-xs text-gray-500">
                                {event.timestamp.toLocaleString()}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Events */}
              <Card>
                <CardHeader>
                  <CardTitle>Top Events (24h)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">User Login</span>
                      <div className="flex items-center space-x-2">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div className="bg-blue-600 h-2 rounded-full" style={{ width: '85%' }}></div>
                        </div>
                        <span className="text-sm font-medium">423</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Data Query</span>
                      <div className="flex items-center space-x-2">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div className="bg-green-600 h-2 rounded-full" style={{ width: '72%' }}></div>
                        </div>
                        <span className="text-sm font-medium">361</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Configuration Change</span>
                      <div className="flex items-center space-x-2">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div className="bg-yellow-600 h-2 rounded-full" style={{ width: '15%' }}></div>
                        </div>
                        <span className="text-sm font-medium">76</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Risk Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle>Risk Score Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Low Risk (0-30)</span>
                      <div className="flex items-center space-x-2">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div className="bg-green-600 h-2 rounded-full" style={{ width: '92%' }}></div>
                        </div>
                        <span className="text-sm font-medium">92%</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Medium Risk (31-70)</span>
                      <div className="flex items-center space-x-2">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div className="bg-yellow-600 h-2 rounded-full" style={{ width: '6%' }}></div>
                        </div>
                        <span className="text-sm font-medium">6%</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm">High Risk (71-100)</span>
                      <div className="flex items-center space-x-2">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div className="bg-red-600 h-2 rounded-full" style={{ width: '2%' }}></div>
                        </div>
                        <span className="text-sm font-medium">2%</span>
                      </div>
                    </div>
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

export default AuditDashboard;