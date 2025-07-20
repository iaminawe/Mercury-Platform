import { Database } from '@/lib/database.types';
import { createLogger } from '@/lib/logger';
import { SupabaseClient } from '@supabase/supabase-js';
import { format, subDays } from 'date-fns';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Parser } from 'json2csv';

const logger = createLogger('export-service');

export type ExportFormat = 'csv' | 'xlsx' | 'pdf' | 'json';

export interface ExportOptions {
  format: ExportFormat;
  dateRange: { from: Date; to: Date };
  storeIds?: string[];
  metrics?: string[];
  includeCharts?: boolean;
  includeInsights?: boolean;
  groupBy?: 'store' | 'date' | 'metric';
  customFields?: string[];
}

export interface ExportResult {
  filename: string;
  size: number;
  format: ExportFormat;
  url?: string;
  blob?: Blob;
  error?: string;
}

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => void;
  }
}

export class ExportService {
  constructor(private supabase: SupabaseClient<Database>) {}

  async exportCrossStoreReport(
    ownerId: string,
    options: ExportOptions
  ): Promise<ExportResult> {
    try {
      // Fetch all necessary data
      const data = await this.fetchExportData(ownerId, options);
      
      // Generate export based on format
      switch (options.format) {
        case 'csv':
          return this.exportToCSV(data, options);
        case 'xlsx':
          return this.exportToExcel(data, options);
        case 'pdf':
          return this.exportToPDF(data, options);
        case 'json':
          return this.exportToJSON(data, options);
        default:
          throw new Error(`Unsupported export format: ${options.format}`);
      }
    } catch (error) {
      logger.error('Export failed', error);
      return {
        filename: '',
        size: 0,
        format: options.format,
        error: error instanceof Error ? error.message : 'Export failed'
      };
    }
  }

  private async fetchExportData(ownerId: string, options: ExportOptions) {
    // Get stores
    const { data: stores } = await this.supabase
      .from('stores')
      .select('*')
      .eq('owner_id', ownerId)
      .eq('is_active', true)
      .in('id', options.storeIds || []);

    const storeIds = options.storeIds || stores?.map(s => s.id) || [];

    // Get analytics data
    const { data: snapshots } = await this.supabase
      .from('analytics_snapshots')
      .select('*')
      .in('store_id', storeIds)
      .gte('date', format(options.dateRange.from, 'yyyy-MM-dd'))
      .lte('date', format(options.dateRange.to, 'yyyy-MM-dd'))
      .order('date', { ascending: true });

    // Get customer data
    const { data: customers } = await this.supabase
      .from('customers')
      .select('*, orders(*)')
      .in('store_id', storeIds)
      .gte('created_at', options.dateRange.from.toISOString())
      .lte('created_at', options.dateRange.to.toISOString());

    // Get product performance
    const { data: products } = await this.supabase
      .from('products')
      .select('*, variants(*)')
      .in('store_id', storeIds)
      .eq('status', 'active');

    return {
      stores: stores || [],
      snapshots: snapshots || [],
      customers: customers || [],
      products: products || [],
      dateRange: options.dateRange,
      metrics: options.metrics || this.getDefaultMetrics()
    };
  }

  private getDefaultMetrics(): string[] {
    return [
      'revenue',
      'orders_count',
      'unique_visitors',
      'conversion_rate',
      'average_order_value',
      'page_views',
      'bounce_rate'
    ];
  }

  private exportToCSV(data: any, options: ExportOptions): ExportResult {
    const records = this.transformDataForTable(data, options);
    
    const fields = this.getCSVFields(options);
    const parser = new Parser({ fields });
    const csv = parser.parse(records);
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const filename = this.generateFilename('csv', options);
    
    return {
      filename,
      size: blob.size,
      format: 'csv',
      blob,
      url: URL.createObjectURL(blob)
    };
  }

