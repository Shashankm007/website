import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { CouponsService } from './coupons.service';
import { ValidateCouponDto } from './dto/validate-coupon.dto';

@ApiTags('coupons')
@Controller('coupons')
export class CouponsController {
  constructor(private readonly coupons: CouponsService) {}

  /**
   * Validate + price a coupon for a cart subtotal. Works for guests and
   * logged-in users; when a token is present `userId` enforces the per-user limit.
   */
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @HttpCode(200)
  @Post('validate')
  async validate(@Body() dto: ValidateCouponDto, @CurrentUser('id') userId?: string) {
    const { coupon, discountCents } = await this.coupons.validateAndPrice(
      dto.code,
      dto.subtotalCents,
      userId,
    );
    return { code: coupon.code, type: coupon.type, discountCents, valid: true as const };
  }
}
