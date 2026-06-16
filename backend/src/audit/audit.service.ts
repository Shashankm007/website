import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditEntry {
  actorId?: string | null;
  action: string; // e.g. "product.update"
  entity: string; // e.g. "Product"
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  ip?: string | null;
}

/**
 * Records admin/privileged actions to the AuditLog table.
 * Failures are swallowed (logging must never break the request).
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: entry.actorId ?? null,
          action: entry.action,
          entity: entry.entity,
          entityId: entry.entityId ?? null,
          metadata: (entry.metadata as any) ?? undefined,
          ip: entry.ip ?? null,
        },
      });
    } catch (err) {
      this.logger.warn(`Failed to write audit log for ${entry.action}: ${(err as Error).message}`);
    }
  }
}
