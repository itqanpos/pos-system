import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum AccountType {
  ASSET = 'asset',
  LIABILITY = 'liability',
  EQUITY = 'equity',
  REVENUE = 'revenue',
  EXPENSE = 'expense'
}

export enum AccountCategory {
  CURRENT_ASSET = 'current_asset',
  FIXED_ASSET = 'fixed_asset',
  CURRENT_LIABILITY = 'current_liability',
  LONG_TERM_LIABILITY = 'long_term_liability',
  EQUITY = 'equity',
  REVENUE = 'revenue',
  COST_OF_SALES = 'cost_of_sales',
  EXPENSE = 'expense'
}

@Entity('accounts')
export class Account {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  code: string;

  @Column()
  name: string;

  @Column({ type: 'enum', enum: AccountType })
  type: AccountType;

  @Column({ type: 'enum', enum: AccountCategory })
  category: AccountCategory;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  openingBalance: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  currentBalance: number;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  isSystemAccount: boolean;

  @Column({ nullable: true })
  parentAccountId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
