import { Module } from '@nestjs/common';
import { UploadsModule } from '../uploads/uploads.module';
import { AdminProductsController } from './admin-products.controller';
import { AdminTagsController } from './admin-tags.controller';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

/**
 * Catalog module: public storefront listing/detail + admin CRUD, media and
 * bulk import. Exports ProductsService for cross-module use (orders, reviews).
 */
@Module({
  imports: [UploadsModule],
  controllers: [ProductsController, AdminProductsController, AdminTagsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