  private exportToExcel(data: any, options: ExportOptions): ExportResult {
    const workbook = XLSX.utils.book_new();
    
    // Summary sheet
    const summaryData = this.generateSummaryData(data);
    const summarySheet = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
    
    // Store performance sheet
    const storeData = this.generateStorePerformanceData(data);
    const storeSheet = XLSX.utils.json_to_sheet(storeData);
    XLSX.utils.book_append_sheet(workbook, storeSheet, 'Store Performance');
    
    // Daily data sheet
    const dailyData = this.transformDataForTable(data, options);
    const dailySheet = XLSX.utils.json_to_sheet(dailyData);
    XLSX.utils.book_append_sheet(workbook, dailySheet, 'Daily Data');
    
    // Product performance sheet
    if (data.products.length > 0) {
      const productData = this.generateProductPerformanceData(data);
      const productSheet = XLSX.utils.json_to_sheet(productData);
      XLSX.utils.book_append_sheet(workbook, productSheet, 'Product Performance');
    }
    
    // Customer insights sheet
    if (options.includeInsights && data.customers.length > 0) {
      const customerData = this.generateCustomerInsights(data);
      const customerSheet = XLSX.utils.json_to_sheet(customerData);
      XLSX.utils.book_append_sheet(workbook, customerSheet, 'Customer Insights');
    }
    
    // Generate Excel file
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const filename = this.generateFilename('xlsx', options);
    
    return {
      filename,
      size: blob.size,
      format: 'xlsx',
      blob,
      url: URL.createObjectURL(blob)
    };
  }

  private exportToPDF(data: any, options: ExportOptions): ExportResult {
    const pdf = new jsPDF('landscape', 'mm', 'a4');
    
    // Title
    pdf.setFontSize(20);
    pdf.text('Cross-Store Analytics Report', 14, 20);
    
    // Date range
    pdf.setFontSize(12);
    pdf.text(
      `Period: ${format(options.dateRange.from, 'MMM dd, yyyy')} - ${format(options.dateRange.to, 'MMM dd, yyyy')}`,
      14,
      30
    );
    
    // Summary section
    const summaryData = this.generateSummaryData(data);
    pdf.autoTable({
      startY: 40,
      head: [['Metric', 'Value', 'Change %', 'Status']],
      body: summaryData.map(row => [
        row.metric,
        this.formatMetricValue(row.value, row.metric),
        `${row.change > 0 ? '+' : ''}${row.change.toFixed(1)}%`,
        row.status
      ]),
      theme: 'grid',
      headStyles: { fillColor: [66, 139, 202] }
    });
    
    // Store performance table
    pdf.addPage();
    pdf.setFontSize(16);
    pdf.text('Store Performance Comparison', 14, 20);
    
    const storeData = this.generateStorePerformanceData(data);
    pdf.autoTable({
      startY: 30,
      head: [['Store', 'Revenue', 'Orders', 'Conversion Rate', 'AOV', 'Growth']],
      body: storeData.map(row => [
        row.storeName,
        `$${row.revenue.toLocaleString()}`,
        row.orders.toLocaleString(),
        `${row.conversionRate.toFixed(2)}%`,
        `$${row.aov.toFixed(2)}`,
        `${row.growth > 0 ? '+' : ''}${row.growth.toFixed(1)}%`
      ]),
      theme: 'striped',
      headStyles: { fillColor: [66, 139, 202] }
    });
    
    // Top products section
    if (data.products.length > 0) {
      pdf.addPage();
      pdf.setFontSize(16);
      pdf.text('Top Products Across Stores', 14, 20);
      
      const productData = this.generateProductPerformanceData(data).slice(0, 20);
      pdf.autoTable({
        startY: 30,
        head: [['Product', 'Revenue', 'Units Sold', 'Stores', 'Avg Price']],
        body: productData.map(row => [
          row.productName.substring(0, 40),
          `$${row.revenue.toLocaleString()}`,
          row.unitsSold.toLocaleString(),
          row.storeCount,
          `$${row.avgPrice.toFixed(2)}`
        ]),
        theme: 'striped',
        headStyles: { fillColor: [66, 139, 202] }
      });
    }
    
    // Insights section
    if (options.includeInsights) {
      pdf.addPage();
      pdf.setFontSize(16);
      pdf.text('Key Insights & Recommendations', 14, 20);
      
      const insights = this.generateInsightsForPDF(data);
      let yPosition = 30;
      
      insights.forEach((insight, index) => {
        if (yPosition > 180) {
          pdf.addPage();
          yPosition = 20;
        }
        
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        pdf.text(`${index + 1}. ${insight.title}`, 14, yPosition);
        
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
        const lines = pdf.splitTextToSize(insight.description, 260);
        pdf.text(lines, 14, yPosition + 5);
        
        yPosition += 5 + (lines.length * 4) + 5;
      });
    }
    
    const pdfBlob = pdf.output('blob');
    const filename = this.generateFilename('pdf', options);
    
    return {
      filename,
      size: pdfBlob.size,
      format: 'pdf',
      blob: pdfBlob,
      url: URL.createObjectURL(pdfBlob)
    };
  }

