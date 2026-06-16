import { Module } from '@nestjs/common';
import { AdminProductsController } from './admin-products.controller';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

/**
 * Catalog module: public storefront listing/detail + admin CRUD, media and
 * bulk import. Exports ProductsService for cross-module use (orders, reviews).
 */
@Module({
  controllers: [ProductsController, AdminProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
