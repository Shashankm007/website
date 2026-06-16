import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuditService } from '../audit/audit.service';
import { AddMediaDto } from './dto/add-media.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { ImportProductsDto } from './dto/import-products.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { SetStarProductsDto } from './dto/set-star-products.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';

/** Admin-only catalog management. RBAC enforced via @Roles(ADMIN). */
@ApiTags('admin/products')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin/products')
export class AdminProductsController {
  constructor(
    private readonly products: ProductsService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all products incl. DRAFT/ARCHIVED' })
  adminList(@Query() query: ProductQueryDto) {
    return this.products.adminList(query);
  }

  // Declared before ':id' so "star" isn't matched as a product id.
  @Get('star')
  @ApiOperation({ summary: 'Get the curated landing-page star products (ordered)' })
  getStar() {
    return this.products.getStarProductsAdmin();
  }

  @Put('star')
  @ApiOperation({ summary: 'Set the curated landing-page star products (ordered)' })
  async setStar(@Body() dto: SetStarProductsDto, @CurrentUser('id') actorId: string, @Req() req: Request) {
    const result = await this.products.setStarProducts(dto.productIds);
    await this.audit.log({
      actorId,
      action: 'product.star.update',
      entity: 'Product',
      metadata: { count: dto.productIds.length },
      ip: req.ip,
    });
    return result;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single product (any status) for editing' })
  adminGetById(@Param('id') id: string) {
    return this.products.adminFindById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a product' })
  async create(@Body() dto: CreateProductDto, @CurrentUser('id') actorId: string, @Req() req: Request) {
    const product = await this.products.create(dto);
    await this.audit.log({
      actorId,
      action: 'product.create',
      entity: 'Product',
      entityId: product.id,
      metadata: { name: product.name, sku: product.sku },
      ip: req.ip,
    });
    return product;
  }

  @Post('import')
  @ApiOperation({ summary: 'Bulk import products from rows or CSV' })
  async bulkImport(@Body() dto: ImportProductsDto, @CurrentUser('id') actorId: string, @Req() req: Request) {
    const result = await this.products.bulkImport(dto);
    await this.audit.log({
      actorId,
      action: 'product.import',
      entity: 'Product',
      metadata: { total: result.total, created: result.created, failed: result.failed },
      ip: req.ip,
    });
    return result;
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a product' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser('id') actorId: string,
    @Req() req: Request,
  ) {
    const product = await this.products.update(id, dto);
    await this.audit.log({
      actorId,
      action: 'product.update',
      entity: 'Product',
      entityId: id,
      metadata: { fields: Object.keys(dto) },
      ip: req.ip,
    });
    return product;
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a product' })
  async remove(@Param('id') id: string, @CurrentUser('id') actorId: string, @Req() req: Request) {
    await this.products.remove(id);
    await this.audit.log({
      actorId,
      action: 'product.delete',
      entity: 'Product',
      entityId: id,
      ip: req.ip,
    });
  }

  @Post(':id/media')
  @ApiOperation({ summary: 'Attach a media item to a product' })
  async addMedia(
    @Param('id') id: string,
    @Body() dto: AddMediaDto,
    @CurrentUser('id') actorId: string,
    @Req() req: Request,
  ) {
    const [media] = await this.products.addMedia(id, [dto]);
    await this.audit.log({
      actorId,
      action: 'product.media.add',
      entity: 'Product',
      entityId: id,
      metadata: { mediaId: media.id, type: media.type },
      ip: req.ip,
    });
    return media;
  }

  @Delete(':id/media/:mediaId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Remove a media item from a product' })
  async removeMedia(
    @Param('id') id: string,
    @Param('mediaId') mediaId: string,
    @CurrentUser('id') actorId: string,
    @Req() req: Request,
  ) {
    await this.products.removeMedia(mediaId);
    await this.audit.log({
      actorId,
      action: 'product.media.remove',
      entity: 'Product',
      entityId: id,
      metadata: { mediaId },
      ip: req.ip,
    });
  }
}
