import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { ShippingController } from './shipping.controller';
import { ShippingService } from './shipping.service';
import { ShiprocketService } from './shiprocket.service';
import { CheckoutController } from '../checkout/checkout.controller';

@Module({
  imports: [OrdersModule],
  controllers: [ShippingController],
  providers: [ShiprocketService, ShippingService],
  exports: [ShippingService],
})
export class ShippingModule {}
