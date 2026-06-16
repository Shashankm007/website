import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class CreatePaymentOrderDto {
  @ApiProperty({ description: 'Our internal order id (PENDING) to pay for' })
  @IsString()
  orderId!: string;
}

export class VerifyPaymentDto {
  @ApiProperty({ description: 'Our internal order id' })
  @IsString()
  orderId!: string;

  @ApiProperty({ example: 'order_NXxxxxxxxxxxxx' })
  @IsString()
  razorpayOrderId!: string;

  @ApiProperty({ example: 'pay_NXxxxxxxxxxxxx' })
  @IsString()
  razorpayPaymentId!: string;

  @ApiProperty({ description: 'HMAC signature returned by Razorpay Checkout' })
  @IsString()
  razorpaySignature!: string;
}
