import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Invoice, InvoiceStatus, PaymentStatus } from '../entities/invoice.entity';
import { InvoiceItem } from '../entities/invoice-item.entity';
import { Product } from '../../inventory/entities/product.entity';
import { StockMovement } from '../../inventory/entities/stock-movement.entity';
import { Customer } from '../../crm/entities/customer.entity';
import { AccountingService } from '../../accounting/services/accounting.service';

@Injectable()
export class PosService {
  constructor(
    @InjectRepository(Invoice)
    private invoiceRepo: Repository<Invoice>,
    @InjectRepository(Product)
    private productRepo: Repository<Product>,
    @InjectRepository(Customer)
    private customerRepo: Repository<Customer>,
    private dataSource: DataSource,
    private accountingService: AccountingService,
  ) {}

  async createInvoice(invoiceData: Partial<Invoice>, items: any[]) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Generate invoice number
      const invoiceNumber = await this.generateInvoiceNumber();
      
      // Create invoice
      const invoice = this.invoiceRepo.create({
        ...invoiceData,
        invoiceNumber,
        status: InvoiceStatus.PENDING,
      });

      // Add items
      const invoiceItems = [];
      for (const itemData of items) {
        const product = await this.productRepo.findOne({
          where: { id: itemData.productId },
          lock: { mode: 'pessimistic_write' }
        });

        if (!product) {
          throw new BadRequestException(`Product ${itemData.productId} not found`);
        }

        if (product.stock < itemData.quantity) {
          throw new BadRequestException(`Insufficient stock for ${product.name}`);
        }

        // Update product stock
        product.stock -= itemData.quantity;
        await queryRunner.manager.save(product);

        // Create stock movement
        const movement = new StockMovement();
        movement.productId = product.id;
        movement.quantity = -itemData.quantity;
        movement.type = 'sale';
        movement.reference = invoiceNumber;
        movement.branchId = invoiceData.branchId;
        await queryRunner.manager.save(movement);

        // Create invoice item
        const invoiceItem = new InvoiceItem();
        invoiceItem.productId = product.id;
        invoiceItem.productName = product.name;
        invoiceItem.price = itemData.price || product.sellingPrice;
        invoiceItem.quantity = itemData.quantity;
        invoiceItem.total = itemData.price * itemData.quantity;
        invoiceItem.hasVat = product.hasVat;
        invoiceItem.invoice = invoice;
        
        invoiceItems.push(invoiceItem);
      }

      invoice.items = invoiceItems;
      invoice.calculateTotals();
      
      const savedInvoice = await queryRunner.manager.save(invoice);
      
      // Create accounting entries
      await this.accountingService.createJournalEntry({
        date: new Date(),
        description: `Invoice ${invoiceNumber}`,
        entries: [
          {
            accountCode: '1100', // Cash/Bank
            debit: invoice.total,
            credit: 0,
          },
          {
            accountCode: '4000', // Sales
            debit: 0,
            credit: invoice.subtotal,
          },
          {
            accountCode: '2200', // VAT Payable
            debit: 0,
            credit: invoice.taxAmount,
          }
        ],
        reference: invoiceNumber,
      });

      await queryRunner.commitTransaction();
      
      return {
        success: true,
        invoice: savedInvoice,
        receipt: this.generateReceipt(savedInvoice),
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async processPayment(invoiceId: string, payments: any[]) {
    const invoice = await this.invoiceRepo.findOne({
      where: { id: invoiceId },
      relations: ['customer'],
    });

    if (!invoice) {
      throw new BadRequestException('Invoice not found');
    }

    const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);
    invoice.amountPaid = totalPaid;
    invoice.paymentMethods = payments;
    invoice.calculateTotals();

    if (totalPaid >= invoice.total) {
      invoice.status = InvoiceStatus.COMPLETED;
      invoice.paymentStatus = PaymentStatus.PAID;
      
      // Update customer balance if exists
      if (invoice.customer) {
        invoice.customer.balance += invoice.total;
        await this.customerRepo.save(invoice.customer);
      }
    }

    const updatedInvoice = await this.invoiceRepo.save(invoice);
    
    // Print receipt
    this.printReceipt(updatedInvoice);
    
    return updatedInvoice;
  }

  async holdInvoice(invoiceId: string) {
    return this.invoiceRepo.update(invoiceId, {
      status: InvoiceStatus.HOLD,
      updatedAt: new Date(),
    });
  }

  async returnInvoice(originalInvoiceId: string, returnItems: any[]) {
    const originalInvoice = await this.invoiceRepo.findOne({
      where: { id: originalInvoiceId },
      relations: ['items'],
    });

    const returnInvoice = new Invoice();
    returnInvoice.isReturn = true;
    returnInvoice.originalInvoiceId = originalInvoiceId;
    returnInvoice.status = InvoiceStatus.COMPLETED;
    returnInvoice.invoiceNumber = `RET-${originalInvoice.invoiceNumber}`;
    
    // Process return items and restock
    for (const returnItem of returnItems) {
      const originalItem = originalInvoice.items.find(
        item => item.productId === returnItem.productId
      );

      if (originalItem) {
        // Restock product
        const product = await this.productRepo.findOne({
          where: { id: returnItem.productId },
        });
        
        if (product) {
          product.stock += returnItem.quantity;
          await this.productRepo.save(product);
        }
      }
    }

    return this.invoiceRepo.save(returnInvoice);
  }

  private async generateInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
    const prefix = `INV-${year}${month}`;
    
    const lastInvoice = await this.invoiceRepo.findOne({
      where: { invoiceNumber: new RegExp(`^${prefix}`) },
      order: { createdAt: 'DESC' },
    });

    let sequence = 1;
    if (lastInvoice) {
      const lastSeq = parseInt(lastInvoice.invoiceNumber.split('-').pop());
      sequence = lastSeq + 1;
    }

    return `${prefix}-${sequence.toString().padStart(5, '0')}`;
  }

  private generateReceipt(invoice: Invoice) {
    return {
      invoiceNumber: invoice.invoiceNumber,
      date: invoice.createdAt,
      items: invoice.items.map(item => ({
        name: item.productName,
        quantity: item.quantity,
        price: item.price,
        total: item.total,
      })),
      subtotal: invoice.subtotal,
      taxAmount: invoice.taxAmount,
      discountAmount: invoice.discountAmount,
      total: invoice.total,
      amountPaid: invoice.amountPaid,
      balance: invoice.balance,
      thankYouMessage: 'Thank you for your business!',
    };
  }

  private async printReceipt(invoice: Invoice) {
    // Integrate with thermal printer or PDF generation
    console.log('Printing receipt:', invoice.invoiceNumber);
  }
}
