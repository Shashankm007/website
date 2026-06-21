import { Body, Controller, Get, Put, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Request } from 'express';
import { AuditService } from '../audit/audit.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UpdateBannerDto } from './dto/banner.dto';
import { UpdateShippingDto } from './dto/shipping.dto';
import { SettingsService } from './settings.service';

@ApiTags('settings')
@Controller()
export class SettingsController {
  constructor(
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
  ) {}

  /** Public: the current announcement banner (storefront reads this). */
  @Public()
  @Get('settings/banner')
  getBanner() {
    return this.settings.getBanner();
  }

  /** Admin: update the announcement banner. */
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Put('admin/settings/banner')
  async updateBanner(@Body() dto: UpdateBannerDto, @CurrentUser('id') actorId: string, @Req() req: Request) {
    const banner = await this.settings.setBanner(dto);
    await this.audit.log({
      actorId,
      action: 'settings.banner.update',
      entity: 'Setting',
      entityId: 'banner',
      metadata: { enabled: banner.enabled, variant: banner.variant },
      ip: req.ip,
    });
    return banner;
  }

  /** Public: current shipping configuration (storefront/checkout may read this). */
  @Public()
  @Get('settings/shipping')
  getShipping() {
    return this.settings.getShipping();
  }

  /** Admin: update shipping fee + free-shipping threshold. */
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Put('admin/settings/shipping')
  async updateShipping(@Body() dto: UpdateShippingDto, @CurrentUser('id') actorId: string, @Req() req: Request) {
    const shipping = await this.settings.setShipping(dto);
    await this.audit.log({
      actorId,
      action: 'settings.shipping.update',
      entity: 'Setting',
      entityId: 'shipping',
      metadata: {
        flatCents: shipping.flatCents,
        freeShippingEnabled: shipping.freeShippingEnabled,
        freeThresholdCents: shipping.freeThresholdCents,
      },
      ip: req.ip,
    });
    return shipping;
  }
}
