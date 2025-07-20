'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Plus, 
  Search, 
  Filter, 
  Play, 
  Pause, 
  Copy, 
  Edit, 
  Eye, 
  Trash2,
  Calendar,
  Users,
  Mail,
  TrendingUp,
  MoreHorizontal
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Campaign {
  id: string;
  name: string;
  type: 'newsletter' | 'welcome' | 'abandoned_cart' | 'product_recommendation' | 'win_back' | 'promotional';
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'paused' | 'failed';
  subject: string;
  scheduledAt?: string;
  sentAt?: string;
  recipientCount: number;
  sentCount: number;
  openRate: number;
  clickRate: number;
  revenue: number;
  createdAt: string;
  template: {
    id: string;
    name: string;
  };
  segment?: {
    id: string;
    name: string;
  };
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [filteredCampaigns, setFilteredCampaigns] = useState<Campaign[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCampaigns();
  }, []);

  useEffect(() => {
    filterCampaigns();
  }, [campaigns, searchTerm, statusFilter, typeFilter]);

  const loadCampaigns = async () => {
    try {
      // Mock data for demonstration
      const mockCampaigns: Campaign[] = [
        {
          id: '1',
          name: 'Welcome Series - Step 1: Getting Started',
          type: 'welcome',
          status: 'sent',
          subject: 'Welcome to Mercury! Let\'s get you started 🎉',
          sentAt: '2025-07-18T10:00:00Z',
          recipientCount: 1250,
          sentCount: 1250,
          openRate: 45.2,
          clickRate: 8.1,
          revenue: 2840,
          createdAt: '2025-07-15T09:00:00Z',
          template: { id: 'welcome-1', name: 'Welcome Email Template' },
          segment: { id: 'new-customers', name: 'New Customers' }
        },
        {
          id: '2',
          name: 'Abandoned Cart Recovery - Gentle Reminder',
          type: 'abandoned_cart',
          status: 'scheduled',
          subject: 'Don\'t forget your cart! 🛒',
          scheduledAt: '2025-07-19T15:00:00Z',
          recipientCount: 340,
          sentCount: 0,
          openRate: 0,
          clickRate: 0,
          revenue: 0,
          createdAt: '2025-07-18T14:30:00Z',
          template: { id: 'abandoned-cart-1', name: 'Abandoned Cart Template' },
          segment: { id: 'cart-abandoners', name: 'Cart Abandoners' }
        },
        {
          id: '3',
          name: 'AI Product Recommendations - Weekly Picks',
          type: 'product_recommendation',
          status: 'sending',
          subject: 'Handpicked for you this week! 💎',
          recipientCount: 2100,
          sentCount: 850,
          openRate: 28.4,
          clickRate: 5.2,
          revenue: 1560,
          createdAt: '2025-07-18T08:00:00Z',
          template: { id: 'product-rec-1', name: 'Product Recommendations Template' },
          segment: { id: 'active-customers', name: 'Active Customers' }
        },
        {
          id: '4',
          name: 'Monthly Newsletter - July 2025',
          type: 'newsletter',
          status: 'draft',
          subject: 'July Newsletter: Summer Trends & New Arrivals',
          recipientCount: 0,
          sentCount: 0,
          openRate: 0,
          clickRate: 0,
          revenue: 0,
          createdAt: '2025-07-17T16:00:00Z',
          template: { id: 'newsletter-1', name: 'Newsletter Template' }
        },
        {
          id: '5',
          name: 'Win-Back Campaign - We Miss You',
          type: 'win_back',
          status: 'paused',
          subject: 'We miss you! Come back with 20% off 💔',
          scheduledAt: '2025-07-20T10:00:00Z',
          recipientCount: 89,
          sentCount: 0,
          openRate: 0,
          clickRate: 0,
          revenue: 0,
          createdAt: '2025-07-16T11:00:00Z',
          template: { id: 'win-back-1', name: 'Win-Back Template' },
          segment: { id: 'inactive-customers', name: 'Inactive Customers' }
        },
        {
          id: '6',
          name: 'Flash Sale - 48 Hour Deal',
          type: 'promotional',
          status: 'sent',
          subject: '⚡ 48-Hour Flash Sale: Up to 60% Off!',
          sentAt: '2025-07-17T12:00:00Z',
          recipientCount: 5600,
          sentCount: 5600,
          openRate: 32.1,
          clickRate: 6.8,
          revenue: 12340,
          createdAt: '2025-07-17T10:00:00Z',
          template: { id: 'promo-1', name: 'Promotional Template' },
          segment: { id: 'all-subscribers', name: 'All Subscribers' }
        }
      ];

      setCampaigns(mockCampaigns);
      setLoading(false);
    } catch (error) {
      console.error('Failed to load campaigns:', error);
      setLoading(false);
    }
  };

  const filterCampaigns = () => {
    let filtered = campaigns;

    if (searchTerm) {
      filtered = filtered.filter(campaign => 
        campaign.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        campaign.subject.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(campaign => campaign.status === statusFilter);
    }

    if (typeFilter !== 'all') {
      filtered = filtered.filter(campaign => campaign.type === typeFilter);
    }

    setFilteredCampaigns(filtered);
  };

  const getStatusColor = (status: Campaign['status']) => {
    switch (status) {
      case 'sent':
        return 'bg-green-100 text-green-800';
      case 'sending':
        return 'bg-blue-100 text-blue-800';
      case 'scheduled':
        return 'bg-yellow-100 text-yellow-800';
      case 'paused':
        return 'bg-gray-100 text-gray-800';
      case 'draft':
        return 'bg-purple-100 text-purple-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeLabel = (type: Campaign['type']) => {
    switch (type) {
      case 'newsletter':
        return 'Newsletter';
      case 'welcome':
        return 'Welcome';
      case 'abandoned_cart':
        return 'Cart Recovery';
      case 'product_recommendation':
        return 'Recommendations';
      case 'win_back':
        return 'Win-back';
      case 'promotional':
        return 'Promotional';
      default:
        return type;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleCampaignAction = async (action: string, campaignId: string) => {
    try {
      switch (action) {
        case 'play':
          console.log('Starting campaign:', campaignId);
          break;
        case 'pause':
          console.log('Pausing campaign:', campaignId);
          break;
        case 'duplicate':
          console.log('Duplicating campaign:', campaignId);
          break;
        case 'delete':
          console.log('Deleting campaign:', campaignId);
          break;
        default:
          break;
      }
    } catch (error) {
      console.error('Failed to perform campaign action:', error);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Campaigns</h1>
        </div>
        <div className="text-center py-12">
          <p>Loading campaigns...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Email Campaigns</h1>
          <p className="text-muted-foreground">
            Manage and monitor your email marketing campaigns
          </p>
        </div>
        <Button asChild>
          <Link href="/marketing/campaigns/new">
            <Plus className="h-4 w-4 mr-2" />
            Create Campaign
          </Link>
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Mail className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Total Campaigns</p>
                <p className="text-2xl font-bold">{campaigns.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Play className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Active</p>
                <p className="text-2xl font-bold">
                  {campaigns.filter(c => ['scheduled', 'sending'].includes(c.status)).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Total Recipients</p>
                <p className="text-2xl font-bold">
                  {campaigns.reduce((sum, c) => sum + c.recipientCount, 0).toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold">
                  ${campaigns.reduce((sum, c) => sum + c.revenue, 0).toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search campaigns..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="sending">Sending</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="newsletter">Newsletter</SelectItem>
                <SelectItem value="welcome">Welcome</SelectItem>
                <SelectItem value="abandoned_cart">Cart Recovery</SelectItem>
                <SelectItem value="product_recommendation">Recommendations</SelectItem>
                <SelectItem value="win_back">Win-back</SelectItem>
                <SelectItem value="promotional">Promotional</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Campaigns Table */}
      <Card>
        <CardHeader>
          <CardTitle>Campaigns</CardTitle>
          <CardDescription>
            {filteredCampaigns.length} of {campaigns.length} campaigns
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Recipients</TableHead>
                <TableHead>Performance</TableHead>
                <TableHead>Revenue</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCampaigns.map((campaign) => (
                <TableRow key={campaign.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{campaign.name}</p>
                      <p className="text-sm text-muted-foreground truncate max-w-[300px]">
                        {campaign.subject}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {getTypeLabel(campaign.type)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(campaign.status)}>
                      {campaign.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{campaign.recipientCount.toLocaleString()}</p>
                      {campaign.sentCount > 0 && (
                        <p className="text-sm text-muted-foreground">
                          {campaign.sentCount.toLocaleString()} sent
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {campaign.sentCount > 0 ? (
                      <div className="text-sm">
                        <p>{campaign.openRate}% open</p>
                        <p className="text-muted-foreground">{campaign.clickRate}% click</p>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {campaign.revenue > 0 ? (
                      <span className="font-medium">${campaign.revenue.toLocaleString()}</span>
                    ) : (
                      <span className="text-muted-foreground">$0</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {campaign.sentAt && (
                        <p>Sent {formatDate(campaign.sentAt)}</p>
                      )}
                      {campaign.scheduledAt && (
                        <p>Scheduled {formatDate(campaign.scheduledAt)}</p>
                      )}
                      {!campaign.sentAt && !campaign.scheduledAt && (
                        <p>Created {formatDate(campaign.createdAt)}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem asChild>
                          <Link href={`/marketing/campaigns/${campaign.id}`}>
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </Link>
                        </DropdownMenuItem>
                        {campaign.status === 'draft' && (
                          <DropdownMenuItem asChild>
                            <Link href={`/marketing/campaigns/${campaign.id}/edit`}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </Link>
                          </DropdownMenuItem>
                        )}
                        {campaign.status === 'scheduled' && (
                          <DropdownMenuItem onClick={() => handleCampaignAction('pause', campaign.id)}>
                            <Pause className="mr-2 h-4 w-4" />
                            Pause
                          </DropdownMenuItem>
                        )}
                        {campaign.status === 'paused' && (
                          <DropdownMenuItem onClick={() => handleCampaignAction('play', campaign.id)}>
                            <Play className="mr-2 h-4 w-4" />
                            Resume
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => handleCampaignAction('duplicate', campaign.id)}>
                          <Copy className="mr-2 h-4 w-4" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => handleCampaignAction('delete', campaign.id)}
                          className="text-red-600"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}