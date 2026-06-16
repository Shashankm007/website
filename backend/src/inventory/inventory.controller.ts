import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuditService } from '../audit/audit.service';
import { AdjustInventoryDto } from './dto/adjust-inventory.dto';
import { InventoryQueryDto } from './dto/inventory-query.dto';
import { InventoryService } from './inventory.service';

@ApiTags('admin-inventory')
@Roles(Role.ADMIN)
@Controller('admin/inventory')
export class AdminInventoryController {
  constructor(
    private readonly inventory: InventoryService,
    private readonly audit: AuditService,
  ) {}

  /** Paginated inventory list joining product + inventory + computed status. */
  @Get()
  list(@Query() query: InventoryQueryDto) {
    return this.inventory.adminList(query);
  }

  /** Products at or under their low-stock threshold. */
  @Get('low')
  listLow() {
    return this.inventory.listLow();
  }

  /** Manually adjust a product's stock level. */
  @Post(':productId/adjust')
  async adjust(
    @Param('productId') productId: string,
    @Body() dto: AdjustInventoryDto,
    @CurrentUser('id') actorId: string,
  ) {
    const inventory = await this.inventory.adjust(productId, dto.delta, dto.reason, {
      note: dto.note,
      actorId,
    });
    await this.audit.log({
      actorId,
      action: 'inventory.adjust',
      entity: 'Inventory',
      entityId: productId,
      metadata: { delta: dto.delta, reason: dto.reason, note: dto.note },
    });
    return inventory;
  }
}
