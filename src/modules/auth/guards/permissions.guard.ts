import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

export enum Permission {
  // POS Permissions
  CREATE_INVOICE = 'create_invoice',
  EDIT_INVOICE = 'edit_invoice',
  DELETE_INVOICE = 'delete_invoice',
  PROCESS_RETURN = 'process_return',
  HOLD_INVOICE = 'hold_invoice',
  EDIT_PRICE = 'edit_price',
  
  // Inventory Permissions
  VIEW_PRODUCTS = 'view_products',
  CREATE_PRODUCT = 'create_product',
  EDIT_PRODUCT = 'edit_product',
  DELETE_PRODUCT = 'delete_product',
  VIEW_STOCK = 'view_stock',
  UPDATE_STOCK = 'update_stock',
  
  // Accounting Permissions
  VIEW_ACCOUNTS = 'view_accounts',
  CREATE_ACCOUNT = 'create_account',
  VIEW_REPORTS = 'view_reports',
  PROCESS_PAYMENT = 'process_payment',
  VIEW_FINANCIALS = 'view_financials',
  
  // Customer Permissions
  VIEW_CUSTOMERS = 'view_customers',
  CREATE_CUSTOMER = 'create_customer',
  EDIT_CUSTOMER = 'edit_customer',
  DELETE_CUSTOMER = 'delete_customer',
  
  // Admin Permissions
  MANAGE_USERS = 'manage_users',
  MANAGE_ROLES = 'manage_roles',
  MANAGE_SETTINGS = 'manage_settings',
  VIEW_AUDIT_LOGS = 'view_audit_logs',
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    const hasPermission = requiredPermissions.every(permission => 
      user.permissions?.includes(permission)
    );

    if (!hasPermission) {
      throw new ForbiddenException(
        `Insufficient permissions. Required: ${requiredPermissions.join(', ')}`
      );
    }

    return true;
  }
}
