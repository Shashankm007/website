import { BadRequestException, Body, Controller, Headers, HttpCode, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Raw } from '../common/decorators/raw-response.decorator';
import { CreatePaymentOrderDto, VerifyPaymentDto } from './dto/payments.dto';
import { PaymentsService } from './payments.service';

/** Raw-body express request (main.ts bootstraps Nest with `rawBody: true`). */
type RawRequest = Request & { rawBody?: Buffer };

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  /** Create (or reuse) a Razorpay order for the caller's pending order. */
  @ApiBearerAuth()
  @Post('create-order')
  @HttpCode(200)
  async createOrder(@CurrentUser('id') userId: string, @Body() dto: CreatePaymentOrderDto) {
    return this.payments.createOrder(userId, dto.orderId);
  }

  /** Verify the Razorpay Checkout signature and settle the order. */
  @ApiBearerAuth()
  @Post('verify')
  @HttpCode(200)
  async verify(@CurrentUser('id') userId: string, @Body() dto: VerifyPaymentDto) {
    return this.payments.verifyCheckout(userId, dto);
  }

  /** Razorpay webhook receiver — verifies the HMAC signature against the raw body. */
  @Public()
  @Raw()
  @Post('webhook')
  @HttpCode(200)
  async webhook(@Req() req: RawRequest, @Headers('x-razorpay-signature') signature: string) {
    if (!req.rawBody) throw new BadRequestException('Missing raw request body');
    if (!signature) throw new BadRequestException('Missing x-razorpay-signature header');
    return this.payments.handleWebhook(req.rawBody, signature);
  }
}
