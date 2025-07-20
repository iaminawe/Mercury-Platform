'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  Users,
  UserPlus,
  Search,
  Filter,
  Download,
  Edit,
  Trash2,
  Shield,
  Key,
  Eye,
  EyeOff,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Settings,
  Globe,
  Lock,
  Smartphone
} from 'lucide-react';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  status: 'active' | 'inactive' | 'suspended' | 'pending';
  lastLogin: Date | null;
  createdAt: Date;
  permissions: string[];
  mfaEnabled: boolean;
  ssoEnabled: boolean;
  sessionCount: number;
  riskScore: number;
  profileCompletion: number;
}

interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  userCount: number;
  isSystem: boolean;
}

interface Permission {
  id: string;
  name: string;
  description: string;
  category: string;
  risk: 'low' | 'medium' | 'high' | 'critical';
}

interface Session {
  id: string;
  userId: string;
  userAgent: string;
  ipAddress: string;
  location: string;
  startTime: Date;
  lastActivity: Date;
  isActive: boolean;
}

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([
    {
      id: '1',
      name: 'John Smith',
      email: 'john.smith@company.com',
      role: 'Administrator',
      department: 'IT',
      status: 'active',
      lastLogin: new Date(),
      createdAt: new Date('2024-01-15'),
      permissions: ['user.read', 'user.write', 'admin.all'],
      mfaEnabled: true,
      ssoEnabled: true,
      sessionCount: 3,
      riskScore: 15,
      profileCompletion: 100
    },
    {
      id: '2',
      name: 'Jane Doe',
      email: 'jane.doe@company.com',
      role: 'Data Analyst',
      department: 'Analytics',
      status: 'active',
      lastLogin: new Date(Date.now() - 3600000),
      createdAt: new Date('2024-02-01'),
      permissions: ['data.read', 'reports.read'],
      mfaEnabled: true,
      ssoEnabled: false,
      sessionCount: 1,
      riskScore: 25,
      profileCompletion: 90
    },
    {
      id: '3',
      name: 'Bob Wilson',
      email: 'bob.wilson@company.com',
      role: 'Sales Manager',
      department: 'Sales',
      status: 'inactive',
      lastLogin: new Date(Date.now() - 86400000 * 7),
      createdAt: new Date('2023-11-10'),
      permissions: ['sales.read', 'customers.read'],
      mfaEnabled: false,
      ssoEnabled: true,
      sessionCount: 0,
      riskScore: 45,
      profileCompletion: 75
    }
  ]);

  const [roles, setRoles] = useState<Role[]>([
    {
      id: 'admin',
      name: 'Administrator',
      description: 'Full system access and user management capabilities',
      permissions: ['admin.all', 'user.read', 'user.write', 'system.config'],
      userCount: 5,
      isSystem: true
    },
    {
      id: 'analyst',
      name: 'Data Analyst',
      description: 'Access to analytics and reporting features',
      permissions: ['data.read', 'reports.read', 'exports.create'],
      userCount: 15,
      isSystem: false
    },
    {
      id: 'sales',
      name: 'Sales Manager',
      description: 'Sales data access and customer management',
      permissions: ['sales.read', 'customers.read', 'orders.read'],
      userCount: 8,
      isSystem: false
    }
  ]);

  const [permissions, setPermissions] = useState<Permission[]>([
    {
      id: 'admin.all',
      name: 'Full Administrator Access',
      description: 'Complete access to all system functions',
      category: 'Administration',
      risk: 'critical'
    },
    {
      id: 'user.read',
      name: 'View Users',
      description: 'View user profiles and basic information',
      category: 'User Management',
      risk: 'low'
    },
    {
      id: 'user.write',
      name: 'Manage Users',
      description: 'Create, modify, and delete user accounts',
      category: 'User Management',
      risk: 'high'
    },
    {
      id: 'data.read',
      name: 'View Data',
      description: 'Access to read business data and analytics',
      category: 'Data Access',
      risk: 'medium'
    }
  ]);

  const [sessions, setSessions] = useState<Session[]>([
    {
      id: 'session1',
      userId: '1',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      ipAddress: '192.168.1.100',
      location: 'San Francisco, CA',
      startTime: new Date(Date.now() - 7200000),
      lastActivity: new Date(),
      isActive: true
    },
    {
      id: 'session2',
      userId: '2',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      ipAddress: '192.168.1.105',
      location: 'New York, NY',
      startTime: new Date(Date.now() - 3600000),
      lastActivity: new Date(Date.now() - 300000),
      isActive: true
    }
  ]);

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 border-green-200';
      case 'inactive': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'suspended': return 'bg-red-100 text-red-800 border-red-200';
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle className="h-4 w-4" />;
      case 'inactive': return <Clock className="h-4 w-4" />;
      case 'suspended': return <XCircle className="h-4 w-4" />;
      case 'pending': return <AlertTriangle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const getRiskColor = (score: number) => {
    if (score <= 30) return 'text-green-600';
    if (score <= 60) return 'text-yellow-600';
    if (score <= 80) return 'text-orange-600';
    return 'text-red-600';
  };

  const getPermissionRiskColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'critical': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = searchTerm === '' || 
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.department.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
    
    return matchesSearch && matchesRole && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
            <p className="text-gray-500 mt-1">Manage users, roles, and permissions</p>
          </div>
          <div className="flex space-x-3">
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export Users
            </Button>
            <Dialog open={isCreateUserOpen} onOpenChange={setIsCreateUserOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add User
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create New User</DialogTitle>
                  <DialogDescription>
                    Add a new user to the system with appropriate roles and permissions.
                  </DialogDescription>
                </DialogHeader>
                {/* User creation form would go here */}
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="name">Full Name</Label>
                      <Input id="name" placeholder="Enter full name" />
                    </div>
                    <div>
                      <Label htmlFor="email">Email Address</Label>
                      <Input id="email" type="email" placeholder="Enter email" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="role">Role</Label>
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          {roles.map(role => (
                            <SelectItem key={role.id} value={role.id}>
                              {role.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="department">Department</Label>
                      <Input id="department" placeholder="Enter department" />
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch id="require-mfa" />
                    <Label htmlFor="require-mfa">Require Multi-Factor Authentication</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch id="enable-sso" />
                    <Label htmlFor="enable-sso">Enable Single Sign-On</Label>
                  </div>
                  <div className="flex justify-end space-x-2 pt-4">
                    <Button variant="outline" onClick={() => setIsCreateUserOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={() => setIsCreateUserOpen(false)}>
                      Create User
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{users.length}</div>
              <p className="text-xs text-gray-500 mt-1">
                {users.filter(u => u.status === 'active').length} active
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
              <Globe className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {sessions.filter(s => s.isActive).length}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Across {new Set(sessions.filter(s => s.isActive).map(s => s.userId)).size} users
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">MFA Enabled</CardTitle>
              <Smartphone className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                {Math.round((users.filter(u => u.mfaEnabled).length / users.length) * 100)}%
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {users.filter(u => u.mfaEnabled).length} of {users.length} users
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">High Risk Users</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {users.filter(u => u.riskScore > 60).length}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Require attention
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
                    placeholder="Search users..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <div className="flex gap-2">
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    {roles.map(role => (
                      <SelectItem key={role.id} value={role.name}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Content Tabs */}
        <Tabs defaultValue="users" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="roles">Roles</TabsTrigger>
            <TabsTrigger value="permissions">Permissions</TabsTrigger>
            <TabsTrigger value="sessions">Active Sessions</TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>User Directory</CardTitle>
                <CardDescription>
                  Manage user accounts, access, and security settings
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredUsers.map((user) => (
                    <div key={user.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-4 flex-1">
                          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                            <span className="text-sm font-medium text-blue-600">
                              {user.name.split(' ').map(n => n[0]).join('')}
                            </span>
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 mb-1">
                              <h3 className="font-medium text-gray-900">{user.name}</h3>
                              <Badge className={getStatusColor(user.status)}>
                                {getStatusIcon(user.status)}
                                <span className="ml-1 capitalize">{user.status}</span>
                              </Badge>
                            </div>
                            
                            <div className="text-sm text-gray-600 space-y-1">
                              <div>{user.email}</div>
                              <div className="flex items-center space-x-4">
                                <span>Role: {user.role}</span>
                                <span>Department: {user.department}</span>
                                <span className={`font-medium ${getRiskColor(user.riskScore)}`}>
                                  Risk: {user.riskScore}/100
                                </span>
                              </div>
                              <div className="flex items-center space-x-4 text-xs text-gray-500">
                                <span>
                                  Last login: {user.lastLogin ? user.lastLogin.toLocaleDateString() : 'Never'}
                                </span>
                                <span>Sessions: {user.sessionCount}</span>
                                <div className="flex items-center space-x-2">
                                  {user.mfaEnabled ? (
                                    <CheckCircle className="h-3 w-3 text-green-600" />
                                  ) : (
                                    <XCircle className="h-3 w-3 text-red-600" />
                                  )}
                                  <span>MFA</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                  {user.ssoEnabled ? (
                                    <CheckCircle className="h-3 w-3 text-green-600" />
                                  ) : (
                                    <XCircle className="h-3 w-3 text-red-600" />
                                  )}
                                  <span>SSO</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2 ml-4">
                          <Button variant="outline" size="sm" onClick={() => setSelectedUser(user)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="sm">
                            <Key className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="sm">
                            <Shield className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Roles Tab */}
          <TabsContent value="roles" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Role Management</CardTitle>
                    <CardDescription>
                      Define and manage user roles and their permissions
                    </CardDescription>
                  </div>
                  <Button>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Create Role
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {roles.map((role) => (
                    <Card key={role.id}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-lg">{role.name}</CardTitle>
                            <CardDescription>{role.description}</CardDescription>
                          </div>
                          {role.isSystem && (
                            <Badge variant="outline">System</Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">Users</span>
                            <span className="font-medium">{role.userCount}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">Permissions</span>
                            <span className="font-medium">{role.permissions.length}</span>
                          </div>
                          
                          <div className="space-y-1">
                            <div className="text-xs text-gray-500">Key Permissions:</div>
                            <div className="flex flex-wrap gap-1">
                              {role.permissions.slice(0, 3).map((perm) => (
                                <Badge key={perm} variant="outline" className="text-xs">
                                  {perm}
                                </Badge>
                              ))}
                              {role.permissions.length > 3 && (
                                <Badge variant="outline" className="text-xs">
                                  +{role.permissions.length - 3} more
                                </Badge>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex space-x-2 pt-2">
                            <Button variant="outline" size="sm" className="flex-1">
                              <Edit className="h-4 w-4 mr-1" />
                              Edit
                            </Button>
                            {!role.isSystem && (
                              <Button variant="outline" size="sm">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Permissions Tab */}
          <TabsContent value="permissions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Permission Registry</CardTitle>
                <CardDescription>
                  All available permissions categorized by function and risk level
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(
                    permissions.reduce((acc, perm) => {
                      if (!acc[perm.category]) acc[perm.category] = [];
                      acc[perm.category].push(perm);
                      return acc;
                    }, {} as Record<string, Permission[]>)
                  ).map(([category, perms]) => (
                    <div key={category} className="border rounded-lg p-4">
                      <h3 className="font-medium text-gray-900 mb-3">{category}</h3>
                      <div className="space-y-2">
                        {perms.map((perm) => (
                          <div key={perm.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2">
                                <span className="font-medium text-sm">{perm.name}</span>
                                <Badge className={getPermissionRiskColor(perm.risk)}>
                                  {perm.risk}
                                </Badge>
                              </div>
                              <p className="text-xs text-gray-600 mt-1">{perm.description}</p>
                            </div>
                            <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                              {perm.id}
                            </code>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Sessions Tab */}
          <TabsContent value="sessions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Active Sessions</CardTitle>
                <CardDescription>
                  Monitor and manage active user sessions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {sessions.filter(s => s.isActive).map((session) => {
                    const user = users.find(u => u.id === session.userId);
                    return (
                      <div key={session.id} className="border rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              <h3 className="font-medium text-gray-900">
                                {user?.name || 'Unknown User'}
                              </h3>
                              <Badge className="bg-green-100 text-green-800">Active</Badge>
                            </div>
                            <div className="text-sm text-gray-600 space-y-1">
                              <div>Email: {user?.email}</div>
                              <div>IP Address: {session.ipAddress}</div>
                              <div>Location: {session.location}</div>
                              <div className="text-xs text-gray-500">
                                Started: {session.startTime.toLocaleString()} • 
                                Last Activity: {session.lastActivity.toLocaleString()}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2 ml-4">
                            <Button variant="outline" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm">
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default UserManagement;