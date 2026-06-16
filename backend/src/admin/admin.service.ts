import { Injectable } from '@nestjs/common';
import { OrderStatus, Prisma, Role } from '@prisma/client';
import { Paginated, paginate } from '../common/interfaces/api-response.interface';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsQueryDto, AnalyticsRange } from './dto/analytics-query.dto';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';

/** Order statuses that represent realized revenue. */
const REVENUE_STATUSES: OrderStatus[] = [
  OrderStatus.PAID,
  OrderStatus.PRINTING,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
];

export interface RecentOrder {
  id: string;
  orderNumber: string;
  email: string;
  status: OrderStatus;
  totalCents: number;
  createdAt: Date;
}

export interface TopProduct {
  id: string;
  name: string;
  slug: string;
  priceCents: number;
  salesCount: number;
}

export interface OverviewResult {
  revenueCents: number;
  orderCount: number;
  paidOrderCount: number;
  userCount: number;
  lowStockCount: number;
  recentOrders: RecentOrder[];
  topProducts: TopProduct[];
}

export interface SalesByDay {
  date: string;
  revenueCents: number;
  orders: number;
}

export interface NewUsersByDay {
  date: string;
  count: number;
}

export interface StatusCount {
  status: OrderStatus;
  count: number;
}

export interface AnalyticsResult {
  salesByDay: SalesByDay[];
  ordersByStatus: StatusCount[];
  newUsersByDay: NewUsersByDay[];
}

export interface AuditLogView {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  metadata: Prisma.JsonValue;
  ip: string | null;
  createdAt: Date;
  actor: { id: string; email: string } | null;
}

/**
 * Read-only admin dashboard aggregates. Talks to the DB directly via Prisma
 * (no feature-module imports) using aggregate/groupBy/count.
 */
@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  /** Formats a Date as a UTC `YYYY-MM-DD` day key. */
  private dayKey(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  /** Number of whole days covered by an analytics range. */
  private rangeDays(range: AnalyticsRange): number {
    switch (range) {
      case AnalyticsRange.SEVEN_DAYS:
        return 7;
      case AnalyticsRange.NINETY_DAYS:
        return 90;
      case AnalyticsRange.THIRTY_DAYS:
      default:
        return 30;
    }
  }

  /** Dashboard headline metrics + recent activity. */
  async getOverview(): Promise<OverviewResult> {
    const [revenue, orderCount, paidOrderCount, userCount, lowStockCount, recentOrders, topProducts] =
      await Promise.all([
        this.prisma.order.aggregate({
          _sum: { totalCents: true },
          where: { status: { in: REVENUE_STATUSES } },
        }),
        this.prisma.order.count(),
        this.prisma.order.count({ where: { status: { in: REVENUE_STATUSES } } }),
        this.prisma.user.count({ where: { role: Role.CUSTOMER } }),
        // Low stock = on-hand quantity at or below the per-product threshold.
        this.prisma.inventory.count({
          where: { quantity: { lte: this.prisma.inventory.fields.lowStockThreshold } },
        }),
        this.prisma.order.findMany({
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: { id: true, orderNumber: true, email: true, status: true, totalCents: true, createdAt: true },
        }),
        this.prisma.product.findMany({
          orderBy: { salesCount: 'desc' },
          take: 5,
          select: { id: true, name: true, slug: true, priceCents: true, salesCount: true },
        }),
      ]);

    return {
      revenueCents: revenue._sum.totalCents ?? 0,
      orderCount,
      paidOrderCount,
      userCount,
      lowStockCount,
      recentOrders,
      topProducts,
    };
  }

  /** Time-series sales/orders/signups over the requested window. */
  async getAnalytics(query: AnalyticsQueryDto): Promise<AnalyticsResult> {
    const days = this.rangeDays(query.range);
    // Inclusive window: start at midnight UTC `days - 1` days before today.
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    since.setUTCDate(since.getUTCDate() - (days - 1));

    const [revenueOrders, statusGroups, newUsers] = await Promise.all([
      this.prisma.order.findMany({
        where: { status: { in: REVENUE_STATUSES }, createdAt: { gte: since } },
        select: { totalCents: true, createdAt: true },
      }),
      this.prisma.order.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.user.findMany({
        where: { createdAt: { gte: since } },
        select: { createdAt: true },
      }),
    ]);

    // Pre-seed every day in the range so gaps render as zeroes.
    const salesMap = new Map<string, SalesByDay>();
    const usersMap = new Map<string, NewUsersByDay>();
    for (let i = 0; i < days; i += 1) {
      const d = new Date(since);
      d.setUTCDate(since.getUTCDate() + i);
      const key = this.dayKey(d);
      salesMap.set(key, { date: key, revenueCents: 0, orders: 0 });
      usersMap.set(key, { date: key, count: 0 });
    }

    for (const order of revenueOrders) {
      const bucket = salesMap.get(this.dayKey(order.createdAt));
      if (bucket) {
        bucket.revenueCents += order.totalCents;
        bucket.orders += 1;
      }
    }

    for (const user of newUsers) {
      const bucket = usersMap.get(this.dayKey(user.createdAt));
      if (bucket) bucket.count += 1;
    }

    // Return as an array of { status, count } for chart consumption.
    const ordersByStatus: StatusCount[] = statusGroups.map((group) => ({
      status: group.status,
      count: group._count._all,
    }));

    return {
      salesByDay: Array.from(salesMap.values()),
      ordersByStatus,
      newUsersByDay: Array.from(usersMap.values()),
    };
  }

  /** Paginated audit trail, newest first, with optional entity/actor filters. */
  async listAuditLogs(query: AuditLogQueryDto): Promise<Paginated<AuditLogView>> {
    const { page, limit, skip, entity, actorId } = query;
    const where: Prisma.AuditLogWhereInput = {
      ...(entity ? { entity } : {}),
      ...(actorId ? { actorId } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          action: true,
          entity: true,
          entityId: true,
          metadata: true,
          ip: true,
          createdAt: true,
          actor: { select: { id: true, email: true } },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return paginate(items, total, page, limit);
  }
}
