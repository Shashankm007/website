import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { CouponsService } from './coupons.service';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';

@ApiTags('admin/coupons')
@Roles(Role.ADMIN)
@Controller('admin/coupons')
export class AdminCouponsController {
  constructor(
    private readonly coupons: CouponsService,
    private readonly audit: AuditService,
  ) {}

  /** Paginated list of all coupons. */
  @Get()
  async list(@Query() query: PaginationQueryDto) {
    return this.coupons.list(query);
  }

  /** Create a coupon. */
  @Post()
  async create(@Body() dto: CreateCouponDto, @CurrentUser('id') actorId: string) {
    const coupon = await this.coupons.create(dto);
    await this.audit.log({
      actorId,
      action: 'coupon.create',
      entity: 'Coupon',
      entityId: coupon.id,
      metadata: { code: coupon.code, type: coupon.type, value: coupon.value },
    });
    return coupon;
  }

  /** Update a coupon. */
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCouponDto,
    @CurrentUser('id') actorId: string,
  ) {
    const coupon = await this.coupons.update(id, dto);
    await this.audit.log({
      actorId,
      action: 'coupon.update',
      entity: 'Coupon',
      entityId: coupon.id,
      metadata: { code: coupon.code },
    });
    return coupon;
  }

  /** Delete a coupon. */
  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string, @CurrentUser('id') actorId: string) {
    await this.coupons.remove(id);
    await this.audit.log({
      actorId,
      action: 'coupon.delete',
      entity: 'Coupon',
      entityId: id,
    });
  }
}
