import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, ManyToOne } from 'typeorm';
import { InvoiceItem } from './invoice-item.entity';
import { Customer } from '../../crm/entities/customer.entity';

export enum InvoiceStatus {
  DRAFT = 'draft',
  PENDING = 'pending',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  HOLD = 'hold',
  REFUNDED = 'refunded',
  PARTIALLY_REFUNDED = 'partially_refunded'
}

export enum PaymentStatus {
  UNPAID = 'unpaid',
  PARTIALLY_PAID = 'partially_paid',
  PAID = 'paid',
  OVERPAID = 'overpaid'
}

@Entity('invoices')
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  invoiceNumber: string;

  @Column({ type: 'enum', enum: InvoiceStatus, default: InvoiceStatus.DRAFT })
  status: InvoiceStatus;

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.UNPAID })
  paymentStatus: PaymentStatus;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  subtotal: number;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  taxAmount: number;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  discountAmount: number;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  total: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  amountPaid: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  balance: number;

  @ManyToOne(() => Customer, { nullable: true })
  customer: Customer;

  @Column({ nullable: true })
  customerName: string;

  @Column({ nullable: true })
  customerPhone: string;

  @Column({ type: 'json', nullable: true })
  paymentMethods: Array<{
    method: string;
    amount: number;
    reference?: string;
  }>;

  @Column({ type: 'json', nullable: true })
  taxes: Array<{
    name: string;
    rate: number;
    amount: number;
  }>;

  @OneToMany(() => InvoiceItem, item => item.invoice, { cascade: true })
  items: InvoiceItem[];

  @Column({ nullable: true })
  branchId: string;

  @Column({ nullable: true })
  cashierId: string;

  @Column({ nullable: true })
  notes: string;

  @Column({ type: 'boolean', default: false })
  isReturn: boolean;

  @Column({ nullable: true })
  originalInvoiceId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  syncedAt: Date;

  @Column({ type: 'boolean', default: false })
  isSynced: boolean;

  // Helper methods
  calculateTotals() {
    this.subtotal = this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    // Calculate taxes
    this.taxAmount = this.items.reduce((sum, item) => {
      if (item.hasVat) {
        return sum + (item.price * item.quantity * 0.15); // 15% VAT
      }
      return sum;
    }, 0);
    
    this.total = this.subtotal + this.taxAmount - this.discountAmount;
    this.balance = this.total - this.amountPaid;
    
    // Update payment status
    if (this.amountPaid === 0) {
      this.paymentStatus = PaymentStatus.UNPAID;
    } else if (this.amountPaid < this.total) {
      this.paymentStatus = PaymentStatus.PARTIALLY_PAID;
    } else if (this.amountPaid === this.total) {
      this.paymentStatus = PaymentStatus.PAID;
    } else {
      this.paymentStatus = PaymentStatus.OVERPAID;
    }
  }
}
