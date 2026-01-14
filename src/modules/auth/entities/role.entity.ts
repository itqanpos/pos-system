import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Permission } from '../guards/permissions.guard';

@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ type: 'json', default: [] })
  permissions: Permission[];

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  isSystemRole: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Predefined roles
  static readonly ADMIN = 'admin';
  static readonly MANAGER = 'manager';
  static readonly CASHIER = 'cashier';
  static readonly ACCOUNTANT = 'accountant';
  static readonly INVENTORY_MANAGER = 'inventory_manager';

  static getDefaultPermissions(roleName: string): Permission[] {
    const permissions: Record<string, Permission[]> = {
      [Role.ADMIN]: Object.values(Permission),
      [Role.MANAGER]: [
        Permission.VIEW_PRODUCTS,
        Permission.CREATE_PRODUCT,
        Permission.EDIT_PRODUCT,
        Permission.VIEW_STOCK,
        Permission.UPDATE_STOCK,
        Permission.CREATE_INVOICE,
        Permission.EDIT_INVOICE,
        Permission.PROCESS_RETURN,
        Permission.HOLD_INVOICE,
        Permission.EDIT_PRICE,
        Permission.VIEW_CUSTOMERS,
        Permission.CREATE_CUSTOMER,
        Permission.EDIT_CUSTOMER,
        Permission.VIEW_REPORTS,
        Permission.PROCESS_PAYMENT,
      ],
      [Role.CASHIER]: [
        Permission.VIEW_PRODUCTS,
        Permission.CREATE_INVOICE,
        Permission.PROCESS_RETURN,
        Permission.HOLD_INVOICE,
        Permission.VIEW_CUSTOMERS,
        Permission.CREATE_CUSTOMER,
        Permission.PROCESS_PAYMENT,
      ],
      [Role.ACCOUNTANT]: [
        Permission.VIEW_ACCOUNTS,
        Permission.VIEW_REPORTS,
        Permission.VIEW_FINANCIALS,
        Permission.PROCESS_PAYMENT,
        Permission.VIEW_CUSTOMERS,
      ],
      [Role.INVENTORY_MANAGER]: [
        Permission.VIEW_PRODUCTS,
        Permission.CREATE_PRODUCT,
        Permission.EDIT_PRODUCT,
        Permission.DELETE_PRODUCT,
        Permission.VIEW_STOCK,
        Permission.UPDATE_STOCK,
      ],
    };

    return permissions[roleName] || [];
  }
}