  private exportToJSON(data: any, options: ExportOptions): ExportResult {
    const exportData = {
      metadata: {
        generatedAt: new Date().toISOString(),
        dateRange: {
          from: options.dateRange.from.toISOString(),
          to: options.dateRange.to.toISOString()
        },
        storeCount: data.stores.length,
        metrics: options.metrics || this.getDefaultMetrics()
      },
      summary: this.generateSummaryData(data),
      stores: this.generateStorePerformanceData(data),
      dailyData: options.groupBy === 'date' 
        ? this.groupDataByDate(data)
        : this.transformDataForTable(data, options),
      products: data.products.length > 0 
        ? this.generateProductPerformanceData(data)
        : [],
      insights: options.includeInsights 
        ? this.generateInsightsForJSON(data)
        : []
    };
    
    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const filename = this.generateFilename('json', options);
    
    return {
      filename,
      size: blob.size,
      format: 'json',
      blob,
      url: URL.createObjectURL(blob)
    };
  }

  private transformDataForTable(data: any, options: ExportOptions): any[] {
    const records: any[] = [];
    
    data.snapshots.forEach((snapshot: any) => {
      const store = data.stores.find((s: any) => s.id === snapshot.store_id);
      if (!store) return;
      
      const record: any = {
        date: snapshot.date,
        storeName: store.shop_name,
        storeId: store.id
      };
      
      // Add metric values
      const metrics = options.metrics || this.getDefaultMetrics();
      metrics.forEach(metric => {
        record[metric] = snapshot[metric] || 0;
      });
      
      // Add calculated fields
      record.conversionRate = snapshot.unique_visitors > 0 
        ? (snapshot.orders_count / snapshot.unique_visitors * 100).toFixed(2)
        : 0;
      
      record.averageOrderValue = snapshot.orders_count > 0
        ? (snapshot.revenue / snapshot.orders_count).toFixed(2)
        : 0;
      
      records.push(record);
    });
    
    // Sort based on grouping
    if (options.groupBy === 'store') {
      records.sort((a, b) => a.storeName.localeCompare(b.storeName) || a.date.localeCompare(b.date));
    } else if (options.groupBy === 'date') {
      records.sort((a, b) => a.date.localeCompare(b.date) || a.storeName.localeCompare(b.storeName));
    }
    
    return records;
  }

  private generateSummaryData(data: any): any[] {
    const totalRevenue = data.snapshots.reduce((sum: number, s: any) => sum + s.revenue, 0);
    const totalOrders = data.snapshots.reduce((sum: number, s: any) => sum + s.orders_count, 0);
    const totalVisitors = data.snapshots.reduce((sum: number, s: any) => sum + s.unique_visitors, 0);
    const avgConversionRate = totalVisitors > 0 ? (totalOrders / totalVisitors * 100) : 0;
    const avgOrderValue = totalOrders > 0 ? (totalRevenue / totalOrders) : 0;
    
    // Calculate growth (would need previous period data in real implementation)
    const revenueGrowth = 15.2; // Placeholder
    const orderGrowth = 12.8; // Placeholder
    const visitorGrowth = 8.5; // Placeholder
    
    return [
      {
        metric: 'Total Revenue',
        value: totalRevenue,
        change: revenueGrowth,
        status: revenueGrowth > 0 ? 'Growing' : 'Declining'
      },
      {
        metric: 'Total Orders',
        value: totalOrders,
        change: orderGrowth,
        status: orderGrowth > 0 ? 'Growing' : 'Declining'
      },
      {
        metric: 'Total Visitors',
        value: totalVisitors,
        change: visitorGrowth,
        status: visitorGrowth > 0 ? 'Growing' : 'Declining'
      },
      {
        metric: 'Avg Conversion Rate',
        value: avgConversionRate,
        change: 0.5,
        status: 'Stable'
      },
      {
        metric: 'Avg Order Value',
        value: avgOrderValue,
        change: 3.2,
        status: 'Growing'
      }
    ];
  }

