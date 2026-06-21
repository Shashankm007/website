import { Module } from '@nestjs/common';
import { CartModule } from '../cart/cart.module';
import { CouponsModule } from '../coupons/coupons.module';
import { InventoryModule } from '../inventory/inventory.module';
import { SettingsModule } from '../settings/settings.module';
import { AdminOrdersController } from './admin-orders.controller';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

/**
 * Order lifecycle module. Consumes Cart/Coupons/Inventory services; writes
 * product salesCount via PrismaService directly (no ProductsModule dependency).
 */
@Module({
  imports: [CartModule, CouponsModule, InventoryModule, SettingsModule],
  controllers: [OrdersController, AdminOrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
