import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TenantService } from '../services/tenant.service';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly tenantService: TenantService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const tenantId = req.headers['x-tenant-id'] as string;
    
    if (!tenantId) {
      throw new ForbiddenException('Tenant ID is required');
    }

    // Validate tenant exists and is active
    const tenant = await this.tenantService.validateTenant(tenantId);
    
    if (!tenant || !tenant.isActive) {
      throw new ForbiddenException('Invalid or inactive tenant');
    }

    // Set tenant context
    req['tenant'] = tenant;
    
    // Switch database connection for this request
    await this.tenantService.setTenantConnection(tenantId);
    
    next();
  }
}
