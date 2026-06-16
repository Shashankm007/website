import { PartialType } from '@nestjs/swagger';
import { CreateCouponDto } from './create-coupon.dto';

/** Partial update of a coupon (admin). All fields optional. */
export class UpdateCouponDto extends PartialType(CreateCouponDto) {}