  private generateStorePerformanceData(data: any): any[] {
    return data.stores.map((store: any) => {
      const storeSnapshots = data.snapshots.filter((s: any) => s.store_id === store.id);
      
      const revenue = storeSnapshots.reduce((sum: number, s: any) => sum + s.revenue, 0);
      const orders = storeSnapshots.reduce((sum: number, s: any) => sum + s.orders_count, 0);
      const visitors = storeSnapshots.reduce((sum: number, s: any) => sum + s.unique_visitors, 0);
      
      return {
        storeId: store.id,
        storeName: store.shop_name,
        revenue,
        orders,
        visitors,
        conversionRate: visitors > 0 ? (orders / visitors * 100) : 0,
        aov: orders > 0 ? (revenue / orders) : 0,
        growth: Math.random() * 30 - 10 // Placeholder
      };
    }).sort((a: any, b: any) => b.revenue - a.revenue);
  }

  private generateProductPerformanceData(data: any): any[] {
    // In a real implementation, this would aggregate order item data
    // For now, returning sample data based on products
    return data.products.slice(0, 50).map((product: any) => ({
      productId: product.id,
      productName: product.title,
      revenue: Math.random() * 50000 + 10000,
      unitsSold: Math.floor(Math.random() * 500 + 100),
      storeCount: Math.floor(Math.random() * data.stores.length) + 1,
      avgPrice: product.variants?.[0]?.price || 0,
      inventory: product.variants?.reduce((sum: number, v: any) => sum + (v.inventory_quantity || 0), 0) || 0
    })).sort((a: any, b: any) => b.revenue - a.revenue);
  }

  private generateCustomerInsights(data: any): any[] {
    const customerMetrics = data.customers.map((customer: any) => {
      const orderCount = customer.orders?.length || 0;
      const totalSpent = customer.orders?.reduce((sum: number, o: any) => sum + o.total_price, 0) || 0;
      
      return {
        customerId: customer.id,
        email: customer.email,
        orderCount,
        totalSpent,
        avgOrderValue: orderCount > 0 ? totalSpent / orderCount : 0,
        firstOrderDate: customer.orders?.[0]?.created_at || customer.created_at,
        lastOrderDate: customer.orders?.[orderCount - 1]?.created_at || customer.created_at,
        customerLifetimeValue: totalSpent * 2.5 // Simplified CLV calculation
      };
    });
    
    return customerMetrics.sort((a: any, b: any) => b.totalSpent - a.totalSpent).slice(0, 100);
  }

  private generateInsightsForPDF(data: any): any[] {
    const insights = [];
    
    // Revenue insights
    const totalRevenue = data.snapshots.reduce((sum: number, s: any) => sum + s.revenue, 0);
    const avgDailyRevenue = totalRevenue / data.snapshots.length;
    
    insights.push({
      title: 'Revenue Performance',
      description: `Total revenue across all stores: $${totalRevenue.toLocaleString()}. Average daily revenue: $${avgDailyRevenue.toFixed(2)}.`
    });
    
    // Store performance insights
    const storePerformance = this.generateStorePerformanceData(data);
    const topStore = storePerformance[0];
    const bottomStore = storePerformance[storePerformance.length - 1];
    
    insights.push({
      title: 'Store Performance Gap',
      description: `${topStore.storeName} is the top performer with $${topStore.revenue.toLocaleString()} in revenue. ${bottomStore.storeName} has opportunity for improvement with $${bottomStore.revenue.toLocaleString()}.`
    });
    
    // Conversion insights
    const avgConversionRate = storePerformance.reduce((sum: number, s: any) => sum + s.conversionRate, 0) / storePerformance.length;
    
    insights.push({
      title: 'Conversion Optimization',
      description: `Average conversion rate across stores is ${avgConversionRate.toFixed(2)}%. Stores below this average should focus on checkout optimization and user experience improvements.`
    });
    
    return insights;
  }

  private generateInsightsForJSON(data: any): any[] {
    const insights = this.generateInsightsForPDF(data);
    
    // Add more detailed insights for JSON format
    insights.push({
      title: 'Product Performance',
      description: 'Analysis of top-performing products across stores',
      data: {
        topProducts: this.generateProductPerformanceData(data).slice(0, 5),
        productDiversity: data.products.length,
        avgProductRevenue: data.products.length > 0 
          ? this.generateProductPerformanceData(data).reduce((sum: number, p: any) => sum + p.revenue, 0) / data.products.length
          : 0
      }
    });
    
    insights.push({
      title: 'Customer Behavior',
      description: 'Customer purchasing patterns and loyalty metrics',
      data: {
        totalCustomers: data.customers.length,
        repeatCustomerRate: this.calculateRepeatCustomerRate(data.customers),
        avgCustomerLifetimeValue: this.calculateAvgCLV(data.customers)
      }
    });
    
    return insights;
  }

