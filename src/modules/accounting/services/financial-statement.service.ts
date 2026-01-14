import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { JournalEntry } from '../entities/journal-entry.entity';
import { Account, AccountType } from '../entities/account.entity';

interface ProfitLossStatement {
  revenue: Array<{ account: string; amount: number }>;
  costOfSales: Array<{ account: string; amount: number }>;
  expenses: Array<{ account: string; amount: number }>;
  grossProfit: number;
  netProfit: number;
  period: { from: Date; to: Date };
}

interface BalanceSheet {
  assets: {
    currentAssets: Array<{ account: string; amount: number }>;
    fixedAssets: Array<{ account: string; amount: number }>;
    totalAssets: number;
  };
  liabilities: {
    currentLiabilities: Array<{ account: string; amount: number }>;
    longTermLiabilities: Array<{ account: string; amount: number }>;
    totalLiabilities: number;
  };
  equity: Array<{ account: string; amount: number }>;
  totalEquity: number;
  date: Date;
}

@Injectable()
export class FinancialStatementService {
  constructor(
    @InjectRepository(JournalEntry)
    private journalRepo: Repository<JournalEntry>,
    @InjectRepository(Account)
    private accountRepo: Repository<Account>,
  ) {}

  async generateProfitLoss(fromDate: Date, toDate: Date): Promise<ProfitLossStatement> {
    const accounts = await this.accountRepo.find({
      where: [
        { type: AccountType.REVENUE },
        { type: AccountType.EXPENSE },
      ],
    });

    const journalEntries = await this.journalRepo.find({
      where: {
        date: Between(fromDate, toDate),
      },
      relations: ['entries'],
    });

    const revenue = [];
    const expenses = [];
    const costOfSales = [];

    let totalRevenue = 0;
    let totalCostOfSales = 0;
    let totalExpenses = 0;

    for (const account of accounts) {
      let balance = 0;
      
      for (const entry of journalEntries) {
        const accountEntry = entry.entries.find(e => e.accountCode === account.code);
        if (accountEntry) {
          if (account.type === AccountType.REVENUE) {
            balance += accountEntry.credit - accountEntry.debit;
          } else {
            balance += accountEntry.debit - accountEntry.credit;
          }
        }
      }

      if (balance !== 0) {
        const item = { account: account.name, amount: Math.abs(balance) };
        
        if (account.type === AccountType.REVENUE) {
          revenue.push(item);
          totalRevenue += balance;
        } else if (account.category === 'cost_of_sales') {
          costOfSales.push(item);
          totalCostOfSales += balance;
        } else {
          expenses.push(item);
          totalExpenses += balance;
        }
      }
    }

    const grossProfit = totalRevenue - totalCostOfSales;
    const netProfit = grossProfit - totalExpenses;

    return {
      revenue,
      costOfSales,
      expenses,
      grossProfit,
      netProfit,
      period: { from: fromDate, to: toDate },
    };
  }

  async generateBalanceSheet(asOfDate: Date): Promise<BalanceSheet> {
    const accounts = await this.accountRepo.find();
    const journalEntries = await this.journalRepo.find({
      where: { date: Between(new Date(0), asOfDate) },
      relations: ['entries'],
    });

    const currentAssets = [];
    const fixedAssets = [];
    const currentLiabilities = [];
    const longTermLiabilities = [];
    const equity = [];

    let totalCurrentAssets = 0;
    let totalFixedAssets = 0;
    let totalCurrentLiabilities = 0;
    let totalLongTermLiabilities = 0;
    let totalEquity = 0;

    for (const account of accounts) {
      let balance = account.openingBalance;
      
      for (const entry of journalEntries) {
        const accountEntry = entry.entries.find(e => e.accountCode === account.code);
        if (accountEntry) {
          if (account.type === AccountType.ASSET || account.type === AccountType.EXPENSE) {
            balance += accountEntry.debit - accountEntry.credit;
          } else {
            balance += accountEntry.credit - accountEntry.debit;
          }
        }
      }

      const item = { account: account.name, amount: balance };

      switch (account.category) {
        case 'current_asset':
          currentAssets.push(item);
          totalCurrentAssets += balance;
          break;
        case 'fixed_asset':
          fixedAssets.push(item);
          totalFixedAssets += balance;
          break;
        case 'current_liability':
          currentLiabilities.push(item);
          totalCurrentLiabilities += balance;
          break;
        case 'long_term_liability':
          longTermLiabilities.push(item);
          totalLongTermLiabilities += balance;
          break;
        case 'equity':
          equity.push(item);
          totalEquity += balance;
          break;
      }
    }

    const totalAssets = totalCurrentAssets + totalFixedAssets;
    const totalLiabilities = totalCurrentLiabilities + totalLongTermLiabilities;

    return {
      assets: {
        currentAssets,
        fixedAssets,
        totalAssets,
      },
      liabilities: {
        currentLiabilities,
        longTermLiabilities,
        totalLiabilities,
      },
      equity,
      totalEquity,
      date: asOfDate,
    };
  }

  async generateTrialBalance(date: Date) {
    const accounts = await this.accountRepo.find();
    const journalEntries = await this.journalRepo.find({
      where: { date: Between(new Date(0), date) },
      relations: ['entries'],
    });

    const trialBalance = accounts.map(account => {
      let debit = account.openingBalance > 0 ? account.openingBalance : 0;
      let credit = account.openingBalance < 0 ? Math.abs(account.openingBalance) : 0;
      
      for (const entry of journalEntries) {
        const accountEntry = entry.entries.find(e => e.accountCode === account.code);
        if (accountEntry) {
          debit += accountEntry.debit;
          credit += accountEntry.credit;
        }
      }

      return {
        accountCode: account.code,
        accountName: account.name,
        debit,
        credit,
        balance: debit - credit,
      };
    });

    const totalDebit = trialBalance.reduce((sum, item) => sum + item.debit, 0);
    const totalCredit = trialBalance.reduce((sum, item) => sum + item.credit, 0);

    return {
      trialBalance,
      totals: { debit: totalDebit, credit: totalCredit },
      isBalanced: totalDebit === totalCredit,
      date,
    };
  }
}
