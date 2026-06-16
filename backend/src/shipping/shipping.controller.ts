import { Body, Controller, Get, Headers, Param, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Request } from 'express';
import { AuditService } from '../audit/audit.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/interfaces/jwt-payload.interface';
import { ShippingService } from './shipping.service';

@ApiTags('shipping')
@Controller()
export class ShippingController {
  constructor(
    private readonly shipping: ShippingService,
    private readonly audit: AuditService,
  ) {}

  /** Admin: create a Shiprocket shipment + AWB and mark the order shipped. */
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Post('admin/orders/:id/ship')
  async ship(@Param('id') id: string, @CurrentUser() actor: AuthUser, @Req() req: Request) {
    const order = await this.shipping.fulfil(id, actor);
    await this.audit.log({
      actorId: actor.id,
      action: 'order.ship.shiprocket',
      entity: 'Order',
      entityId: id,
      metadata: { awb: order?.awbCode, courier: order?.courierName },
      ip: req.ip,
    });
    return order;
  }

  /** Customer/admin: live tracking for an order's shipment. */
  @Get('orders/:id/track')
  track(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.shipping.track(id, user);
  }

  /** Shiprocket tracking webhook (token verified via the x-api-key header). */
  @Public()
  @Post('shipping/webhook')
  webhook(@Body() body: Record<string, unknown>, @Headers('x-api-key') token?: string) {
    return this.shipping.handleWebhook(body, token);
  }
}
