import { Body, Controller, Get, Param, Patch, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Request } from 'express';
import { AuditService } from '../audit/audit.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/interfaces/jwt-payload.interface';
import { OrderQueryDto } from './dto/order-query.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrdersService } from './orders.service';

@ApiTags('admin/orders')
@Roles(Role.ADMIN)
@Controller('admin/orders')
export class AdminOrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all orders (filter by status / search)' })
  async list(@Query() query: OrderQueryDto) {
    return this.orders.adminList(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an order by id' })
  async getOne(@Param('id') id: string) {
    return this.orders.adminGetById(id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update an order’s status / fulfilment details' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    const order = await this.orders.updateStatus(id, dto, actor);
    await this.audit.log({
      actorId: actor.id,
      action: 'order.status.update',
      entity: 'Order',
      entityId: id,
      metadata: { status: dto.status, trackingNumber: dto.trackingNumber, carrier: dto.carrier },
      ip: req.ip,
    });
    return order;
  }
}
