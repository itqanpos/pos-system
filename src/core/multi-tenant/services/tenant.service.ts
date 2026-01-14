import { Injectable, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';

export interface Tenant {
  id: string;
  name: string;
  subdomain: string;
  databaseName: string;
  isActive: boolean;
  plan: string;
  createdAt: Date;
}

@Injectable()
export class TenantService implements OnModuleInit {
  private tenants: Map<string, DataSource> = new Map();
  private mainDataSource: DataSource;

  constructor() {
    this.mainDataSource = new DataSource({
      type: 'mysql',
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: 'tenants_master',
      entities: [__dirname + '/../entities/*.entity{.ts,.js}'],
      synchronize: process.env.NODE_ENV === 'development',
    });
  }

  async onModuleInit() {
    await this.mainDataSource.initialize();
  }

  async createTenant(tenantData: Partial<Tenant>) {
    const tenantId = `tenant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const dbName = `tenant_${tenantId}`;
    
    // Create new database
    await this.mainDataSource.query(`CREATE DATABASE IF NOT EXISTS ${dbName}`);
    
    // Initialize tenant schema
    const tenantDataSource = new DataSource({
      type: 'mysql',
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: dbName,
      entities: [__dirname + '/../../**/*.entity{.ts,.js}'],
      synchronize: true, // In production, use migrations
    });
    
    await tenantDataSource.initialize();
    await this.runTenantMigrations(tenantDataSource);
    
    // Save tenant info in master DB
    const tenant: Tenant = {
      id: tenantId,
      name: tenantData.name,
      subdomain: tenantData.subdomain,
      databaseName: dbName,
      isActive: true,
      plan: 'starter',
      createdAt: new Date(),
    };
    
    await this.saveTenantToMaster(tenant);
    this.tenants.set(tenantId, tenantDataSource);
    
    return tenant;
  }

  async validateTenant(tenantId: string): Promise<Tenant> {
    // Query from master database
    const [tenant] = await this.mainDataSource.query(
      'SELECT * FROM tenants WHERE id = ?',
      [tenantId]
    );
    
    return tenant;
  }

  async setTenantConnection(tenantId: string) {
    if (!this.tenants.has(tenantId)) {
      const tenant = await this.validateTenant(tenantId);
      const dataSource = new DataSource({
        type: 'mysql',
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT),
        username: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: tenant.databaseName,
        entities: [__dirname + '/../../**/*.entity{.ts,.js}'],
      });
      
      await dataSource.initialize();
      this.tenants.set(tenantId, dataSource);
    }
    
    return this.tenants.get(tenantId);
  }

  private async runTenantMigrations(dataSource: DataSource) {
    // Run base schema for tenant
    const queries = [
      `CREATE TABLE IF NOT EXISTS companies (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        logo TEXT,
        currency VARCHAR(10) DEFAULT 'SAR',
        vat_rate DECIMAL(5,2) DEFAULT 15.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )`,
      
      `CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(36) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role ENUM('admin', 'manager', 'cashier', 'accountant') DEFAULT 'cashier',
        branch_id VARCHAR(36),
        is_active BOOLEAN DEFAULT TRUE,
        last_login TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      
      `CREATE TABLE IF NOT EXISTS products (
        id VARCHAR(36) PRIMARY KEY,
        sku VARCHAR(100) UNIQUE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        barcode VARCHAR(100),
        category_id VARCHAR(36),
        cost_price DECIMAL(15,2),
        selling_price DECIMAL(15,2),
        stock DECIMAL(10,2) DEFAULT 0,
        min_stock DECIMAL(10,2) DEFAULT 5,
        unit VARCHAR(50),
        is_active BOOLEAN DEFAULT TRUE,
        has_vat BOOLEAN DEFAULT TRUE,
        image_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_sku (sku),
        INDEX idx_barcode (barcode),
        INDEX idx_category (category_id)
      )`
    ];
    
    for (const query of queries) {
      await dataSource.query(query);
    }
  }
}
