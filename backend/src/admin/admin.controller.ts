import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { AdminService } from './admin.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';

/** Admin dashboard read endpoints (RBAC: ADMIN only). */
@ApiTags('admin')
@Roles(Role.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  /** Headline metrics + recent orders + top products. */
  @Get('overview')
  getOverview() {
    return this.admin.getOverview();
  }

  /** Sales/orders/signups time series for the selected window. */
  @Get('analytics')
  getAnalytics(@Query() query: AnalyticsQueryDto) {
    return this.admin.getAnalytics(query);
  }

  /** Paginated audit trail (newest first; filter by entity/actor). */
  @Get('audit-logs')
  getAuditLogs(@Query() query: AuditLogQueryDto) {
    return this.admin.listAuditLogs(query);
  }
}