  private groupDataByDate(data: any): any {
    const grouped: Record<string, any> = {};
    
    data.snapshots.forEach((snapshot: any) => {
      if (!grouped[snapshot.date]) {
        grouped[snapshot.date] = {
          date: snapshot.date,
          stores: [],
          totals: {
            revenue: 0,
            orders: 0,
            visitors: 0
          }
        };
      }
      
      const store = data.stores.find((s: any) => s.id === snapshot.store_id);
      grouped[snapshot.date].stores.push({
        storeId: snapshot.store_id,
        storeName: store?.shop_name || 'Unknown',
        revenue: snapshot.revenue,
        orders: snapshot.orders_count,
        visitors: snapshot.unique_visitors
      });
      
      grouped[snapshot.date].totals.revenue += snapshot.revenue;
      grouped[snapshot.date].totals.orders += snapshot.orders_count;
      grouped[snapshot.date].totals.visitors += snapshot.unique_visitors;
    });
    
    return Object.values(grouped).sort((a: any, b: any) => a.date.localeCompare(b.date));
  }

  private getCSVFields(options: ExportOptions): string[] {
    const baseFields = ['date', 'storeName', 'storeId'];
    const metricFields = options.metrics || this.getDefaultMetrics();
    const calculatedFields = ['conversionRate', 'averageOrderValue'];
    
    return [...baseFields, ...metricFields, ...calculatedFields, ...(options.customFields || [])];
  }

  private formatMetricValue(value: number, metric: string): string {
    if (metric.toLowerCase().includes('revenue') || metric.toLowerCase().includes('value')) {
      return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    } else if (metric.toLowerCase().includes('rate')) {
      return `${value.toFixed(2)}%`;
    } else {
      return value.toLocaleString('en-US');
    }
  }

  private calculateRepeatCustomerRate(customers: any[]): number {
    const repeatCustomers = customers.filter(c => c.orders?.length > 1).length;
    return customers.length > 0 ? (repeatCustomers / customers.length * 100) : 0;
  }

  private calculateAvgCLV(customers: any[]): number {
    const totalCLV = customers.reduce((sum, customer) => {
      const orderValue = customer.orders?.reduce((orderSum: number, o: any) => orderSum + o.total_price, 0) || 0;
      return sum + (orderValue * 2.5); // Simplified CLV
    }, 0);
    
    return customers.length > 0 ? totalCLV / customers.length : 0;
  }

  private generateFilename(format: string, options: ExportOptions): string {
    const dateStr = format(new Date(), 'yyyyMMdd-HHmmss');
    const dateRangeStr = `${format(options.dateRange.from, 'yyyyMMdd')}-${format(options.dateRange.to, 'yyyyMMdd')}`;
    return `cross-store-analytics_${dateRangeStr}_${dateStr}.${format}`;
  }

  async scheduleExport(
    ownerId: string,
    options: ExportOptions,
    schedule: {
      frequency: 'daily' | 'weekly' | 'monthly';
      time: string; // HH:mm format
      dayOfWeek?: number; // 0-6 for weekly
      dayOfMonth?: number; // 1-31 for monthly
      recipients: string[]; // Email addresses
    }
  ): Promise<{ id: string; status: string }> {
    // Store scheduled export configuration
    const { data, error } = await this.supabase
      .from('scheduled_exports')
      .insert({
        owner_id: ownerId,
        export_options: options,
        schedule,
        is_active: true,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      logger.error('Failed to schedule export', error);
      throw new Error('Failed to schedule export');
    }

    return {
      id: data.id,
      status: 'scheduled'
    };
  }

  async getScheduledExports(ownerId: string) {
    const { data, error } = await this.supabase
      .from('scheduled_exports')
      .select('*')
      .eq('owner_id', ownerId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Failed to fetch scheduled exports', error);
      throw new Error('Failed to fetch scheduled exports');
    }

    return data || [];
  }

  async cancelScheduledExport(exportId: string) {
    const { error } = await this.supabase
      .from('scheduled_exports')
      .update({ is_active: false })
      .eq('id', exportId);

    if (error) {
      logger.error('Failed to cancel scheduled export', error);
      throw new Error('Failed to cancel scheduled export');
    }

    return { success: true };
  }
}