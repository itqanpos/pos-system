import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository, LessThanOrEqual } from 'typeorm';
import { Invoice } from '../../pos/entities/invoice.entity';
import { Product } from '../../inventory/entities/product.entity';
import { Customer } from '../../crm/entities/customer.entity';

interface SalesReport {
  totalSales: number;
  totalTransactions: number;
  averageTransactionValue: number;
  byPaymentMethod: Array<{ method: string; amount: number; percentage: number }>;
  byHour: Array<{ hour: number; sales: number }>;
  topProducts: Array<{ product: string; quantity: number; revenue: number }>;
}

interface InventoryReport {
  totalValue: number;
  totalItems: number;
  lowStock: Array<{ product: string; current: number; minimum: number }>;
  slowMoving: Array<{ product: string; lastSold: Date; daysInStock: number }>;
  valuation: {
    fifo: number;
    average: number;
    lifo: number;
  };
}

interface CustomerAnalytics {
  totalCustomers: number;
  activeCustomers: number;
  newCustomers: number;
  topCustomers: Array<{ customer: string; purchases: number; value: number }>;
  churnRate: number;
  averageCustomerValue: number;
}

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Invoice)
    private invoiceRepo: Repository<Invoice>,
    @InjectRepository(Product)
    private productRepo: Repository<Product>,
    @InjectRepository(Customer)
    private customerRepo: Repository<Customer>,
  ) {}

  async generateSalesReport(fromDate: Date, toDate: Date): Promise<SalesReport> {
    const invoices = await this.invoiceRepo.find({
      where: {
        createdAt: Between(fromDate, toDate),
        status: 'completed',
      },
      relations: ['items'],
    });

    const totalSales = invoices.reduce((sum, inv) => sum + inv.total, 0);
    const totalTransactions = invoices.length;
    const averageTransactionValue = totalTransactions > 0 ? totalSales / totalTransactions : 0;

    // Payment method breakdown
    const paymentMethods = new Map<string, number>();
    invoices.forEach(inv => {
      inv.paymentMethods?.forEach(pm => {
        paymentMethods.set(pm.method, (paymentMethods.get(pm.method) || 0) + pm.amount);
      });
    });

    const byPaymentMethod = Array.from(paymentMethods.entries()).map(([method, amount]) => ({
      method,
      amount,
      percentage: (amount / totalSales) * 100,
    }));

    // Sales by hour
    const byHour = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      sales: invoices
        .filter(inv => inv.createdAt.getHours() === hour)
        .reduce((sum, inv) => sum + inv.total, 0),
    }));

    // Top products
    const productSales = new Map<string, { quantity: number; revenue: number }>();
    invoices.forEach(inv => {
      inv.items?.forEach(item => {
        const current = productSales.get(item.productId) || { quantity: 0, revenue: 0 };
        current.quantity += item.quantity;
        current.revenue += item.total;
        productSales.set(item.productId, current);
      });
    });

    const topProducts = Array.from(productSales.entries())
      .map(([productId, data]) => ({
        product: productId, // In real app, join with product name
        ...data,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    return {
      totalSales,
      totalTransactions,
      averageTransactionValue,
      byPaymentMethod,
      byHour,
      topProducts,
    };
  }

  async generateInventoryReport(): Promise<InventoryReport> {
    const products = await this.productRepo.find();
    
    const totalValue = products.reduce((sum, product) => {
      return sum + (product.costPrice * product.stock);
    }, 0);

    const lowStock = products
      .filter(p => p.stock <= p.minStock)
      .map(p => ({
        product: p.name,
        current: p.stock,
        minimum: p.minStock,
      }));

    // Get last sale date for each product
    const slowMoving = [];
    for (const product of products) {
      const lastInvoice = await this.invoiceRepo.findOne({
        where: {
          items: { productId: product.id },
          status: 'completed',
        },
        order: { createdAt: 'DESC' },
      });

      if (lastInvoice) {
        const daysInStock = Math.floor(
          (new Date().getTime() - lastInvoice.createdAt.getTime()) / (1000 * 60 * 60 * 24)
        );
        
        if (daysInStock > 30) { // 30 days threshold
          slowMoving.push({
            product: product.name,
            lastSold: lastInvoice.createdAt,
            daysInStock,
          });
        }
      }
    }

    return {
      totalValue,
      totalItems: products.length,
      lowStock,
      slowMoving: slowMoving.sort((a, b) => b.daysInStock - a.daysInStock).slice(0, 10),
      valuation: {
        fifo: await this.calculateFIFOValuation(),
        average: totalValue / products.filter(p => p.stock > 0).length || 0,
        lifo: await this.calculateLIFOValuation(),
      },
    };
  }

  async predictSales(period: 'daily' | 'weekly' | 'monthly', days: number = 30) {
    // Get historical data
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 365); // Last year

    const invoices = await this.invoiceRepo.find({
      where: {
        createdAt: Between(startDate, endDate),
        status: 'completed',
      },
    });

    // Simple moving average prediction
    const salesByDay = new Map<string, number>();
    invoices.forEach(inv => {
      const dateStr = inv.createdAt.toISOString().split('T')[0];
      salesByDay.set(dateStr, (salesByDay.get(dateStr) || 0) + inv.total);
    });

    const salesArray = Array.from(salesByDay.values());
    const windowSize = period === 'daily' ? 7 : period === 'weekly' ? 4 : 3;
    
    const predictions = [];
    for (let i = 0; i < days; i++) {
      const start = Math.max(0, salesArray.length - windowSize);
      const recentSales = salesArray.slice(start);
      const average = recentSales.reduce((a, b) => a + b, 0) / recentSales.length;
      
      predictions.push({
        date: new Date(Date.now() + i * 24 * 60 * 60 * 1000),
        predictedSales: average || 0,
        confidence: recentSales.length > 0 ? 0.8 : 0.5,
      });
    }

    return predictions;
  }

  private async calculateFIFOValuation(): Promise<number> {
    // Implement FIFO valuation logic
    return 0;
  }

  private async calculateLIFOValuation(): Promise<number> {
    // Implement LIFO valuation logic
    return 0;
  }
}
